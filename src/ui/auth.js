/**
 * dMarket — identity in the header, built on the GenosDB Security Manager.
 *
 * Logged out → a "Connect identity" button opens a modal to generate or recover
 * a BIP39 identity. Logged in → a wallet button (OVGrid's .mp-wallet-btn) shows
 * the balance + abbreviated address and opens an account modal. The resulting
 * address is BOTH the GenosDB identity and the Polygon wallet (see signer.js).
 */
import { db } from '../db/gdb.js'
import { rememberKey, getAddress } from '../chain/signer.js'
import { NETWORK } from '../chain/config.js'
import { toast } from './toast.js'
import { openModal } from './modal.js'
import { abbr } from './dom.js'

/**
 * Mount the header identity control.
 * @param {HTMLElement} root - the #wallet container.
 * @param {(address:string|null)=>void} onChange - called whenever the session changes.
 * @returns {{ setBalance:(text:string)=>void }}
 */
export const mountAuth = (root, onChange) => {
  let balanceText = ''

  const render = (state) => {
    const active = Boolean(state?.isActive)
    root.innerHTML = active
      ? `<button class="mp-wallet-btn" data-account><span>${balanceText || '—'}</span><span class="mp-wallet-addr">${abbr(state.activeAddress)}</span></button>`
      : '<button class="mp-wallet-btn" data-connect>Connect identity</button>'
    const account = root.querySelector('[data-account]')
    if (account) account.onclick = openAccount
    const connect = root.querySelector('[data-connect]')
    if (connect) connect.onclick = openConnect
  }

  const openConnect = () =>
    openModal({
      title: 'Your identity = your wallet',
      body: `
        <div class="mp-form-group">
          <label class="mp-form-label">Recovery phrase</label>
          <textarea class="mp-textarea mp-input-mono" data-phrase placeholder="Paste a 12-word phrase, or generate a new identity"></textarea>
          <p class="mp-form-hint">One BIP39 key signs both your GenosDB operations and your Polygon transactions — no MetaMask. Fund it with test POL from the <a href="${NETWORK.faucet}" target="_blank" rel="noopener">Amoy faucet</a>.</p>
        </div>
        <div class="mp-action-grid">
          <button class="mp-action-btn mp-action-ghost" data-gen>Generate</button>
          <button class="mp-action-btn mp-action-primary" data-login>Log in</button>
        </div>
        <p class="mp-form-hint mp-text-center">No account needed to browse — connect only to trade.</p>`,
      onMount: (modal, close) => {
        const phrase = modal.querySelector('[data-phrase]')
        modal.querySelector('[data-gen]').onclick = async () => {
          try {
            const id = await db.sm.startNewUserRegistration()
            await db.sm.loginOrRecoverUserWithMnemonic(id.mnemonic)
            rememberKey(id.privateKey)
            phrase.value = id.mnemonic
            phrase.readOnly = true
            toast('Identity created — save your phrase!', 'success')
          } catch (e) { toast(e.message, 'error') }
        }
        modal.querySelector('[data-login]').onclick = async () => {
          const m = phrase.value.trim()
          if (!m) return toast('Paste your recovery phrase first', 'error')
          try {
            const id = await db.sm.loginOrRecoverUserWithMnemonic(m)
            if (!id) throw new Error('Invalid recovery phrase')
            rememberKey(id.privateKey)
            close()
          } catch (e) { toast(e.message, 'error') }
        }
      }
    })

  const openAccount = () =>
    openModal({
      title: 'Account',
      body: `
        <div class="mp-form-group">
          <label class="mp-form-label">Address</label>
          <input class="mp-input mp-input-mono" value="${getAddress() || ''}" readonly />
        </div>
        <div class="mp-form-group">
          <label class="mp-form-label">Balance</label>
          <div class="mp-asset-preview-sub">${balanceText || '—'}</div>
          <p class="mp-form-hint">Need gas? <a href="${NETWORK.faucet}" target="_blank" rel="noopener">Open the Amoy faucet ↗</a></p>
        </div>
        <div class="mp-action-grid"><button class="mp-action-btn mp-action-cancel mp-action-full" data-logout>Log out</button></div>`,
      onMount: (modal, close) => {
        modal.querySelector('[data-logout]').onclick = async () => {
          await db.sm.clearSecurity()
          rememberKey(null)
          close()
        }
      }
    })

  // db.sm's state callback drives the header and the rest of the app.
  db.sm.setSecurityStateChangeCallback((state) => {
    render(state)
    onChange(state?.isActive ? state.activeAddress : null)
  })
  render({ isActive: db.sm.isSecurityActive?.(), activeAddress: getAddress() })

  // Onboarding: greet every visit with the identity modal (the project's headline —
  // "your identity is your wallet") as the initial, centered screen. It stays
  // dismissible: browsing needs no account, so it leads with identity without blocking.
  if (!db.sm.isSecurityActive?.()) openConnect()

  return {
    setBalance: (text) => {
      balanceText = text
      const span = root.querySelector('.mp-wallet-btn span')
      if (span && db.sm.isSecurityActive?.()) span.textContent = text
    }
  }
}
