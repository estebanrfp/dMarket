/**
 * dMarket — identity → wallet bridge (the heart of the showcase).
 *
 * A GenosDB identity IS an Ethereum account. The Security Manager generates or
 * recovers a BIP39 identity (address + private key); the SAME key that signs P2P
 * database operations signs Polygon transactions. One identity, two worlds — no
 * MetaMask, no separate wallet.
 *
 * Faithful to OVGrid's lib/blockchain/GenosDBSigner.js, but self-contained:
 * dMarket captures the private key returned by the SM at login and builds an
 * `ethers.Wallet` from it on demand.
 */

import { db } from '../db/gdb.js'

// Volatile, in-memory only — never persisted (mirrors SM best practice: the
// mnemonic/key lives only for the session and is forgotten on logout).
let _privateKey = null

/**
 * Remember the active identity's private key. Call right after a successful SM
 * mnemonic login or registration (both return `{ address, privateKey, mnemonic }`).
 * @param {string|null} privateKey - hex private key, or null to forget it.
 */
export const rememberKey = (privateKey) => { _privateKey = privateKey || null }

/** @returns {string|null} The active Ethereum address from the SM, or null. */
export const getAddress = () => db.sm?.getActiveEthAddress?.() ?? null

/** @returns {boolean} True when a key is loaded and on-chain signing is possible. */
export const canSign = () => Boolean(_privateKey)

/**
 * Build an ethers.Signer for the active identity, bound to `provider`.
 * Throws if the session holds no key (e.g. a WebAuthn-only silent resume): on-chain
 * transactions require a mnemonic-backed session that keeps the key in memory.
 *
 * @param {object} ethers - the ethers UMD global.
 * @param {object} provider - an ethers Provider.
 * @returns {object} ethers.Wallet connected to `provider`.
 */
export const getSigner = (ethers, provider) => {
  if (!_privateKey) {
    throw new Error('No signing key in session — log in with your recovery phrase to transact.')
  }
  const wallet = new ethers.Wallet(_privateKey, provider)
  // Sanity check: the derived on-chain wallet MUST equal the GenosDB identity.
  // This is the assertion that makes "one identity, two worlds" verifiable.
  const smAddr = getAddress()
  if (smAddr && wallet.address.toLowerCase() !== smAddr.toLowerCase()) {
    throw new Error('Key/identity mismatch — refusing to sign.')
  }
  return wallet
}
