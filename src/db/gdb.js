// Single GenosDB instance — dMarket's entire read layer, identity and P2P transport.
//
// This is the whole point of the showcase: ONE peer-to-peer database mirrors a
// live blockchain. The 3-D world OVGrid and this standalone marketplace read the
// same on-chain state the same reactive way — `db.map(query, cb)`. No backend.
//
// Imported from the CDN (the zero-build path used by the other GenosDB examples).
// The Security Manager (sm) and GenosRTC plugins load at runtime from sibling
// .min.js files next to this URL — jsDelivr serves them, so CDN + sm just works.
import { gdb } from 'https://cdn.jsdelivr.net/npm/genosdb@latest/dist/index.min.js'

/** Database id — also the P2P room name. Independent from OVGrid's world room. */
export const GDB_NAME = 'dmarket-v1'

// Bootstrap superadmin = the operator's address (the RBAC root of trust). dMarket
// has no role ladder; `sm` is enabled only so each visitor gets a signing identity
// (which IS their Polygon wallet) and so P2P operations are signed and verified.
const OPERATOR = '0xE5639DfE345F8ab845bEBE63a1C7322F9c6fF5c7'

// Open-write demo roles (same stance as the dSocial example): any guest can write
// the shared mirror, so anyone can reconcile chain state into GenosDB for everyone.
// In production you would bind mirror writes to on-chain ownership via ACLs — see
// the "Trust model" section of the README.
const ROLES = {
  guest: { can: ['read', 'sync', 'write', 'link', 'delete'] }
}

/** The ready GenosDB instance (top-level await initialises it once). */
export const db = await gdb(GDB_NAME, {
  rtc: true, // required by the Security Manager and for P2P sync
  sm: {
    superAdmins: [OPERATOR],
    customRoles: ROLES,
    acls: true // available for the advanced trust model (owner-bound mirror nodes)
  }
})

// Console handle for debugging, matching the other GenosDB examples.
globalThis.db = db

// Release the P2P room only on a real unload (close / reload / navigate away).
addEventListener('beforeunload', () => db.room?.leave?.())
