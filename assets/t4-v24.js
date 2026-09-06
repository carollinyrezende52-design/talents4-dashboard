/* Talents 4 · V2.4 Workbench helpers.
   Sem dependências externas e sem persistência de dados de negócio. */
(function () {
  'use strict';
  const U = window.T4V2;
  const e = U.esc, a = U.attr;

  function savedViews(items = [], current = '') {
    return `<nav class="v24-viewbar" aria-label="Visões salvas da área"><span class="v24-viewbar-label">Visões</span>${items.map((item) => `<button type="button" class="v24-view-btn" data-action="v24-view" data-id="${a(item.id)}" aria-current="${String(item.id) === String(current)}">${item.icon ? U.icon(item.icon) : ''}<span>${e(item.label)}</span>${item.count == null ? '' : `<span class="v24-view-count">${e(item.count)}</span>`}</button>`).join('')}</nav>`;
  }

  function metricStrip(items = []) {
    return `<div class="v24-insight-strip" role="region" aria-label="Indicadores rápidos">${items.map((item) => `<div class="v24-insight ${a(item.tone || '')}"><span>${e(item.label)}</span><strong>${e(item.value ?? '—')}</strong>${item.note ? `<small>${e(item.note)}</small>` : ''}</div>`).join('')}</div>`;
  }

  function addRowPreview() {
    document.addEventListener('click', (event) => {
      const row = event.target.closest?.('.t4-table tbody tr');
      if (!row || row.classList.contains('t4-group-row') || event.target.closest('button,a,input,select,textarea,summary')) return;
      const trigger = row.querySelector('[data-action]');
      if (!trigger || trigger.disabled) return;
      trigger.click();
    });
  }

  function addKeyboardHints() {
    const search = document.querySelector('[data-global-search]');
    if (!search) return;
    search.setAttribute('aria-keyshortcuts', '/');
    document.querySelector('[data-command]')?.setAttribute('aria-keyshortcuts', 'Control+K Meta+K');
  }

  addRowPreview();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addKeyboardHints, { once: true });
  else addKeyboardHints();

  window.T4V24 = Object.freeze({ savedViews, metricStrip });
})();
