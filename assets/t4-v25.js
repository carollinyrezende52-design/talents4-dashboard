/* Talents 4 · V2.5 — comportamento de superfície.
   Sem dependências externas, persistência ou leitura de dados. */
(function () {
  'use strict';
  const U = window.T4V2;
  const e = U.esc, a = U.attr;

  function info(text, tone = '') {
    return `<span class="v25-help ${a(tone)}">${U.icon('note')}${e(text)}</span>`;
  }

  function legend(items = []) {
    return `<div class="v25-legend" role="note" aria-label="Legenda de estados">${items.map((item) => `<span><i class="${a(item.tone || '')}"></i>${e(item.label)}</span>`).join('')}</div>`;
  }

  // Native <details> gives keyboard users the same popover as pointer users;
  // closing another filter when one opens prevents a wall of overlapping menus.
  function bindPopovers() {
    document.addEventListener('toggle', (event) => {
      const current = event.target;
      if (!current.matches?.('details.tw-multiselect[open], details.t4-multi-filter[open], details.t4-columns-menu[open]')) return;
      document.querySelectorAll('details.tw-multiselect[open], details.t4-multi-filter[open], details.t4-columns-menu[open]').forEach((node) => { if (node !== current) node.open = false; });
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target.closest('details.tw-multiselect, details.t4-multi-filter, .t4-columns-menu, .t4-nav-more')) return;
      document.querySelectorAll('details.tw-multiselect[open], details.t4-multi-filter[open], .t4-columns-menu[open]').forEach((node) => { node.open = false; });
    });
  }

  function focusMainOnRoute() {
    document.addEventListener('click', (event) => {
      const route = event.target.closest?.('[data-route]');
      if (!route) return;
      window.setTimeout(() => document.querySelector('#t4-page-root')?.focus({ preventScroll: true }), 0);
    });
  }

  bindPopovers();
  focusMainOnRoute();
  window.T4V25 = Object.freeze({ info, legend });
})();
