/**
 * dMarket — marketplace rendering, mirroring OVGrid's card grid.
 *
 * Pure view: given a store snapshot and UI state, paint the sidebar category
 * filters, the card grid (.mp-card) and the result count. Cards delegate to
 * `ctx.actions` (wired in app.js). Rebuilt on every snapshot — simple and correct
 * for a demo-sized dataset.
 */
import { escapeHtml, imgSrc, cap, el } from './dom.js'

/**
 * Render the whole marketplace surface.
 * @param {{listings:object[], owned:object[], offers:object[]}} snap
 * @param {{address:string|null, ui:object, actions:object}} ctx
 *   ui = { tab:'market'|'inventory'|'offers', search:string, sort:string, cats:Set<string> }
 */
export const renderMarket = (snap, ctx) => {
  const items = selectItems(snap, ctx)
  renderCategories(snap, ctx)
  renderGrid(items, ctx)
  document.getElementById('count').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`
  document.getElementById('empty').hidden = items.length > 0
}

/** Pick + filter + sort the items for the active tab. */
const selectItems = (snap, { address, ui }) => {
  let items =
    ui.tab === 'inventory'
      ? (address ? snap.owned.filter((o) => o.owner === address.toLowerCase()) : []).map((o) => ({ ...o, kind: 'owned' }))
      : ui.tab === 'offers'
        ? snap.offers.map((o) => ({ ...o, kind: 'offer' }))
        : snap.listings.map((l) => ({ ...l, kind: 'listing' }))

  const q = ui.search.trim().toLowerCase()
  if (q) items = items.filter((i) => (i.title || `asset #${i.assetId}`).toLowerCase().includes(q) || String(i.assetId).includes(q))
  if (ui.cats.size) items = items.filter((i) => ui.cats.has((i.category || '').toLowerCase()))

  if (ui.tab === 'market') {
    if (ui.sort === 'price-asc') items.sort((a, b) => +a.price - +b.price)
    else if (ui.sort === 'price-desc') items.sort((a, b) => +b.price - +a.price)
    else items.sort((a, b) => b.listingId - a.listingId)
  }
  return items
}

/** Build the sidebar category checkboxes from the categories present in listings. */
const renderCategories = (snap, { ui, actions }) => {
  const block = document.getElementById('category-block')
  const host = document.getElementById('category-filters')
  const cats = [...new Set(snap.listings.map((l) => (l.category || '').toLowerCase()).filter(Boolean))].sort()
  block.hidden = cats.length === 0
  host.replaceChildren()
  for (const c of cats) {
    const count = snap.listings.filter((l) => (l.category || '').toLowerCase() === c).length
    const item = el('label', `mp-rarity-item${ui.cats.has(c) ? ' selected' : ''}`)
    item.dataset.category = c
    item.innerHTML = `<div class="mp-rarity-checkbox">✓</div><span class="mp-rarity-label">${escapeHtml(c)}</span><span class="mp-rarity-count">${count}</span>`
    item.onclick = () => actions.toggleCategory(c)
    host.append(item)
  }
}

/** Repaint the card grid. */
const renderGrid = (items, ctx) => {
  const grid = document.getElementById('grid')
  grid.replaceChildren()
  for (const it of items) grid.append(card(it, ctx))
}

/** Build one .mp-card for a listing / owned asset / offer. */
const card = (it, { address, actions }) => {
  const mine = address && it.seller && it.seller.toLowerCase() === address.toLowerCase()
  const title = it.title || `Asset #${it.assetId}`

  const badge =
    it.kind === 'offer'
      ? '<div class="mp-card-badges"><span class="mp-badge mp-badge-epic">Offer</span></div>'
      : it.kind === 'listing'
        ? '<div class="mp-card-badges"><span class="mp-badge mp-badge-sale">Sale</span></div>'
        : ''
  const qty = it.kind === 'owned' ? it.balance : it.amount
  const supply = qty > 1 ? `<span class="mp-inventory-supply-badge">x${qty}</span>` : ''

  const c = el('article', 'mp-card')
  c.innerHTML = `
    <div class="mp-card-image" data-detail>
      <img src="${imgSrc(it.image)}" alt="" loading="lazy" />
      ${badge}${supply}
    </div>
    <div class="mp-card-content">
      <div class="mp-card-collection">${escapeHtml(it.collection || cap(it.category) || 'OVGrid')}</div>
      <h3 class="mp-card-title">${escapeHtml(title)}</h3>
      <div class="mp-card-footer">${footer(it, mine, Boolean(address))}</div>
    </div>`

  const btn = c.querySelector('[data-action]')
  if (btn) btn.onclick = (e) => { e.stopPropagation(); dispatch(btn.dataset.action, it, actions) }
  if (it.kind === 'listing') c.querySelector('[data-detail]').onclick = () => actions.openDetail(it)
  return c
}

/** The price + primary action row inside a card. */
const footer = (it, mine, hasWallet) => {
  if (it.kind === 'owned') {
    return `<div class="mp-card-price"><span class="mp-price-label">Balance ${it.balance}</span></div>
            <button class="mp-card-btn mp-btn-sell" data-action="list">List</button>`
  }
  if (it.kind === 'offer') {
    return `<div class="mp-card-price"><span class="mp-price-value">${it.price} OVG</span><span class="mp-price-label">your offer</span></div>`
  }
  const action = mine
    ? '<button class="mp-card-btn mp-btn-cancel" data-action="cancel">Cancel</button>'
    : `<button class="mp-card-btn mp-btn-buy" data-action="buy"${hasWallet ? '' : ' disabled'}>Buy</button>`
  return `<div class="mp-card-price"><span class="mp-price-value">${it.price} OVG</span></div>${action}`
}

/** Route a card button to the matching action. */
const dispatch = (action, it, actions) => {
  if (action === 'buy') actions.buy(it)
  else if (action === 'cancel') actions.cancel(it)
  else if (action === 'list') actions.list(it)
}
