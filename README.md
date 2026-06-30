# dMarket — a GenosDB × Polygon marketplace mirror

> **A live blockchain marketplace, mirrored into [GenosDB](https://github.com/estebanrfp/gdb) — reactive, peer-to-peer, offline-capable, with no backend server.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE) · Built from [OVGrid](https://github.com/estebanrfp/ovgrid) · Powered by [GenosDB](https://github.com/estebanrfp/gdb) · Vanilla ESM, no build

dMarket is a **faithful, standalone extraction** of the blockchain layer that powers
[**OVGrid**](https://github.com/estebanrfp/ovgrid) (the serverless 3-D virtual world).
It talks to the **same upgradeable contracts OVGrid runs in production on Polygon**, and
demonstrates the one pattern most blockchain front-ends get wrong:

> **The chain is the source of truth for ownership. GenosDB is the reactive read layer
> over it.** You read the marketplace the same way whether a listing was just discovered
> on-chain or just created by a peer two seconds ago. The read layer never changes —
> **GenosDB is the abstraction.**

Every integration shown here is real and battle-tested in OVGrid. dMarket exists so any
developer can copy a working pattern instead of reinventing it.

> [!NOTE]
> **This is a simplified reference example — not the full product.** dMarket distills the
> essential GenosDB↔blockchain pattern (reactive mirror + identity-is-your-wallet) into
> ~1,600 readable lines with **no build step**, scoped to **mint · list · buy · offer**.
> The production implementation — timed auctions, bundles, rentals, royalties, global
> offers, analytics, gasless meta-tx and a whole 3-D world — lives in
> [OVGrid](https://github.com/estebanrfp/ovgrid). **Read dMarket to learn the pattern;
> study OVGrid to see it at full scale.**

---

## Why this matters

A naïve dapp hammers an RPC endpoint on every render, can't work offline, and has no live
updates between users without a centralized indexer/websocket backend. dMarket replaces all
of that with one peer-to-peer database:

| Problem in a typical dapp | How dMarket solves it with GenosDB |
|---|---|
| Every client polls the RPC for the same data | The chain is read **once** to reconcile; then everyone reads from GenosDB |
| No real-time updates without a backend | `db.map()` streams changes to every peer over WebRTC — **no server** |
| Breaks offline / on flaky networks | GenosDB is local-first (OPFS); the mirror is available offline |
| A wallet (MetaMask) is a hard dependency | The **GenosDB identity _is_ the wallet** — one key signs P2P ops *and* Polygon txs |
| Needs a centralized indexer for "who owns what" | Confirmed state is mirrored P2P and re-derivable from chain at any time |

---

## The two ideas worth stealing

### 1. One identity, two worlds (`src/chain/signer.js`)

GenosDB's Security Manager generates a BIP39 identity — `{ address, privateKey, mnemonic }`.
That Ethereum address is **both** the GenosDB signing identity **and** the Polygon wallet.
The same key that signs your peer-to-peer database operations signs your on-chain
transactions. No MetaMask, no second wallet, no bridging:

```js
// A GenosDB login hands you a usable Ethereum wallet.
const id = await db.sm.loginOrRecoverUserWithMnemonic(phrase) // { address, privateKey, ... }
const wallet = new ethers.Wallet(id.privateKey, provider)
// Invariant dMarket asserts before signing: wallet.address === db.sm.getActiveEthAddress()
```

### 2. The mirror (`src/services/market.js`)

On-chain is authoritative. After reading the chain — or after a write transaction
confirms — we `db.put()` the result into GenosDB. From then on the UI reads it reactively
via a single `db.map()`:

```js
// Reconcile: chain (truth) → GenosDB (fast, reactive, offline, P2P)
const listings = await chain.getActiveListings()          // 2 Multicall3 round-trips
await Promise.all(listings.map(l =>
  db.put({ type: 'listing', ...l }, `listing_${l.listingId}`)
))

// Everywhere else: read from GenosDB, never the RPC
db.map(({ id, value, action }) => { /* repaint */ })       // the ONE reactive read
```

---

## Architecture

```
index.html            ethers v6 (UMD, CDN) + the ES module app — zero build
app.js                bootstrap & orchestration (chain write → GenosDB mirror)
styles.css            dark theme, all values via CSS variables
src/
├─ db/gdb.js          the single GenosDB instance (rtc + Security Manager)
├─ chain/
│  ├─ config.js       network + the real OVGrid contract addresses (Amoy)
│  ├─ abis.js         minimal ABI fragments (trimmed from OVGrid's contracts.js)
│  ├─ signer.js       identity → ethers.Wallet bridge  ← idea #1
│  └─ manager.js      provider, contracts, Multicall3 reads, write txs
├─ services/market.js the mirror: chain ⇄ GenosDB        ← idea #2
├─ state/store.js     the ONE db.map subscription → reactive snapshot
└─ ui/                auth.js (Security Manager), market.js (grids), toast.js
```

Data flow for a purchase:

```
click Buy → market.buy()
  → chain.buy(): OVG approve + marketplace.purchase(listingId) → tx.wait()   [Polygon = truth]
  → reconcileListings() + refreshOwned(): db.put(...)                        [mirror into GenosDB]
  → db.map() streams the change to this tab AND every connected peer         [reactive, P2P]
```

---

## Run it

It's plain ES modules + CDN imports — **no build step**. Serve the folder over HTTP
(ES modules and OPFS need an `http(s)://` origin, not `file://`):

```bash
npx serve .
# or: python3 -m http.server 8080
```

Any static server works — including VS Code's **Live Server** extension
(right-click `index.html` → *Open with Live Server*). Open the served URL. **Browsing works with no wallet and no account** — that's the GenosDB
showcase: the marketplace state lives in a P2P database. Open a second tab/browser to watch
listings sync peer-to-peer in real time.

### To transact (mint / list / buy / offer)

These send real transactions to the live OVGrid contracts on **Polygon Amoy testnet**:

1. **Create or recover an identity** in the central identity modal — it opens on every
   visit until you connect, and is dismissible (browsing never requires it); reopen it
   anytime from **Connect identity** (top-right). This address is your Polygon wallet too.
2. **Fund it with test POL** for gas from the
   [Polygon Amoy faucet](https://faucet.polygon.technology/).

#### Honest prerequisites (because it uses OVGrid's real contracts)

dMarket intentionally reuses OVGrid's production contracts rather than mocking them, so the
code is the real thing. That fidelity comes with the contracts' real access rules:

- **Minting** an asset calls `OVGAssets.mint(...)`, which is gated by `MINTER_ROLE`. A random
  address can't mint on the shared contract. In OVGrid this is handled by the platform; for
  your **own** deployment you'd grant the role or open minting.
- **Buying / offering** is paid in the **OVG ERC-20 token** (`purchase` is not `payable`).
  OVG has no public faucet, so you need OVG to buy on the shared contract.

> **None of this limits the GenosDB demonstration**, which is the read/mirror/identity layer
> and works for everyone. The write paths are included as *faithful, real* reference code —
> point them at your own contracts and the full `mint → list → buy → offer` loop is yours.
> See it all running end-to-end in **[OVGrid](https://github.com/estebanrfp/ovgrid)**.

---

## Trust model (read this before shipping)

The GenosDB mirror is a **convenience cache, not a consensus layer.** This demo runs with
open-write roles (any peer can write the shared mirror), so:

- **The chain is always authoritative.** A skeptical client can re-derive every node from
  the contracts (`chain.getActiveListings()`); the mirror only makes reads fast, reactive
  and offline.
- **GenosDB still signs and verifies** every P2P operation by identity, so peers can't forge
  *each other's* writes.
- **For production**, bind each mirror node to its on-chain owner with GenosDB **ACLs**
  (`db.sm.acls.set/grant`) — and because the GenosDB identity *is* the Ethereum address, a
  peer can verify a node was signed by the same address that owns the asset on-chain. That
  is the trust-minimized version of this pattern; the hooks (`acls: true`) are already
  enabled in `src/db/gdb.js`.

---

## Built on / faithful to OVGrid

dMarket is a teaching extraction; the production implementation lives in OVGrid:

| dMarket file | OVGrid source it faithfully distills |
|---|---|
| `src/chain/config.js` | `lib/config/marketplaceConfig.js` |
| `src/chain/abis.js` | `lib/blockchain/contracts.js` |
| `src/chain/signer.js` | `lib/blockchain/GenosDBSigner.js` |
| `src/chain/manager.js` | `lib/blockchain/BlockchainManager.js` (a thin slice of ~4.5k lines) |
| `src/services/market.js` | `lib/marketplace/js/services/blockchain.js` |
| `styles.css` + `src/ui/` | `lib/marketplace/css/*` — same theme tokens + `.mp-*` component classes |

**The UI is a faithful visual mirror too.** dMarket reuses OVGrid's exact dark-theme
design tokens (`--mp-accent`, `--mp-bg-card`, …) and component classes (`.mp-card`,
`.mp-nav-tab`, `.mp-action-btn`, `.mp-modal`, the rarity/category filters and the mint
FAB). Studying dMarket's front end *is* studying OVGrid's marketplace — scoped down to
buy / list / mint / offer. The breadth OVGrid adds on top (auctions, bundles, rentals,
analytics, the land map) stays in OVGrid by design.

▶ **See it live in a full 3-D world:** [world.ovgrid.com](https://world.ovgrid.com/) ·
[OVGrid on GitHub](https://github.com/estebanrfp/ovgrid)

## Learn GenosDB

- [GenosDB](https://github.com/estebanrfp/gdb) — the P2P graph database
- [`db.map` / query guide](https://github.com/estebanrfp/gdb/blob/main/docs/map-guide.md)
- [Security Manager (identity, RBAC, ACLs)](https://github.com/estebanrfp/gdb/blob/main/docs/sm-api-reference.md)
- [More GenosDB examples](https://github.com/estebanrfp/gdb/blob/main/docs/genosdb-examples.md)

## Tech

Vanilla JavaScript (ES modules, no framework, no build) · [GenosDB](https://github.com/estebanrfp/gdb)
(via CDN) · [ethers v6](https://docs.ethers.org/) (UMD via CDN) · Polygon Amoy.

## Author

Esteban Fuster Pozzi (@estebanrfp) - Full Stack JavaScript Developer

## License

MIT
