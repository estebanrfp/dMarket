/**
 * dMarket — contract ABIs (minimal human-readable fragments).
 *
 * Trimmed from OVGrid's lib/blockchain/contracts.js to exactly the functions
 * and events dMarket calls. Keeping them minimal makes the integration easy to
 * read; the complete ABIs (auctions, bundles, rentals, royalties, governance)
 * live in the OVGrid repo.
 *
 * @see https://github.com/estebanrfp/ovgrid/blob/main/lib/blockchain/contracts.js
 */

/** OVGAssets — ERC-1155 multi-token. */
export const ASSETS_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  'function exists(uint256 id) view returns (bool)',
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'function mint(address account, uint256 id, uint256 amount, bytes data)', // requires MINTER_ROLE
  'function totalSupply(uint256 id) view returns (uint256)',
  'function getTokenMetadataUrl(uint256 tokenId) view returns (string)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]

/** OVGMarketplace — listings and (global) offers. Payment is in the OVG ERC-20. */
export const MARKETPLACE_ABI = [
  'function nextListingId() view returns (uint256)',
  'function listings(uint256) view returns (address seller, uint256 assetId, uint256 amount, uint256 price, bool isRental, uint256 duration)',
  'function listingPaymentToken(uint256) view returns (address)',
  'function listAsset(uint256 assetId, uint256 amount, uint256 price, bool isRental, uint256 duration)',
  'function cancelListing(uint256 listingId)',
  'function purchase(uint256 listingId)', // NOT payable → pulls OVG via transferFrom
  'function placeGlobalBid(uint256 assetId, uint256 price)',
  'function acceptGlobalBid(uint256 assetId, address bidder)',
  'function marketplaceFee() view returns (uint256)',
  'event Listed(uint256 indexed listingId, address indexed seller, uint256 assetId, uint256 price)',
  'event Purchased(uint256 indexed listingId, address indexed buyer, uint256 price, uint256 royalty)',
  'event Cancelled(uint256 indexed listingId, address indexed seller)',
  'event GlobalBidPlaced(uint256 indexed assetId, address indexed bidder, uint256 price)'
]

/** OVGToken — ERC-20 used to pay for purchases and offers. */
export const TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)'
]

/** OVGMetadata — off-chain-style metadata stored on-chain (title/description/image). */
export const METADATA_ABI = [
  'function getFullMetadata(uint256 assetId) view returns (tuple(string title, string description, string imageUrl, string assetUrl, string rarity, string category, string collection))',
  'function getFullMetadataBatch(uint256[] assetIds) view returns (tuple(string title, string description, string imageUrl, string assetUrl, string rarity, string category, string collection)[])',
  'function setAssetMetadataByTokenOwner(uint256 assetId, string title, string description, string imageUrl, string assetUrl)'
]

/** Multicall3 — aggregate many view calls into a single RPC round-trip. */
export const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])'
]
