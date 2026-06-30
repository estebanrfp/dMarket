/**
 * dMarket — network & contract configuration.
 *
 * Faithfully reused from OVGrid (lib/config/marketplaceConfig.js +
 * lib/blockchain/contracts.js). dMarket talks to the SAME upgradeable
 * contracts OVGrid runs in production, so every integration pattern shown
 * here is the real one — not a mock. Default network: Polygon Amoy testnet.
 *
 * @see https://github.com/estebanrfp/ovgrid
 */

/** Active network: Polygon Amoy testnet (POL is the native gas currency). */
export const NETWORK = {
  chainId: 80002,
  name: 'Polygon Amoy',
  currency: 'POL',
  // Public RPCs with fallback (first reachable one wins, like OVGrid).
  rpcs: [
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy-bor-rpc.publicnode.com',
    'https://rpc.ankr.com/polygon_amoy'
  ],
  explorer: 'https://amoy.polygonscan.com',
  faucet: 'https://faucet.polygon.technology/'
}

/**
 * Deployed OVGrid contract addresses on Amoy (PROXY addresses — UUPS upgradeable).
 * Source of truth for ownership; GenosDB mirrors their state for fast reactive reads.
 */
export const CONTRACTS = {
  OVGToken: '0x564f99BAD84cE3fD36D5597874633eddBB304b8f', // ERC-20 payment token (OVG)
  OVGAssets: '0xD55d5049e597BA431d5C2b5c1f286532f0E0C195', // ERC-1155 assets
  OVGMarketplace: '0x9982f5e65A342D7b8CAd1Ab3C83585916D98542a', // listings / offers
  OVGMetadata: '0x51f36d3A3491551c92D5cE087FF22Cc5010b6B0A' // off-chain title/description/image
}

/** Multicall3 — same canonical address on every EVM chain (batches N reads into 1 RPC call). */
export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'

/** OVG ERC-20 payment token metadata. */
export const TOKEN = { symbol: 'OVG', decimals: 18 }

/** Tunables (subset of OVGrid's MARKETPLACE_CONFIG). */
export const SETTINGS = {
  rpcTimeoutMs: 5000,
  txWaitTimeoutMs: 60000,
  listingScanLimit: 300 // max listing ids scanned per chain reconcile
}
