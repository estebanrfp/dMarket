/**
 * dMarket — blockchain manager.
 *
 * The thin, faithful slice of OVGrid's lib/blockchain/BlockchainManager.js (4.5k
 * lines → here ~200): connect a provider, instantiate the real contracts, read
 * marketplace state with Multicall3, and send the write transactions
 * (mint / list / buy / offer / cancel). Everything ethers/Polygon lives here so
 * the GenosDB layer (db/, services/, state/) stays clean and idiomatic.
 *
 * ethers v6 is loaded as a UMD global by index.html (matches OVGrid).
 */

import { NETWORK, CONTRACTS, MULTICALL3, SETTINGS } from './config.js'
import { ASSETS_ABI, MARKETPLACE_ABI, TOKEN_ABI, METADATA_ABI, MULTICALL3_ABI } from './abis.js'
import { getSigner } from './signer.js'

/** The ethers UMD global (window.ethers). */
const ethers = globalThis.ethers

let provider = null
let contracts = null

/** @returns {object} ethers provider (throws if init() was not called). */
export const getProvider = () => provider

/**
 * Connect to the first reachable Amoy RPC and instantiate read-only contracts.
 * Safe to call once at startup.
 * @returns {Promise<void>}
 */
export const init = async () => {
  provider = await connectFirstReachable(NETWORK.rpcs)
  contracts = {
    assets: new ethers.Contract(CONTRACTS.OVGAssets, ASSETS_ABI, provider),
    market: new ethers.Contract(CONTRACTS.OVGMarketplace, MARKETPLACE_ABI, provider),
    token: new ethers.Contract(CONTRACTS.OVGToken, TOKEN_ABI, provider),
    metadata: new ethers.Contract(CONTRACTS.OVGMetadata, METADATA_ABI, provider),
    multicall: new ethers.Contract(MULTICALL3, MULTICALL3_ABI, provider)
  }
}

/** Race the RPC list and return a provider backed by the first node that answers. */
const connectFirstReachable = async (rpcs) => {
  const attempts = rpcs.map(async (url) => {
    const p = new ethers.JsonRpcProvider(url)
    await withTimeout(p.getBlockNumber(), SETTINGS.rpcTimeoutMs)
    return p
  })
  return Promise.any(attempts)
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout')), ms))])

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Fetch every active listing on-chain in two Multicall3 round-trips (listings,
 * then metadata). This is the authoritative source dMarket mirrors into GenosDB.
 * @returns {Promise<Array<object>>} active listings with merged metadata.
 */
export const getActiveListings = async () => {
  const next = Number(await contracts.market.nextListingId())
  const count = Math.min(next, SETTINGS.listingScanLimit)
  if (count === 0) return []

  const ids = Array.from({ length: count }, (_, i) => i)
  const raw = await multicall(contracts.market, 'listings', ids.map((id) => [id]))

  const listings = []
  for (let i = 0; i < ids.length; i++) {
    const l = raw[i]
    // Inactive/cancelled listings have a zeroed seller — skip them.
    if (!l || l.seller === ethers.ZeroAddress) continue
    listings.push({
      listingId: ids[i],
      seller: l.seller,
      assetId: Number(l.assetId),
      amount: Number(l.amount),
      price: ethers.formatUnits(l.price, 18),
      priceRaw: l.price.toString()
    })
  }
  await mergeMetadata(listings)
  return listings
}

/** Enrich listings in place with title/description/image from OVGMetadata. */
const mergeMetadata = async (listings) => {
  if (!listings.length) return
  const assetIds = [...new Set(listings.map((l) => l.assetId))]
  let metas = []
  try {
    metas = await contracts.metadata.getFullMetadataBatch(assetIds)
  } catch { /* metadata contract optional — degrade to id-only cards */ }
  const byId = new Map(assetIds.map((id, i) => [id, metas[i]]))
  for (const l of listings) {
    const m = byId.get(l.assetId)
    l.title = m?.title || `Asset #${l.assetId}`
    l.description = m?.description || ''
    l.image = m?.imageUrl || ''
    l.category = m?.category || ''
    l.rarity = m?.rarity || ''
    l.collection = m?.collection || ''
  }
}

/**
 * Best-effort discovery of the assets owned by `address`: union the asset ids seen
 * in active listings with recent inbound TransferSingle events, then confirm
 * balances with Multicall3. Mirrors OVGrid's event + Multicall strategy.
 * @param {string} address
 * @returns {Promise<Array<{assetId:number, balance:number}>>}
 */
export const getOwnedAssets = async (address) => {
  const candidates = new Set()
  try {
    const listings = await getActiveListings()
    listings.forEach((l) => candidates.add(l.assetId))
  } catch { /* ignore */ }
  try {
    const to = await provider.getBlockNumber()
    const from = Math.max(0, to - 45000) // ~25h on Polygon (RPC range limit)
    const events = await contracts.assets.queryFilter(
      contracts.assets.filters.TransferSingle(null, null, address), from, to
    )
    events.forEach((e) => candidates.add(Number(e.args.id)))
  } catch { /* ignore */ }

  const ids = [...candidates]
  if (!ids.length) return []
  const balances = await multicall(contracts.assets, 'balanceOf', ids.map((id) => [address, id]))
  return ids
    .map((assetId, i) => ({ assetId, balance: Number(balances[i]?.[0] ?? 0n) }))
    .filter((a) => a.balance > 0)
}

/**
 * Read the connected user's spendable balances.
 * @param {string} address
 * @returns {Promise<{pol:string, ovg:string}>}
 */
export const getBalances = async (address) => {
  const [pol, ovg] = await Promise.all([
    provider.getBalance(address),
    contracts.token.balanceOf(address)
  ])
  return { pol: ethers.formatEther(pol), ovg: ethers.formatUnits(ovg, 18) }
}

/**
 * Encode N calls to `method`, aggregate them through Multicall3, decode the results.
 * Each entry is the full decoded `Result` (named + positional access) or null on
 * failure — callers pick the field they need (e.g. `r.seller` or `r[0]`).
 */
const multicall = async (contract, method, argsList) => {
  const calls = argsList.map((args) => ({
    target: contract.target,
    allowFailure: true,
    callData: contract.interface.encodeFunctionData(method, args)
  }))
  const results = await contracts.multicall.aggregate3.staticCall(calls)
  return results.map((r) =>
    r.success ? contract.interface.decodeFunctionResult(method, r.returnData) : null
  )
}

// ── Writes (require a signing session — see signer.js) ────────────────────────

/** Connect a contract to the active identity's wallet so it can send transactions. */
const asSigner = (contract) => contract.connect(getSigner(ethers, provider))

/**
 * Mint a new ERC-1155 asset to the active user. Requires MINTER_ROLE on the
 * shared OVGrid contract (see README → "Prerequisites"). For your own deployment
 * you would grant the role or open minting.
 * @returns {Promise<object>} the tx receipt.
 */
export const mint = async (address, assetId, amount = 1) => {
  const tx = await asSigner(contracts.assets).mint(address, assetId, amount, '0x')
  return tx.wait()
}

/**
 * List an owned asset for sale (price in OVG). Approves the marketplace as operator
 * once, then creates the listing. `isRental`/`duration` are fixed to a plain sale.
 * @returns {Promise<object>} the tx receipt.
 */
export const list = async (address, assetId, amount, priceOvg) => {
  const market = asSigner(contracts.market)
  const assets = asSigner(contracts.assets)
  if (!(await contracts.assets.isApprovedForAll(address, CONTRACTS.OVGMarketplace))) {
    await (await assets.setApprovalForAll(CONTRACTS.OVGMarketplace, true)).wait()
  }
  const price = ethers.parseUnits(String(priceOvg), 18)
  const tx = await market.listAsset(assetId, amount, price, false, 0)
  return tx.wait()
}

/**
 * Buy a listing. Approves the OVG spend for the marketplace if needed, then purchases.
 * Requires holding enough OVG (the marketplace's ERC-20 payment token).
 * @returns {Promise<object>} the tx receipt.
 */
export const buy = async (address, listingId, priceRaw) => {
  const token = asSigner(contracts.token)
  const market = asSigner(contracts.market)
  const allowance = await contracts.token.allowance(address, CONTRACTS.OVGMarketplace)
  if (allowance < BigInt(priceRaw)) {
    await (await token.approve(CONTRACTS.OVGMarketplace, priceRaw)).wait()
  }
  const tx = await market.purchase(listingId)
  return tx.wait()
}

/**
 * Place a global offer (bid) on an asset id, payable in OVG.
 * @returns {Promise<object>} the tx receipt.
 */
export const makeOffer = async (address, assetId, priceOvg) => {
  const token = asSigner(contracts.token)
  const market = asSigner(contracts.market)
  const price = ethers.parseUnits(String(priceOvg), 18)
  const allowance = await contracts.token.allowance(address, CONTRACTS.OVGMarketplace)
  if (allowance < price) {
    await (await token.approve(CONTRACTS.OVGMarketplace, price)).wait()
  }
  const tx = await market.placeGlobalBid(assetId, price)
  return tx.wait()
}

/**
 * Cancel one of the user's own listings.
 * @returns {Promise<object>} the tx receipt.
 */
export const cancelListing = async (listingId) => {
  const tx = await asSigner(contracts.market).cancelListing(listingId)
  return tx.wait()
}

/** Build an Amoy PolygonScan link for a tx hash. */
export const explorerTx = (hash) => `${NETWORK.explorer}/tx/${hash}`
