/**
 * dMarket — the mirror service (the pattern this whole example exists to show).
 *
 * On-chain is the source of truth for ownership. After reading the chain, or after
 * a write transaction confirms, we db.put the resulting state into GenosDB. From
 * then on every peer reads it reactively via db.map (state/store.js) — fast,
 * offline-capable, P2P, with NO further RPC calls. The read layer never changes
 * whether a listing was just discovered or just created: GenosDB is the abstraction.
 */
import { db } from '../db/gdb.js'
import * as chain from '../chain/manager.js'

const listingKey = (id) => `listing_${id}`
const ownedKey = (addr, assetId) => `owned_${addr.toLowerCase()}_${assetId}`
const offerKey = (addr, assetId) => `offer_${addr.toLowerCase()}_${assetId}`

/**
 * Bootstrap path: read every active listing from the chain and mirror it into
 * GenosDB. Any visitor can run this (open-write demo), seeding the shared P2P view.
 * @returns {Promise<Set<string>>} the set of active listing node ids.
 */
export const reconcileListings = async () => {
  const listings = await chain.getActiveListings()
  await Promise.all(
    listings.map((l) => db.put({ type: 'listing', ...l, mirroredAt: Date.now() }, listingKey(l.listingId)))
  )
  return new Set(listings.map((l) => listingKey(l.listingId)))
}

/**
 * Remove mirror nodes for listings no longer active on-chain (sold/cancelled).
 * @param {object[]} currentListings - listing nodes currently in the store.
 * @param {Set<string>} activeIds - ids returned by reconcileListings().
 * @returns {Promise<void>}
 */
export const pruneStale = async (currentListings, activeIds) => {
  const stale = currentListings.filter((l) => !activeIds.has(listingKey(l.listingId)))
  await Promise.all(stale.map((l) => db.remove(listingKey(l.listingId))))
}

/**
 * Mirror the assets owned by `address` (called after mint/buy).
 * @param {string} address
 * @returns {Promise<void>}
 */
export const refreshOwned = async (address) => {
  const owned = await chain.getOwnedAssets(address)
  await Promise.all(
    owned.map((a) => db.put({ type: 'owned', owner: address.toLowerCase(), ...a }, ownedKey(address, a.assetId)))
  )
}

// ── Actions: send the on-chain write, then mirror the confirmed result ─────────

/**
 * Buy a listing, then reflect the new ownership and listing change in GenosDB.
 * @returns {Promise<object>} the tx receipt.
 */
export const buy = async (address, listing) => {
  const receipt = await chain.buy(address, listing.listingId, listing.priceRaw)
  await reconcileListings() // the listing is now consumed on-chain
  await refreshOwned(address) // the buyer owns the asset
  return receipt
}

/**
 * List an owned asset for sale (price in OVG), then mirror the new listing.
 * @returns {Promise<object>} the tx receipt.
 */
export const list = async (address, assetId, amount, priceOvg) => {
  const receipt = await chain.list(address, assetId, amount, priceOvg)
  await reconcileListings()
  return receipt
}

/**
 * Cancel one of the user's listings, then remove its mirror node.
 * @returns {Promise<object>} the tx receipt.
 */
export const cancel = async (address, listingId) => {
  const receipt = await chain.cancelListing(listingId)
  await db.remove(listingKey(listingId))
  return receipt
}

/**
 * Mint a new asset to the user (requires MINTER_ROLE on the shared contract),
 * then mirror their ownership.
 * @returns {Promise<object>} the tx receipt.
 */
export const mint = async (address, assetId, amount = 1) => {
  const receipt = await chain.mint(address, assetId, amount)
  await refreshOwned(address)
  return receipt
}

/**
 * Place a global offer (bid) on an asset id, payable in OVG, then mirror it.
 * @returns {Promise<object>} the tx receipt.
 */
export const offer = async (address, assetId, priceOvg) => {
  const receipt = await chain.makeOffer(address, assetId, priceOvg)
  await db.put(
    { type: 'offer', bidder: address.toLowerCase(), assetId, price: priceOvg, at: Date.now() },
    offerKey(address, assetId)
  )
  return receipt
}
