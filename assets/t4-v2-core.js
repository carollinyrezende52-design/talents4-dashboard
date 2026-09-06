(function () {
  'use strict';

  // O caminho do logo precisa ser relativo à pasta real de assets, não à
  // página atual: em /demo/*.html não existe /demo/assets/, o pacote de
  // assets vive uma pasta acima. Descobrir o prefixo pelo próprio <script>
  // deste arquivo evita hardcodar "./" e quebrar em qualquer subpasta futura.
  const ASSET_BASE = (() => {
    const src = document.currentScript?.src || '';
    const match = src.match(/^(.*\/)assets\/t4-v2-core\.js(?:\?.*)?$/);
    return match ? match[1] : './';
  })();

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
    folder: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
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
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    command: '<path d="M7 3v4M17 3v4M7 17v4M17 17v4M3 7h4M17 7h4M3 17h4M17 17h4"/><rect x="7" y="7" width="10" height="10" rx="2"/>',
    more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>'
  };

  const SWITCHES = [
    { id: 'talents', label: 'Talentos', href: './index.html', icon: 'users' },
    { id: 'organization', label: 'Organizacional', href: './organizacional.html', icon: 'building' },
    { id: 'contacts', label: 'Contatos', href: './contatos.html', icon: 'contact' },
    { id: 'german', label: 'Alemão', href: './alemao.html', icon: 'graduation' },
    { id: 'documentation', label: 'Documentação', href: './documentacao.html', icon: 'folder' },
    { id: 'settings', label: 'Configurações', href: './configuracoes.html', icon: 'settings' }
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

  // Referência tardia (t4-v2-core.js carrega antes de t4-i18n.js, mas t()
  // só é chamado dentro de mount(), bem depois de todos os scripts rodarem).
  const t = (text) => window.T4I18n?.t ? window.T4I18n.t(text) : text;

  function icon(name, className = 't4-icon') {
    const body = ICONS[name] || ICONS.note;
    return `<span class="${attr(className)}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
  }
  // Ilustração da tela vazia: uma lista com linhas tracejadas (o conteúdo
  // que ainda não apareceu) sob uma lupa (o filtro/busca não encontrou
  // nada) — desenho próprio, no mesmo traço fino dos ícones acima (sem
  // preenchimento, stroke 1.8), não um recorte de biblioteca de
  // ilustração externa. Fica maior que um ícone comum de propósito, para
  // realmente ler como uma ilustração, não um glifo perdido no meio da
  // tela.
  const EMPTY_ILLUSTRATION = '<svg viewBox="0 0 64 64" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="9" width="28" height="36" rx="4"/><path d="M19 20h14M19 27h14M19 34h8" stroke-dasharray="2 4"/><circle cx="43" cy="41" r="9"/><path d="m50 48 6 6"/></svg>';

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
      // Os valores antigos continuam iguais no banco; esta camada só traduz
      // rótulos exibidos na interface para a nomenclatura atual do CRM.
      .replace(/\bPronto para employer\b/gi, 'Pronto para apresentação')
      .replace(/\bEnviado ao employer\b/gi, 'Apresentado ao empregador')
      .replace(/\bEmployer\s*\/\s*Matching\b/gi, 'Correspondência com empregador')
      .replace(/\bEmployer\b/gi, 'Empregador')
      .replace(/\bNovo candidato\b/gi, 'Novo Talento')
      .replace(/\bCandidatos\b/g, 'Talentos')
      .replace(/\bcandidatos\b/g, 'Talentos')
      .replace(/\bCandidato\b/g, 'Talento')
      .replace(/\bcandidato\b/g, 'Talento')
      .replace(/\bemployer\b/gi, 'empregador');
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
    if (!value) return t('Sem data');
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
    if (/critico|atras|reprov|cancel|inativo|bloque|risco alto/.test(value)) return 'danger';
    if (/ativo|aprov|conclu|sucesso|pronto|elegivel|confirmado/.test(value)) return 'success';
    if (/atencao|pendente|triagem|paus|aguard|medio|planejada/.test(value)) return 'warning';
    if (/curso|entrevista|contato|enviado|agendado/.test(value)) return 'info';
    return '';
  }

  function emptyState(title, copy, actionLabel = '', action = '') {
    const actionHtml = actionLabel
      ? `<button type="button" class="t4-btn primary" data-action="${attr(action)}">${icon('plus')}${esc(actionLabel)}</button>`
      : '';
    return `<div class="t4-empty"><div><span class="t4-empty-icon">${EMPTY_ILLUSTRATION}</span><strong>${esc(title)}</strong><p>${esc(copy)}</p>${actionHtml}</div></div>`;
  }

  function pageHead(title, copy, actions = '') {
    return `<div class="t4-page-head"><div class="t4-page-head-copy"><h2>${esc(title)}</h2><p>${esc(copy)}</p></div><div class="t4-page-actions">${actions}</div></div>`;
  }

  function kpi(label, value, note = '', tone = '') {
    const numeric = typeof value === 'number' && Number.isFinite(value);
    return `<article class="t4-kpi ${attr(tone)}"><div class="t4-kpi-label">${esc(label)}</div><div class="t4-kpi-value"${numeric ? ' data-count-up' : ''}>${esc(value)}</div><div class="t4-kpi-note">${esc(note)}</div></article>`;
  }
  // Números "contam" de 0 até o valor real ao entrar na tela — o texto já
  // nasce correto (${esc(value)} acima), então mesmo que isto nunca seja
  // chamado o KPI mostra o número certo, só sem a animação: progressive
  // enhancement, nunca risco de mostrar "0" parado por engano. Não anima
  // se o usuário pediu menos movimento. Contagem por número fixo de
  // quadros, não por relógio — o harness de teste roda vm.createContext()
  // com Date congelado e requestAnimationFrame síncrono (chama a função na
  // hora, sem esperar), então uma versão baseada em Date.now() nunca veria
  // o tempo passar e recursaria para sempre; contar quadros sempre termina.
  function animateCounters(root) {
    // Página começando escondida (aba em segundo plano) nunca dispara
    // requestAnimationFrame em navegador nenhum — sem esta guarda o número
    // ficaria travado em "0" até o usuário voltar para a aba, violando a
    // própria regra de nunca mostrar um valor errado. Pulando a animação
    // neste caso específico, o texto correto (já escrito antes desta
    // função rodar) simplesmente permanece.
    if (!root?.querySelectorAll || document?.hidden || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) return;
    const totalFrames = 24;
    root.querySelectorAll('[data-count-up]').forEach((el) => {
      const target = Number(el.textContent);
      if (!Number.isFinite(target) || target === 0) return;
      el.textContent = '0';
      let frame = 0;
      const step = () => {
        frame++;
        if (frame >= totalFrames) { el.textContent = String(target); return; }
        const eased = 1 - Math.pow(1 - frame / totalFrames, 3);
        el.textContent = String(Math.round(target * eased));
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function field(label, value) {
    if (typeof value === 'boolean') value = value ? t('Sim') : t('Não');
    return `<div class="t4-detail-field"><div class="t4-detail-label">${esc(label)}</div><div class="t4-detail-value">${value == null || value === '' ? '—' : esc(value)}</div></div>`;
  }

  function closeDrawer() {
    const focus = document.querySelector('[data-t4-drawer]')?._returnFocus;
    document.querySelector('[data-t4-drawer-backdrop]')?.remove();
    document.querySelector('[data-t4-drawer]')?.remove();
    document.body.style.removeProperty('overflow');
    if (focus?.isConnected) focus.focus();
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
    drawer.setAttribute('aria-label', options.title || t('Detalhes'));
    drawer._returnFocus = document.activeElement;
    drawer.innerHTML = `
      <div class="t4-drawer-head">
        <div class="t4-drawer-heading"><h2>${esc(options.title || t('Detalhes'))}</h2><p>${esc(options.subtitle || '')}</p></div>
        <button type="button" class="t4-icon-btn" data-t4-close aria-label="${t('Fechar')}">${icon('close')}</button>
      </div>
      ${options.actions ? `<div class="t4-drawer-actions">${options.actions}</div>` : ''}
      <div class="t4-drawer-body">${options.body || ''}</div>`;
    drawer.querySelector('[data-t4-close]').addEventListener('click', closeDrawer);
    drawer.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || document.querySelector('[data-t4-modal-backdrop]')) return;
      const nodes = [...drawer.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter((n) => !n.disabled && n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    document.body.append(backdrop, drawer);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawer.querySelector('button, a, input, select, textarea')?.focus());
    return drawer;
  }

  function closeModal() {
    const node = document.querySelector('[data-t4-modal-backdrop]');
    if (!node) return;
    if (node.dataset.saving === 'true') return;
    if (node.dataset.dirty === 'true' && !window.confirm(t('Há alterações não salvas. Deseja descartá-las?'))) return;
    node._onClose?.();
    node.remove();
    if (!document.querySelector('[data-t4-drawer]')) document.body.style.removeProperty('overflow');
    if (node._returnFocus?.isConnected) node._returnFocus.focus();
  }

  function openModal(options = {}) {
    closeModal();
    if (document.querySelector('[data-t4-modal-backdrop]')) throw new Error('Conclua ou descarte a edição atual antes de abrir outra janela.');
    const backdrop = document.createElement('div');
    backdrop.className = 't4-modal-backdrop';
    backdrop.dataset.t4ModalBackdrop = 'true';
    backdrop._returnFocus = document.activeElement;
    backdrop._onClose = options.onClose;
    backdrop.innerHTML = `
      <section class="t4-modal ${options.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${attr(options.title || t('Janela'))}">
        <div class="t4-modal-head">
          <div class="t4-modal-head-copy"><h2>${esc(options.title || '')}</h2><p>${esc(options.subtitle || '')}</p></div>
          <button type="button" class="t4-icon-btn" data-t4-close aria-label="${t('Fechar')}">${icon('close')}</button>
        </div>
        <div class="t4-modal-body">${options.body || ''}</div>
        ${options.footer ? `<div class="t4-modal-foot">${options.footer}</div>` : ''}
      </section>`;
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
    backdrop.querySelector('[data-t4-close]').addEventListener('click', closeModal);
    document.body.append(backdrop);
    backdrop.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const nodes = [...backdrop.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter((n) => !n.disabled && n.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
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
        onClose: () => resolve(false),
        title: options.title || t('Confirmar ação'),
        subtitle: options.subtitle || t('Revise antes de continuar.'),
        body: `<div class="t4-alert ${options.danger ? 'error' : 'info'}">${icon(options.danger ? 'warning' : 'note')}<div>${esc(options.message || '')}</div></div>`,
        footer: `<button type="button" class="t4-btn" data-answer="no">${t('Cancelar')}</button><button type="button" class="t4-btn ${options.danger ? 'danger' : 'primary'}" data-answer="yes">${esc(options.confirmLabel || t('Confirmar'))}</button>`
      });
      modal.querySelector('[data-answer="no"]').addEventListener('click', () => { closeModal(); resolve(false); });
      modal.querySelector('[data-answer="yes"]').addEventListener('click', () => { resolve(true); closeModal(); });
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
    document.title = `${config.moduleLabel} · Talents 4`;
    // Padrão Notion/Linear: menu lateral recolhível, largura mínima por
    // padrão e expansão automática ao passar o mouse (ver regras de hover
    // em t4-v25.css). Isto é somente uma preferência visual da aba atual —
    // não é dado de negócio e não altera nada no Supabase. Só fica
    // expandida sem precisar do mouse quando o usuário "fixa" isso
    // clicando no botão; essa escolha precisa sobreviver à navegação entre
    // módulos, que troca o documento HTML, sem criar um cache da aplicação.
    const SIDEBAR_STATE_KEY = 't4.sidebar.collapsed';
    const readSidebarCollapsed = () => {
      try { return window.sessionStorage?.getItem(SIDEBAR_STATE_KEY) !== '0'; }
      catch (_) { return true; }
    };
    const writeSidebarCollapsed = (value) => {
      try {
        if (window.sessionStorage) window.sessionStorage.setItem(SIDEBAR_STATE_KEY, value ? '1' : '0');
      } catch (_) { /* preferência visual não pode impedir a inicialização */ }
    };
    let sidebarCollapsed = readSidebarCollapsed();

    const primaryViews = views.filter((view) => view.primary !== false);
    const secondaryViews = views.filter((view) => view.primary === false);
    root.innerHTML = `
      <a class="t4-skip" href="#t4-page-root" data-i18n-text>${t('Ir para o conteúdo')}</a><div class="t4-app">
        <aside class="t4-sidebar" aria-label="Navegação principal">
          <a class="t4-brand" href="./index.html" aria-label="Talents 4">
            <span class="t4-brand-lockup">
              <span class="t4-brand-row">
                <img class="t4-brand-mark" src="${attr(ASSET_BASE)}assets/talents4-mark.png" alt="" aria-hidden="true">
                <span class="t4-brand-name">Talents<span class="t4-brand-accent">4</span></span>
              </span>
              <span class="t4-brand-sub" data-i18n-text>${t('Recrutamento internacional')}</span>
            </span>
          </a>
          <div class="t4-sidebar-scroll">
            <nav class="t4-nav-section" aria-label="${attr(config.moduleLabel)}">
              <div class="t4-nav-label" data-i18n-module-label="${attr(moduleId)}">${esc(config.moduleLabel)}</div>
              ${primaryViews.map((view) => `<button type="button" class="t4-nav-item" data-route="${attr(view.id)}" aria-label="${attr(view.label)}" data-tooltip="${attr(view.label)}"><span class="t4-nav-icon">${icon(view.icon || 'note', '')}</span><span class="t4-nav-text" data-i18n-view="${attr(moduleId)}:${attr(view.id)}">${esc(view.label)}</span><span class="t4-nav-count" data-count="${attr(view.id)}" hidden></span></button>`).join('')}
              ${secondaryViews.length ? `<details class="t4-nav-more" ${secondaryViews.some((view) => view.id === currentView) ? 'open' : ''}><summary aria-label="Mais espaços" data-tooltip="Mais espaços"><span class="t4-nav-icon">${icon('more', '')}</span><span class="t4-nav-text" data-i18n-static="moreSpaces">Mais espaços</span><span class="t4-nav-chevron">${icon('chevron', '')}</span></summary><div>${secondaryViews.map((view) => `<button type="button" class="t4-nav-item" data-route="${attr(view.id)}" aria-label="${attr(view.label)}" data-tooltip="${attr(view.label)}"><span class="t4-nav-icon">${icon(view.icon || 'note', '')}</span><span class="t4-nav-text" data-i18n-view="${attr(moduleId)}:${attr(view.id)}">${esc(view.label)}</span><span class="t4-nav-count" data-count="${attr(view.id)}" hidden></span></button>`).join('')}</div></details>` : ''}
            </nav>
            <nav class="t4-nav-section" aria-label="Alternar módulo">
              <div class="t4-nav-label" data-i18n-static="systemAreas">Áreas do sistema</div>
              ${SWITCHES.map((item) => `<a class="t4-switch-item ${item.id === moduleId ? 'active' : ''}" ${item.id === moduleId ? 'aria-current="page"' : ''} href="${attr(item.href)}" aria-label="${attr(item.label)}" data-tooltip="${attr(item.label)}"><span class="t4-switch-icon">${icon(item.icon, '')}</span><span class="t4-nav-text" data-i18n-switch="${attr(item.id)}">${esc(item.label)}</span>${icon('chevron', 't4-switch-chevron')}</a>`).join('')}
            </nav>
          </div>
          <button type="button" class="t4-sidebar-collapse-toggle" data-sidebar-collapse aria-pressed="false" aria-label="${t('Recolher menu')}" data-tooltip="${t('Recolher menu')}" data-i18n-attrs="aria-label,data-tooltip">${icon('chevron', 't4-icon t4-collapse-icon')}<span class="t4-nav-text" data-i18n-text>${t('Recolher menu')}</span></button>
          <div class="t4-sidebar-footer">
            <div class="t4-user">
              <span class="t4-avatar" data-user-initials>?</span>
              <span><span class="t4-user-name" data-user-name>${t('Validando sessão…')}</span><span class="t4-user-role" data-user-role data-i18n-text>Supabase</span></span>
              <button type="button" class="t4-btn ghost sm" data-logout aria-label="${t('Sair')}" data-i18n-attrs="aria-label">${icon('logout')}</button>
            </div>
          </div>
        </aside>
        <button type="button" class="t4-mobile-overlay" aria-label="${t('Fechar menu')}" data-i18n-attrs="aria-label"></button>
        <main class="t4-main">
          <header class="t4-topbar">
            <button type="button" class="t4-icon-btn t4-mobile-menu" data-menu aria-label="${t('Abrir menu')}" data-i18n-attrs="aria-label">${icon('menu')}</button>
            <div class="t4-topbar-heading"><div class="t4-eyebrow">${esc(config.moduleLabel)}</div><h1 class="t4-page-title" data-page-title></h1><p class="t4-page-subtitle" data-page-subtitle></p></div>
            <div class="t4-topbar-spacer"></div>
            <label class="t4-global-search" aria-label="${t('Busca nesta área')}" data-i18n-attrs="aria-label">${icon('search')}<input type="search" data-global-search placeholder="${attr(config.searchPlaceholder || t('Buscar…'))}" data-i18n-attrs="placeholder"><button type="button" class="t4-search-clear" data-search-clear hidden aria-label="${t('Limpar busca')}" data-i18n-attrs="aria-label">${icon('close')}</button><span class="t4-keycap">/</span></label>
            <button type="button" class="t4-command-trigger" data-command aria-label="${t('Abrir ações rápidas')}" data-i18n-attrs="aria-label">${icon('command')}<span data-i18n-text>${t('Ações')}</span><kbd>⌘K</kbd></button>
            <span class="t4-sync loading" data-sync><span class="t4-sync-dot"></span><span data-sync-label data-i18n-text>${t('Conectando')}</span></span>
            <button type="button" class="t4-btn primary" data-primary hidden>${icon('plus')}<span class="t4-btn-label" data-primary-label data-i18n-text>${t('Novo')}</span></button>
          </header>
          <div class="t4-environment" data-i18n-attrs="title" title="${attr(window.T4_DEMO ? t('Dados fictícios; alterações não são persistidas.') : t('Ambiente de homologação'))}">${icon('eye')}<span data-i18n-text>${window.T4_DEMO ? t('Demonstração') : t('Homologação')}</span></div>
          <div class="t4-content" id="t4-page-root" tabindex="-1"><div class="t4-loading-page"><div class="t4-skeleton"></div><div class="t4-skeleton"></div><div class="t4-skeleton"></div><div class="t4-skeleton"></div></div></div>
        </main>
      </div>`;

    document.body.classList.toggle('t4-sidebar-collapsed', sidebarCollapsed);
    const pageRoot = root.querySelector('#t4-page-root');
    const search = root.querySelector('[data-global-search]');
    const searchClear = root.querySelector('[data-search-clear]');
    const primary = root.querySelector('[data-primary]');
    const command = root.querySelector('[data-command]');
    const collapseToggle = root.querySelector('[data-sidebar-collapse]');
    const syncSidebarToggle = () => {
      const label = sidebarCollapsed ? t('Expandir menu') : t('Recolher menu');
      collapseToggle?.setAttribute('aria-pressed', sidebarCollapsed ? 'true' : 'false');
      collapseToggle?.setAttribute('aria-label', label);
      if (collapseToggle) collapseToggle.dataset.tooltip = label;
    };
    syncSidebarToggle();

    function openCommandPalette() {
      const nav = [...root.querySelectorAll('[data-route]')]
        .filter((node, index, all) => all.findIndex((item) => item.dataset.route === node.dataset.route) === index)
        .slice(0, 12);
      const primaryLabel = root.querySelector('[data-primary-label]')?.textContent?.trim();
      const items = [
        { id: 'search', label: t('Buscar nesta área'), copy: t('Use a busca global para encontrar pessoas, empresas ou ações.'), icon: 'search' },
        ...(primaryLabel && !primary.hidden ? [{ id: 'primary', label: primaryLabel, copy: t('Abrir a criação rápida deste espaço.'), icon: 'plus' }] : []),
        ...nav.map((node) => ({ id: `route:${node.dataset.route}`, label: node.querySelector('.t4-nav-text')?.textContent?.trim() || node.dataset.route, copy: t('Abrir espaço de trabalho'), icon: node.querySelector('.t4-nav-icon .t4-icon') ? 'arrow' : 'note' }))
      ];
      const modal = openModal({
        title: t('Ações rápidas'),
        subtitle: t('Navegue, busque e crie sem perder o contexto.'),
        body: `<div class="v24-command-list" role="menu" aria-label="${t('Ações rápidas')}">${items.map((item, index) => `<button type="button" class="v24-command-item" data-command-item="${attr(item.id)}" role="menuitem"><span class="v24-command-icon">${icon(item.icon)}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.copy)}</small></span><kbd>${index < 9 ? index + 1 : ''}</kbd></button>`).join('')}</div>`,
        footer: `<span class="t4-save-hint">${t('Esc fecha · / vai para a busca')}</span><button type="button" class="t4-btn" data-cancel>${t('Fechar')}</button>`
      });
      modal.querySelector('[data-cancel]')?.addEventListener('click', closeModal);
      modal.querySelectorAll('[data-command-item]').forEach((item) => item.addEventListener('click', () => {
        const value = item.dataset.commandItem;
        closeModal();
        if (value === 'search') { search.focus(); return; }
        if (value === 'primary') { primary.click(); return; }
        if (value.startsWith('route:')) route(value.slice(6));
      }));
      return modal;
    }

    function renderRoute(options = {}) {
      const view = views.find((item) => item.id === currentView) || views[0];
      root.querySelectorAll('[data-route]').forEach((item) => {
        item.classList.toggle('active', item.dataset.route === currentView);
        if (item.dataset.route === currentView) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      root.querySelector('[data-page-title]').textContent = view?.title || view?.label || '';
      root.querySelector('[data-page-subtitle]').textContent = view?.subtitle || config.subtitle || '';
      // Abre "Mais espaços" ao navegar para um item seu, mas a troca de
      // rota nunca o fecha sozinha — só o mouse saindo da lateral fecha
      // (ver listener de mouseleave mais abaixo), para não interromper
      // quem está navegando entre os itens do próprio grupo.
      const more = root.querySelector('.t4-nav-more');
      if (more && secondaryViews.some((item) => item.id === currentView)) more.open = true;
      if (options.notify !== false) {
        routeListeners.forEach((listener) => listener(currentView, view));
        animatePageEnter();
      }
      document.body.classList.remove('t4-sidebar-open');
    }

    // Transição suave ao trocar de página: os módulos escrevem o HTML novo
    // em pageRoot de forma síncrona dentro dos listeners acima (cada um com
    // seu próprio render()), então quando chegamos aqui o conteúdo já é o
    // novo — a entrada anima o resultado já trocado (fade + leve subida),
    // não uma troca coreografada entre o conteúdo antigo e o novo. Reinicia
    // a animação removendo e recolocando a classe com um reflow forçado no
    // meio (senão o navegador não percebe que é "de novo" a mesma classe).
    // Nunca em aba oculta (rAF nunca dispararia) nem com menos movimento.
    function animatePageEnter() {
      if (document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      pageRoot.classList.remove('t4-page-enter');
      void pageRoot.offsetWidth;
      pageRoot.classList.add('t4-page-enter');
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
    collapseToggle.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      document.body.classList.toggle('t4-sidebar-collapsed', sidebarCollapsed);
      writeSidebarCollapsed(sidebarCollapsed);
      syncSidebarToggle();
      // Sem isto, o botão fica focado após o clique e a lateral recolhida
      // se expande de novo sozinha (:focus-within), como se o hover nunca
      // tivesse terminado — o recolher pareceria não ter efeito nenhum.
      if (sidebarCollapsed) collapseToggle.blur();
    });
    // "Mais espaços" não fecha sozinho ao trocar de página dentro da
    // lateral (pedido explícito), mas também não pode ficar aberto para
    // sempre: quando o ponteiro sai de perto da lateral/flyout de verdade
    // — sinal de que o usuário já terminou de usá-la —, ele recolhe.
    // Isto NÃO usa mouseenter/mouseleave/focusout da lateral: clicar em um
    // item do próprio flyout troca a rota, o que move o foco para o
    // conteúdo principal por acessibilidade (focusMainOnRoute, em
    // t4-v25.js) e re-renderiza esse conteúdo — navegadores reavaliam o
    // que está sob o ponteiro PARADO e o foco após essa mudança de DOM,
    // disparando mouseleave/focusout reais mesmo sem o usuário ter saído
    // de verdade, o que fecharia o menu bem na hora de clicar nele. Em vez
    // disso, cada mousemove real verifica a posição atual contra a
    // lateral e o flyout diretamente; uma mutação de DOM sem o mouse se
    // mover não gera mousemove, então não derruba o menu por engano.
    const sidebarEl = root.querySelector('.t4-sidebar');
    let moreCloseTimer = null;
    const pointInRect = (x, y, rect) => rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    document.addEventListener('mousemove', (event) => {
      const more = root.querySelector('.t4-nav-more');
      if (!more || !more.open) return;
      const flyout = more.querySelector(':scope > div');
      const inside = pointInRect(event.clientX, event.clientY, sidebarEl.getBoundingClientRect())
        || pointInRect(event.clientX, event.clientY, flyout?.getBoundingClientRect());
      clearTimeout(moreCloseTimer);
      if (!inside) moreCloseTimer = setTimeout(() => { more.open = false; }, 220);
    });
    // Abre "Mais espaços" ao passar o mouse no próprio rótulo, sem
    // precisar clicar (pedido explícito). mouseenter não sofre o mesmo
    // problema do fechamento acima porque só dispara com movimento real
    // do ponteiro entrando no elemento — nunca como efeito colateral de
    // uma troca de rota.
    const moreSummaryEl = root.querySelector('.t4-nav-more > summary');
    moreSummaryEl?.addEventListener('mouseenter', () => {
      const more = root.querySelector('.t4-nav-more');
      if (more) more.open = true;
    });
    // O <summary> nativo alterna aberto/fechado a cada clique — depois que
    // o hover já abriu, um clique do mouse (que normalmente segue o
    // próprio hover) fecharia de novo na hora, brigando com o hover. Para
    // clique de mouse, ignora o toggle nativo e força aberto (fechar é só
    // por onde o mouse sai, no listener acima). Ativação por teclado
    // (Enter/Espaço) tem event.detail === 0 e continua alternando como
    // qualquer <details>, preservando a navegação sem mouse.
    moreSummaryEl?.addEventListener('click', (event) => {
      if (event.detail === 0) return;
      event.preventDefault();
      const more = root.querySelector('.t4-nav-more');
      if (more) more.open = true;
    });
    root.querySelector('.t4-mobile-overlay').addEventListener('click', () => document.body.classList.remove('t4-sidebar-open'));
    root.querySelector('[data-logout]').addEventListener('click', () => document.dispatchEvent(new CustomEvent('t4:logout')));
    primary.addEventListener('click', async () => {
      try { await primaryHandler?.(); }
      catch (error) { toast(error?.message || t('Não foi possível abrir esta ação. Atualize a tela.'), 'error', 6500); }
    });
    command?.addEventListener('click', openCommandPalette);
    const syncSearchClear = () => { if (searchClear) searchClear.hidden = !String(search.value || '').trim(); };
    const dispatchSearch = () => { syncSearchClear(); searchHandler?.(search.value); };
    search.addEventListener('input', debounce(dispatchSearch, 160));
    search.addEventListener('search', dispatchSearch);
    searchClear?.addEventListener('click', () => { search.value = ''; dispatchSearch(); search.focus(); });
    syncSearchClear();
    window.addEventListener('popstate', () => { currentView = getRequestedView(); renderRoute(); });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (document.querySelector('[data-t4-modal-backdrop]')) closeModal();
        else closeDrawer();
        document.body.classList.remove('t4-sidebar-open');
      }
      if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
        event.preventDefault();
        search.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommandPalette();
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
        search.closest('label').hidden = !handler;
        if (placeholder) search.placeholder = placeholder;
        syncSearchClear();
      },
      resetSearch() { search.value = ''; dispatchSearch(); },
      setSync(state = 'ok', label = '') {
        const node = root.querySelector('[data-sync]');
        node.className = `t4-sync ${state === 'ok' ? '' : state}`;
        root.querySelector('[data-sync-label]').textContent = label || ({ ok: t('Sincronizado'), loading: t('Sincronizando'), error: t('Falha de sincronização') }[state] || state);
      },
      setUser(user = {}) {
        const name = user.name || user.nome || user.email || t('Usuário');
        root.querySelector('[data-user-name]').textContent = name;
        root.querySelector('[data-user-role]').textContent = user.role || user.papel || t('Usuário autenticado');
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
    animateCounters,
    field,
    openDrawer,
    closeDrawer,
    openModal,
    closeModal,
    toast,
    confirm: confirmAction
  });
})();
