/**
 * Creates the floating "Add to ERP" button on product pages.
 */

const BUTTON_ID = 'tbs-erp-floating-btn';

export function createFloatingButton(onClick: () => void): HTMLButtonElement {
  // Remove existing button if any
  const existing = document.getElementById(BUTTON_ID);
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.className = 'tbs-erp-float-btn';
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
    <span>Thêm vào ERP</span>
  `;
  btn.title = 'Thêm sản phẩm này vào giỏ hàng ERP';
  btn.addEventListener('click', onClick);

  document.body.appendChild(btn);
  return btn;
}

/** Show success state on the button briefly */
export function showButtonSuccess(btn: HTMLButtonElement): void {
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>Đã thêm!</span>
  `;
  btn.classList.add('tbs-erp-float-btn--success');

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.classList.remove('tbs-erp-float-btn--success');
  }, 2000);
}

/** Show error state on the button briefly */
export function showButtonError(btn: HTMLButtonElement, message: string): void {
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
    <span>${message}</span>
  `;
  btn.classList.add('tbs-erp-float-btn--error');

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.classList.remove('tbs-erp-float-btn--error');
  }, 3000);
}
