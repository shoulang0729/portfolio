// @ts-check

// ══════════════════════════════════════════════════════════════
// modal.js  ―  自作 confirm/alert モーダル
//
// 依存: なし
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {object} ModalOptions
 * @property {string} title - Modal title
 * @property {string} message - Modal message text
 * @property {string} [okLabel] - OK button label (default: 'OK')
 * @property {string} [cancelLabel] - Cancel button label (default: 'キャンセル')
 */

/**
 * Show confirmation dialog (Promise-based)
 * @param {ModalOptions} options - Modal configuration
 * @returns {Promise<boolean>} true if OK clicked, false if cancelled
 */
export async function showConfirm({ title, message, okLabel = 'OK', cancelLabel = 'キャンセル' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title || '確認';
    header.appendChild(titleEl);
    modal.appendChild(header);

    const body = document.createElement('div');
    body.style.padding = '16px';
    body.style.color = 'var(--text)';
    const msg = document.createElement('p');
    msg.textContent = message || '';
    msg.style.margin = '0 0 16px 0';
    msg.style.lineHeight = '1.5';
    body.appendChild(msg);

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';
    footer.style.paddingTop = '8px';
    footer.style.borderTop = '1px solid var(--border)';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.cssText = 'padding: 8px 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;';
    cancelBtn.onclick = () => { cleanup(); resolve(false); };

    const okBtn = document.createElement('button');
    okBtn.textContent = okLabel;
    okBtn.style.cssText = 'padding: 8px 12px; border: none; background: var(--accent); color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;';
    okBtn.onclick = () => { cleanup(); resolve(true); };

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    body.appendChild(footer);

    modal.appendChild(body);
    overlay.appendChild(modal);

    const cleanup = () => {
      overlay.classList.remove('open');
      document.removeEventListener('keydown', handleEsc);
      overlay.removeEventListener('click', handleOverlay);
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') { cleanup(); resolve(false); }
    };
    const handleOverlay = (e) => {
      if (e.target === overlay) { cleanup(); resolve(false); }
    };

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('click', handleOverlay);

    okBtn.focus();
  });
}

/**
 * Show alert dialog (Promise-based)
 * @param {Omit<ModalOptions, 'cancelLabel'>} options - Modal configuration
 * @returns {Promise<void>}
 */
export async function showAlert({ title, message, okLabel = 'OK' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = title || 'アラート';
    header.appendChild(titleEl);
    modal.appendChild(header);

    const body = document.createElement('div');
    body.style.padding = '16px';
    body.style.color = 'var(--text)';
    const msg = document.createElement('p');
    msg.textContent = message || '';
    msg.style.margin = '0 0 16px 0';
    msg.style.lineHeight = '1.5';
    body.appendChild(msg);

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';
    footer.style.paddingTop = '8px';
    footer.style.borderTop = '1px solid var(--border)';

    const okBtn = document.createElement('button');
    okBtn.textContent = okLabel;
    okBtn.style.cssText = 'padding: 8px 12px; border: none; background: var(--accent); color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;';
    okBtn.onclick = () => { cleanup(); resolve(); };

    footer.appendChild(okBtn);
    body.appendChild(footer);

    modal.appendChild(body);
    overlay.appendChild(modal);

    const cleanup = () => {
      overlay.classList.remove('open');
      document.removeEventListener('keydown', handleEsc);
      overlay.removeEventListener('click', handleOverlay);
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') { cleanup(); resolve(); }
    };
    const handleOverlay = (e) => {
      if (e.target === overlay) { cleanup(); resolve(); }
    };

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.addEventListener('keydown', handleEsc);
    overlay.addEventListener('click', handleOverlay);

    okBtn.focus();
  });
}
