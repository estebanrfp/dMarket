/**
 * dMarket — action flows: OVGrid-style modal dialogs that wrap the on-chain
 * writes (buy / list / offer / mint / cancel). Each builds a form with the
 * .mp-* classes, calls the mirror service, then refreshes. These replace the
 * earlier prompt() calls with the real marketplace look.
 */
import * as market from '../services/market.js'
import { openModal } from './modal.js'
import { toast } from './toast.js'
import { escapeHtml, imgSrc } from './dom.js'

/** Small asset header reused across the modals. */
const preview = (it) => `
  <div class="mp-asset-preview">
    <img src="${imgSrc(it.image)}" alt="" />
    <div>
      <div class="mp-asset-preview-title">${escapeHtml(it.title || `Asset #${it.assetId}`)}</div>
      <div class="mp-asset-preview-sub">#${it.assetId}${it.price ? ` · ${it.price} OVG` : ''}</div>
    </div>
  </div>`

/** Run a tx from a button: busy state + toasts; resolves true on success. */
const runTx = async (btn, label, fn, okMsg) => {
  const original = btn.textContent
  btn.disabled = true
  btn.textContent = `${label}…`
  try {
    await fn()
    toast(okMsg, 'success')
    return true
  } catch (e) {
    toast(humanError(e), 'error')
    console.error(e)
    btn.disabled = false
    btn.textContent = original
    return false
  }
}

/** Confirm-and-buy a listing. */
export const openBuy = (l, ctx) =>
  openModal({
    title: 'Buy asset',
    body: `${preview(l)}
      <div class="mp-action-grid">
        <button class="mp-action-btn mp-action-buy" data-go>Buy for ${l.price} OVG</button>
      </div>`,
    onMount: (modal, close) => {
      modal.querySelector('[data-go]').onclick = async (e) => {
        if (await runTx(e.target, 'Buying', () => market.buy(ctx.address, l), 'Purchase complete')) {
          close(); ctx.refresh()
        }
      }
    }
  })

/** List an owned asset for sale (price in OVG). */
export const openList = (a, ctx) =>
  openModal({
    title: 'List for sale',
    body: `${preview(a)}
      ${a.balance > 1 ? `<div class="mp-form-group">
        <label class="mp-form-label">Amount (you own ${a.balance})</label>
        <input class="mp-input" data-amount type="number" min="1" max="${a.balance}" value="1" />
      </div>` : ''}
      <div class="mp-form-group">
        <label class="mp-form-label">Price</label>
        <div class="mp-input-group">
          <input class="mp-input" data-price type="number" min="0" step="0.01" placeholder="0.00" />
          <span class="mp-input-addon">OVG</span>
        </div>
        <p class="mp-form-hint">Approves the marketplace once, then creates the listing.</p>
      </div>
      <div class="mp-action-grid"><button class="mp-action-btn mp-action-buy" data-go>List asset</button></div>`,
    onMount: (modal, close) => {
      modal.querySelector('[data-go]').onclick = async (e) => {
        const price = Number(modal.querySelector('[data-price]').value)
        const amount = a.balance > 1 ? Number(modal.querySelector('[data-amount]').value) : 1
        if (!(price > 0)) return toast('Enter a valid price', 'error')
        if (await runTx(e.target, 'Listing', () => market.list(ctx.address, a.assetId, amount, price), 'Asset listed')) {
          close(); ctx.refresh()
        }
      }
    }
  })

/** Place a global offer (bid) on an asset id. */
export const openOffer = (it, ctx) =>
  openModal({
    title: 'Make an offer',
    body: `${preview(it)}
      <div class="mp-form-group">
        <label class="mp-form-label">Your offer</label>
        <div class="mp-input-group">
          <input class="mp-input" data-price type="number" min="0" step="0.01" placeholder="0.00" />
          <span class="mp-input-addon">OVG</span>
        </div>
        <p class="mp-form-hint">Approves the OVG amount, then places a global bid on the asset id.</p>
      </div>
      <div class="mp-action-grid"><button class="mp-action-btn mp-action-offer mp-action-full" data-go>Place offer</button></div>`,
    onMount: (modal, close) => {
      modal.querySelector('[data-go]').onclick = async (e) => {
        const price = Number(modal.querySelector('[data-price]').value)
        if (!(price > 0)) return toast('Enter a valid amount', 'error')
        if (await runTx(e.target, 'Placing offer', () => market.offer(ctx.address, it.assetId, price), 'Offer placed')) {
          close(); ctx.refresh()
        }
      }
    }
  })

/** Mint a new asset to the active user (requires MINTER_ROLE — see README). */
export const openMint = (ctx) =>
  openModal({
    title: 'Mint asset',
    body: `
      <div class="mp-form-group">
        <label class="mp-form-label">Asset id</label>
        <input class="mp-input" data-id type="number" min="0" placeholder="e.g. 42" />
      </div>
      <div class="mp-form-group">
        <label class="mp-form-label">Amount</label>
        <input class="mp-input" data-amount type="number" min="1" value="1" />
        <p class="mp-form-hint">Minting on the shared OVGrid contract needs MINTER_ROLE. Point dMarket at your own deployment to open it.</p>
      </div>
      <div class="mp-action-grid"><button class="mp-action-btn mp-action-buy" data-go>Mint</button></div>`,
    onMount: (modal, close) => {
      modal.querySelector('[data-go]').onclick = async (e) => {
        const assetId = Number(modal.querySelector('[data-id]').value)
        const amount = Number(modal.querySelector('[data-amount]').value) || 1
        if (!Number.isInteger(assetId) || assetId < 0) return toast('Enter a valid asset id', 'error')
        if (await runTx(e.target, 'Minting', () => market.mint(ctx.address, assetId, amount), 'Minted')) {
          close(); ctx.refresh()
        }
      }
    }
  })

/** Cancel one of the user's listings. */
export const openCancel = (l, ctx) =>
  openModal({
    title: 'Cancel listing',
    body: `${preview(l)}
      <p class="mp-form-hint">This removes your listing from the marketplace on-chain.</p>
      <div class="mp-action-grid"><button class="mp-action-btn mp-action-cancel mp-action-full" data-go>Cancel listing</button></div>`,
    onMount: (modal, close) => {
      modal.querySelector('[data-go]').onclick = async (e) => {
        if (await runTx(e.target, 'Cancelling', () => market.cancel(ctx.address, l.listingId), 'Listing cancelled')) {
          close(); ctx.refresh()
        }
      }
    }
  })

/** Asset detail dialog with Buy + Offer (opened by clicking a card image). */
export const openDetail = (l, ctx) =>
  openModal({
    title: l.title || `Asset #${l.assetId}`,
    body: `${preview(l)}
      ${l.description ? `<p class="mp-form-hint">${escapeHtml(l.description)}</p>` : ''}
      <div class="mp-action-grid">
        <button class="mp-action-btn mp-action-buy" data-buy ${ctx.address ? '' : 'disabled'}>Buy for ${l.price} OVG</button>
        <button class="mp-action-btn mp-action-offer mp-action-full" data-offer ${ctx.address ? '' : 'disabled'}>Make offer</button>
      </div>
      ${ctx.address ? '' : '<p class="mp-form-hint">Connect your identity to trade.</p>'}`,
    onMount: (modal, close) => {
      modal.querySelector('[data-buy]').onclick = async (e) => {
        if (await runTx(e.target, 'Buying', () => market.buy(ctx.address, l), 'Purchase complete')) { close(); ctx.refresh() }
      }
      modal.querySelector('[data-offer]').onclick = () => { close(); openOffer(l, ctx) }
    }
  })

/** Map common ethers/contract errors to a short, human message. */
export const humanError = (e) => {
  const m = (e?.shortMessage || e?.reason || e?.message || '').toLowerCase()
  if (m.includes('insufficient funds')) return 'Not enough POL for gas — use the Amoy faucet.'
  if (m.includes('user rejected')) return 'Transaction rejected.'
  if (m.includes('signing key')) return 'Connect your identity to transact.'
  if (m.includes('erc20insufficientbalance') || m.includes('exceeds balance')) return 'Not enough OVG to pay.'
  if (m.includes('accesscontrol') || m.includes('minter')) return 'Minting needs MINTER_ROLE on the shared contract (see README).'
  return e?.shortMessage || e?.message || 'Transaction failed'
}
