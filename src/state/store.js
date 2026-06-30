/**
 * dMarket — the single reactive read layer.
 *
 * ONE db.map subscription feeds an in-memory cache and notifies UI subscribers.
 * This is the discipline of every GenosDB example: the UI is a pure function of
 * what db.map streams. Opening several db.map listeners degrades sync — keep ONE.
 */
import { db } from '../db/gdb.js'

const cache = new Map() // node id -> value
const subscribers = new Set() // fn(snapshot)

/** @returns {{listings:object[], owned:object[], offers:object[]}} the current view. */
export const snapshot = () => {
  const all = [...cache.values()].filter(Boolean)
  return {
    listings: all.filter((v) => v.type === 'listing'),
    owned: all.filter((v) => v.type === 'owned'),
    offers: all.filter((v) => v.type === 'offer')
  }
}

const notify = () => {
  const s = snapshot()
  subscribers.forEach((fn) => fn(s))
}

/**
 * Subscribe to view changes. The callback is invoked immediately with the
 * current snapshot, then on every subsequent change.
 * @param {(snapshot:object)=>void} fn
 * @returns {() => void} unsubscribe
 */
export const subscribe = (fn) => {
  subscribers.add(fn)
  fn(snapshot())
  return () => subscribers.delete(fn)
}

/**
 * Start the ONE db.map subscription. Call once at boot. Every mirror write made
 * anywhere (this tab, another tab, or a remote peer) flows through here.
 * @returns {Promise<object>} the db.map subscription handle.
 */
export const start = () =>
  db.map(({ id, value, action }) => {
    if (action === 'removed') cache.delete(id)
    else cache.set(id, value) // added | initial | updated
    notify()
  })
