/** dMarket — toast notifications, styled like OVGrid's (.mp-toast). */

let container = null
const ensure = () => (container ??= document.getElementById('toasts'))
const ICONS = { info: 'ℹ️', success: '✓', error: '⚠️', warning: '⚠️' }

/**
 * Show a transient toast message.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [kind='info']
 */
export const toast = (message, kind = 'info') => {
  const el = document.createElement('div')
  el.className = `mp-toast mp-toast-${kind}`
  el.innerHTML = `<span class="mp-toast-icon"></span><div class="mp-toast-content"><div class="mp-toast-title"></div></div>`
  el.querySelector('.mp-toast-icon').textContent = ICONS[kind] || ICONS.info
  el.querySelector('.mp-toast-title').textContent = message
  ensure().appendChild(el)
  setTimeout(() => el.classList.add('mp-toast--out'), 3500)
  setTimeout(() => el.remove(), 4000)
}
