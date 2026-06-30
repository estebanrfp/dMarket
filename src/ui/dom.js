/** dMarket — tiny shared DOM / formatting helpers. */

/** Abbreviate an Ethereum address (0x1234…abcd). */
export const abbr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

/** Capitalize the first letter. */
export const cap = (s = '') => (s ? s[0].toUpperCase() + s.slice(1) : '')

/** Escape user/chain-provided strings before injecting as HTML. */
export const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** Square placeholder for assets without an image (matches the dark surface). */
export const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#202028"/><text x="50" y="60" font-size="34" text-anchor="middle" fill="#444">◈</text></svg>'
  )

/** Image src with placeholder fallback. */
export const imgSrc = (src) => src || PLACEHOLDER

/** Create an element with optional class and innerHTML. */
export const el = (tag, className, html) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (html != null) node.innerHTML = html
  return node
}
