(function () {
  'use strict';

  const ICONS = {
    dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>',
    building: '<path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    briefcase: '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 7h18v13H3V7Zm0 5h18M9 12v2h6v-2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    columns: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    archive: '<path d="M3 6h18M5 6v15h14V6M9 10h6M4 3h16v3H4z"/>',
    contact: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="9" r="3"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0M8 3v18"/>',
    people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M17 3.13a4 4 0 0 1 0 7.75"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M14 21h-4"/>',
    merge: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M8 12h8M13 9l3 3-3 3"/>',
    graduation: '<path d="m2 10 10-5 10 5-10 5L2 10Z"/><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
    warning: '<path d="M10.3 2.8 1.9 17a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 2.8a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  const SWITCHES = [
    { id: 'talents', label: 'Talentos', href: './index.html', icon: 'users' },
    { id: 'organization', label: 'Organizacional', href: './organizacional.html', icon: 'building' },
    { id: 'contacts', label: 'Contatos', href: './contatos.html', icon: 'contact' },
    { id: 'german', label: 'Alemão', href: './alemao.html', icon: 'graduation' }
  ];

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attr(value) { return esc(value).replace(/`/g, '&#096;'); }

  function icon(name, className = 't4-icon') {
    const body = ICONS[name] || ICONS.note;
    return `<span class="${attr(className)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
  }

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function term(value) {
    return String(value ?? '')
      .replace(/\bNovo candidato\b/gi, 'Novo Talento')
      .replace(/\bCandidatos\b/g, 'Talentos')
      .replace(/\bcandidatos\b/g, 'Talentos')
      .replace(/\bCandidato\b/g, 'Talento')
      .replace(/\bcandidato\b/g, 'Talento');
  }

  function initials(value) {
    const parts = String(value || '?').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || '?') + (parts.length > 1 ? parts.at(-1)[0] : '');
  }

  function clamp(value, min = 0, max = 100) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  }

  function formatDate(value, includeTime = false) {
    if (!value) return '—';
    const raw = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat('pt-BR', includeTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  function formatRelative(value) {
    if (!value) return 'Sem data';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const diff = date.getTime() - Date.now();
    const abs = Math.abs(diff);
    const unit = abs < 3_600_000 ? 'minute' : abs < 86_400_000 ? 'hour' : 'day';
    const divisor = unit === 'minute' ? 60_000 : unit === 'hour' ? 3_600_000 : 86_400_000;
    return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(Math.round(diff / divisor), unit);
  }

  function debounce(fn, wait = 180) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function badge(label, tone = '') {
    return `<span class="t4-badge ${attr(tone)}"><span class="dot"></span>${esc(term(label || '—'))}</span>`;
  }

  function toneForStatus(status) {
    const value = normalize(status);
    if (/ativo|aprov|conclu|sucesso|pronto|elegivel|confirmado/.test(value)) return 'success';
    if (/critico|atras|reprov|cancel|inativo|bloque|risco alto/.test(value)) return 'danger';
    if (/atencao|pendente|triagem|paus|aguard|medio|planejada/.test(value)) return 'warning';
    if (/curso|entrevista|contato|enviado|agendado/.test(value)) return 'info';
    return '';
  }

  function emptyState(title, copy, actionLabel = '', action = '') {
    const actionHtml = actionLabel
      ? `<button type="button" class="t4-btn primary" data-action="${attr(action)}">${icon('plus')}${esc(actionLabel)}</button>`
      : '';
    return `<div class="t4-empty"><div><span class="t4-empty-icon">${icon('search')}</span><strong>${esc(title)}</strong><p>${esc(copy)}</p>${actionHtml}</div></div>`;
  }

  function pageHead(title, copy, actions = '') {
    return `<div class="t4-page-head"><div class="t4-page-head-copy"><h2>${esc(title)}</h2><p>${esc(copy)}</p></div><div class="t4-page-actions">${actions}</div></div>`;
  }

  function kpi(label, value, note = '', tone = '') {
    return `<article class="t4-kpi ${attr(tone)}"><div class="t4-kpi-label">${esc(label)}</div><div class="t4-kpi-value">${esc(value)}</div><div class="t4-kpi-note">${esc(note)}</div></article>`;
  }

  function field(label, value) {
    return `<div class="t4-detail-field"><div class="t4-detail-label">${esc(label)}</div><div class="t4-detail-value">${value == null || value === '' ? '—' : esc(value)}</div></div>`;
  }

  function closeDrawer() {
    document.querySelector('[data-t4-drawer-backdrop]')?.remove();
    document.querySelector('[data-t4-drawer]')?.remove();
    document.body.style.removeProperty('overflow');
  }

  function openDrawer(options = {}) {
    closeDrawer();
    const backdrop = document.createElement('div');
    backdrop.className = 't4-drawer-backdrop';
    backdrop.dataset.t4DrawerBackdrop = 'true';
    backdrop.addEventListener('click', closeDrawer);
    const drawer = document.createElement('aside');
    drawer.className = 't4-drawer';
    drawer.dataset.t4Drawer = 'true';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', options.title || 'Detalhes');
    drawer.innerHTML = `
      <div class="t4-drawer-head">
        <div class="t4-drawer-heading"><h2>${esc(options.title || 'Detalhes')}</h2><p>${esc(options.subtitle || '')}</p></div>
        <button type="button" class="t4-icon-btn" data-t4-close aria-label="Fechar">${icon('close')}</button>
      </div>
      ${options.actions ? `<div class="t4-drawer-actions">${options.actions}</div>` : ''}
      <div class="t4-drawer-body">${options.body || ''}</div>`;
    drawer.querySelector('[data-t4-close]').addEventListener('click', closeDrawer);
    document.body.append(backdrop, drawer);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawer.querySelector('button, a, input, select, textarea')?.focus());
    return drawer;
  }

  function closeModal() {
    document.querySelector('[data-t4-modal-backdrop]')?.remove();
    document.body.style.removeProperty('overflow');
  }

  function openModal(options = {}) {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 't4-modal-backdrop';
    backdrop.dataset.t4ModalBackdrop = 'true';
    backdrop.innerHTML = `
      <section class="t4-modal ${options.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${attr(options.title || 'Janela')}">
        <div class="t4-modal-head">
          <div class="t4-modal-head-copy"><h2>${esc(options.title || '')}</h2><p>${esc(options.subtitle || '')}</p></div>
          <button type="button" class="t4-icon-btn" data-t4-close aria-label="Fechar">${icon('close')}</button>
        </div>
        <div class="t4-modal-body">${options.body || ''}</div>
        ${options.footer ? `<div class="t4-modal-foot">${options.footer}</div>` : ''}
      </section>`;
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
    backdrop.querySelector('[data-t4-close]').addEventListener('click', closeModal);
    document.body.append(backdrop);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => backdrop.querySelector('input, select, textarea, button')?.focus());
    return backdrop.querySelector('.t4-modal');
  }

  function toast(message, tone = '', timeout = 3600) {
    let stack = document.querySelector('.t4-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 't4-toast-stack';
      document.body.append(stack);
    }
    const node = document.createElement('div');
    node.className = `t4-toast ${tone}`;
    node.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    node.innerHTML = `${icon(tone === 'error' ? 'warning' : tone === 'success' ? 'check' : 'note')}<div>${esc(message)}</div>`;
    stack.append(node);
    setTimeout(() => node.remove(), timeout);
  }

  function confirmAction(options = {}) {
    return new Promise((resolve) => {
      const modal = openModal({
        title: options.title || 'Confirmar ação',
        subtitle: options.subtitle || 'Revise antes de continuar.',
        body: `<div class="t4-alert ${options.danger ? 'error' : 'info'}">${icon(options.danger ? 'warning' : 'note')}<div>${esc(options.message || '')}</div></div>`,
        footer: `<button type="button" class="t4-btn" data-answer="no">Cancelar</button><button type="button" class="t4-btn ${options.danger ? 'danger' : 'primary'}" data-answer="yes">${esc(options.confirmLabel || 'Confirmar')}</button>`
      });
      modal.querySelector('[data-answer="no"]').addEventListener('click', () => { closeModal(); resolve(false); });
      modal.querySelector('[data-answer="yes"]').addEventListener('click', () => { closeModal(); resolve(true); });
    });
  }

  function mount(config) {
    const root = document.getElementById('t4-app');
    if (!root) throw new Error('Elemento #t4-app ausente.');
    const moduleId = config.module;
    const views = Array.isArray(config.views) ? config.views : [];
    const validViews = new Set(views.map((view) => view.id));
    const getRequestedView = () => {
      const id = new URLSearchParams(location.search).get('view') || config.defaultView || views[0]?.id;
      return validViews.has(id) ? id : (config.defaultView || views[0]?.id);
    };
    let currentView = getRequestedView();
    const routeListeners = new Set();
    let primaryHandler = null;
    let searchHandler = null;

    document.body.dataset.t4Module = moduleId;
    document.title = `${config.moduleLabel} · Talents 4 V2`;

    root.innerHTML = `
      <div class="t4-app">
        <aside class="t4-sidebar" aria-label="Navegação principal">
          <a class="t4-brand" href="./index.html" aria-label="Talents 4 V2">
            <span class="t4-brand-mark">T4</span>
            <span><span class="t4-brand-name">Talents 4</span><span class="t4-brand-sub">CRM integrado · V2</span></span>
          </a>
          <div class="t4-sidebar-scroll">
            <nav class="t4-nav-section" aria-label="${attr(config.moduleLabel)}">
              <div class="t4-nav-label">${esc(config.moduleLabel)}</div>
              ${views.map((view) => `<button type="button" class="t4-nav-item" data-route="${attr(view.id)}"><span class="t4-nav-icon">${icon(view.icon || 'note', '')}</span><span class="t4-nav-text">${esc(view.label)}</span><span class="t4-nav-count" data-count="${attr(view.id)}" hidden></span></button>`).join('')}
            </nav>
            <nav class="t4-nav-section" aria-label="Alternar módulo">
              <div class="t4-nav-label">Áreas do sistema</div>
              ${SWITCHES.map((item) => `<a class="t4-switch-item ${item.id === moduleId ? 'active' : ''}" href="${attr(item.href)}"><span class="t4-switch-icon">${icon(item.icon, '')}</span><span class="t4-nav-text">${esc(item.label)}</span></a>`).join('')}
            </nav>
          </div>
          <div class="t4-sidebar-footer">
            <div class="t4-user">
              <span class="t4-avatar" data-user-initials>?</span>
              <span><span class="t4-user-name" data-user-name>Validando sessão…</span><span class="t4-user-role" data-user-role>Supabase</span></span>
              <button type="button" class="t4-btn ghost sm" data-logout aria-label="Sair">${icon('logout')}</button>
            </div>
          </div>
        </aside>
        <button type="button" class="t4-mobile-overlay" aria-label="Fechar menu"></button>
        <main class="t4-main">
          <header class="t4-topbar">
            <button type="button" class="t4-icon-btn t4-mobile-menu" data-menu aria-label="Abrir menu">${icon('menu')}</button>
            <div class="t4-topbar-heading"><div class="t4-eyebrow">${esc(config.moduleLabel)}</div><h1 class="t4-page-title" data-page-title></h1><p class="t4-page-subtitle" data-page-subtitle></p></div>
            <div class="t4-topbar-spacer"></div>
            <label class="t4-global-search" aria-label="Busca nesta área">${icon('search')}<input type="search" data-global-search placeholder="${attr(config.searchPlaceholder || 'Buscar…')}"><span class="t4-keycap">/</span></label>
            <span class="t4-sync loading" data-sync><span class="t4-sync-dot"></span><span data-sync-label>Conectando</span></span>
            <button type="button" class="t4-btn primary" data-primary hidden>${icon('plus')}<span class="t4-btn-label" data-primary-label>Novo</span></button>
          </header>
          <div class="t4-content" id="t4-page-root"><div class="t4-loading-page"><div class="t4-skeleton"></div><div class="t4-skeleton"></div><div class="t4-skeleton"></div><div class="t4-skeleton"></div></div></div>
        </main>
      </div>`;

    const pageRoot = root.querySelector('#t4-page-root');
    const search = root.querySelector('[data-global-search]');
    const primary = root.querySelector('[data-primary]');

    function renderRoute(options = {}) {
      const view = views.find((item) => item.id === currentView) || views[0];
      root.querySelectorAll('[data-route]').forEach((item) => item.classList.toggle('active', item.dataset.route === currentView));
      root.querySelector('[data-page-title]').textContent = view?.title || view?.label || '';
      root.querySelector('[data-page-subtitle]').textContent = view?.subtitle || config.subtitle || '';
      if (options.notify !== false) routeListeners.forEach((listener) => listener(currentView, view));
      document.body.classList.remove('t4-sidebar-open');
    }

    function route(viewId, options = {}) {
      if (!validViews.has(viewId)) return;
      currentView = viewId;
      const url = new URL(location.href);
      url.searchParams.set('view', viewId);
      history[options.replace ? 'replaceState' : 'pushState']({ view: viewId }, '', url);
      renderRoute();
    }

    root.querySelectorAll('[data-route]').forEach((item) => item.addEventListener('click', () => route(item.dataset.route)));
    root.querySelector('[data-menu]').addEventListener('click', () => document.body.classList.toggle('t4-sidebar-open'));
    root.querySelector('.t4-mobile-overlay').addEventListener('click', () => document.body.classList.remove('t4-sidebar-open'));
    root.querySelector('[data-logout]').addEventListener('click', () => document.dispatchEvent(new CustomEvent('t4:logout')));
    primary.addEventListener('click', () => primaryHandler?.());
    search.addEventListener('input', debounce(() => searchHandler?.(search.value), 160));
    window.addEventListener('popstate', () => { currentView = getRequestedView(); renderRoute(); });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
        closeModal();
        document.body.classList.remove('t4-sidebar-open');
      }
      if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        search.focus();
      }
    });

    renderRoute({ notify: false });

    return {
      module: moduleId,
      pageRoot,
      get view() { return currentView; },
      route,
      onRoute(listener) { routeListeners.add(listener); return () => routeListeners.delete(listener); },
      refreshRoute() { renderRoute(); },
      setTitle(title, subtitle = '') {
        root.querySelector('[data-page-title]').textContent = title;
        root.querySelector('[data-page-subtitle]').textContent = subtitle;
      },
      setPrimaryAction(label, handler, options = {}) {
        primaryHandler = handler || null;
        primary.hidden = !handler;
        root.querySelector('[data-primary-label]').textContent = label || 'Novo';
        primary.classList.toggle('accent', !!options.accent);
      },
      setSearchHandler(handler, placeholder) {
        searchHandler = handler || null;
        if (placeholder) search.placeholder = placeholder;
      },
      resetSearch() { search.value = ''; searchHandler?.(''); },
      setSync(state = 'ok', label = '') {
        const node = root.querySelector('[data-sync]');
        node.className = `t4-sync ${state === 'ok' ? '' : state}`;
        root.querySelector('[data-sync-label]').textContent = label || ({ ok: 'Sincronizado', loading: 'Sincronizando', error: 'Falha de sincronização' }[state] || state);
      },
      setUser(user = {}) {
        const name = user.name || user.nome || user.email || 'Usuário';
        root.querySelector('[data-user-name]').textContent = name;
        root.querySelector('[data-user-role]').textContent = user.role || user.papel || 'Usuário autenticado';
        root.querySelector('[data-user-initials]').textContent = initials(name).toUpperCase();
      },
      setCounts(counts = {}) {
        Object.entries(counts).forEach(([key, value]) => {
          const node = root.querySelector(`[data-count="${CSS.escape(key)}"]`);
          if (!node) return;
          node.textContent = Number(value) > 99 ? '99+' : String(value ?? '');
          node.hidden = value == null || value === '' || Number(value) === 0;
        });
      }
    };
  }

  window.T4V2 = Object.freeze({
    mount,
    icon,
    esc,
    attr,
    normalize,
    term,
    initials,
    clamp,
    debounce,
    badge,
    toneForStatus,
    formatDate,
    formatRelative,
    emptyState,
    pageHead,
    kpi,
    field,
    openDrawer,
    closeDrawer,
    openModal,
    closeModal,
    toast,
    confirm: confirmAction
  });
})();
