/** dMarket — reusable modal in OVGrid's style (.mp-modal-overlay / .mp-modal). */

const root = () => document.getElementById('modal-root')

/**
 * Open a modal with a title and body. Closes on ✕, backdrop click, or Escape.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string|HTMLElement} opts.body - markup string or a DOM node.
 * @param {(modal:HTMLElement, close:()=>void)=>void} [opts.onMount] - wire up the body.
 * @returns {{ close: ()=>void }}
 */
export const openModal = ({ title, body, onMount }) => {
  const overlay = document.createElement('div')
  overlay.className = 'mp-modal-overlay'
  overlay.innerHTML = `
    <div class="mp-modal" role="dialog" aria-modal="true">
      <div class="mp-modal-header">
        <h3 class="mp-modal-title"></h3>
        <button class="mp-modal-close" aria-label="Close">×</button>
      </div>
      <div class="mp-modal-body"></div>
    </div>`
  overlay.querySelector('.mp-modal-title').textContent = title
  const bodyEl = overlay.querySelector('.mp-modal-body')
  if (typeof body === 'string') bodyEl.innerHTML = body
  else bodyEl.append(body)

  const close = () => {
    overlay.classList.remove('open')
    document.removeEventListener('keydown', onKey)
    setTimeout(() => overlay.remove(), 300)
  }
  const onKey = (e) => { if (e.key === 'Escape') close() }

  overlay.querySelector('.mp-modal-close').onclick = close
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  document.addEventListener('keydown', onKey)

  root().append(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  onMount?.(overlay.querySelector('.mp-modal'), close)
  return { close }
}
