// @ts-check

/**
 * Toggle hamburger menu open/closed state
 * @returns {void}
 */
export function toggleHmMenu() {
  const dropdown = document.getElementById('hm-menu-dropdown');
  const btn = document.getElementById('hm-menu-btn');
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle('open');
  if (btn) { btn.classList.toggle('open', isOpen); btn.setAttribute('aria-expanded', String(isOpen)); }
}

/**
 * Close hamburger menu
 * @returns {void}
 */
export function closeHmMenu() {
  const dropdown = document.getElementById('hm-menu-dropdown');
  const btn = document.getElementById('hm-menu-btn');
  if (!dropdown) return;
  dropdown.classList.remove('open');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}
