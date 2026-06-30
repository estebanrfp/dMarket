/**
 * dMarket — application bootstrap.
 *
 * Wires the four layers: GenosDB (db), the chain manager, the mirror service and
 * the OVGrid-styled UI. Boot order: start the single db.map → connect the chain →
 * reconcile listings into GenosDB. The UI then repaints purely from db.map.
 */
import { db } from './src/db/gdb.js' // top-level await: GenosDB is ready after this import
import * as chain from './src/chain/manager.js'
import * as store from './src/state/store.js'
import * as market from './src/services/market.js'
import { mountAuth } from './src/ui/auth.js'
import { renderMarket } from './src/ui/market.js'
import { toast } from './src/ui/toast.js'
import * as flows from './src/ui/flows.js'

let address = null
let snap = store.snapshot()
const ui = { tab: 'market', search: '', sort: 'recent', cats: new Set() }

/** Context handed to the modal flows (current address + a refresh hook). */
const flowCtx = () => ({ address, refresh: refreshAccount })

const actions = {
  buy: (l) => flows.openBuy(l, flowCtx()),
  list: (a) => flows.openList(a, flowCtx()),
  cancel: (l) => flows.openCancel(l, flowCtx()),
  openDetail: (l) => flows.openDetail(l, flowCtx()),
  toggleCategory: (c) => { ui.cats.has(c) ? ui.cats.delete(c) : ui.cats.add(c); paint() }
}

const paint = () => renderMarket(snap, { address, ui, actions })

// 1) The ONE reactive read: repaint whenever the mirror changes (local or remote peer).
store.subscribe((s) => { snap = s; paint() })

// 2) Identity in the header. The SM state callback flows back via onAuthChange.
const authApi = mountAuth(document.getElementById('wallet'), onAuthChange)

// 3) Wire the static controls (responsive immediately, before the chain loads).
const tabsEl = document.getElementById('tabs')
tabsEl.querySelectorAll('.mp-nav-tab').forEach((b) => {
  b.onclick = () => {
    tabsEl.querySelector('.active')?.classList.remove('active')
    b.classList.add('active')
    ui.tab = b.dataset.tab
    paint()
  }
})
const search = document.getElementById('search')
search.oninput = () => { ui.search = search.value; paint() }
const sort = document.getElementById('sort')
sort.onchange = () => { ui.sort = sort.value; paint() }
document.getElementById('refresh').onclick = syncFromChain
document.getElementById('mint-fab').onclick = () => {
  if (!address) return toast('Connect your identity first', 'error')
  flows.openMint(flowCtx())
}

// 4) Boot the data layers.
await store.start()
try {
  await chain.init()
  await syncFromChain()
} catch (e) {
  toast('Could not reach an Amoy RPC — showing mirrored data only.', 'error')
  console.error(e)
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/** Read the chain (authoritative) and mirror active listings into GenosDB. */
async function syncFromChain () {
  const icon = document.getElementById('refresh')
  icon.classList.add('syncing')
  try {
    const activeIds = await market.reconcileListings()
    await market.pruneStale(store.snapshot().listings, activeIds)
    toast('Mirror up to date', 'success')
  } catch (e) {
    toast('Sync failed — RPC unreachable', 'error')
    console.error(e)
  } finally {
    icon.classList.remove('syncing')
  }
}

/** React to login/logout (driven by the SM state callback in ui/auth.js). */
async function onAuthChange (addr) {
  address = addr
  paint()
  if (addr) await refreshAccount()
  else authApi.setBalance('')
}

/** Refresh the connected user's balance and owned assets. */
async function refreshAccount () {
  if (!address) return
  try {
    const { ovg } = await chain.getBalances(address)
    authApi.setBalance(`${(+ovg).toFixed(2)} OVG`)
    await market.refreshOwned(address)
  } catch (e) { console.error(e) }
}
