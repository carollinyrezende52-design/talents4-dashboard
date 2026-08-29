(() => {
  'use strict';

  const SUPABASE_URL = 'https://xcxqtjzlqmncwnhbolnl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjeHF0anpscW1uY3duaGJvbG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTU4NjQsImV4cCI6MjA4OTE3MTg2NH0.TJ1KB6mwSE-wu3EBO8UfP7br6byIloDsr0ejJ4_3luc';
  const PAGE_SIZE = 1000;
  const ALLOWED_ROLES = new Set(['admin', 'recrutador', 'viewer']);
  const WRITER_ROLES = new Set(['admin', 'recrutador']);
  const TABLES = Object.freeze({
    contacts: 'contact_records',
    categories: 'contact_categories',
    contactCategories: 'contact_record_categories',
    relationships: 'contact_relationships',
    interactions: 'contact_interactions',
    followups: 'contact_followups',
    users: 'usuarios'
  });

  const state = {
    session: null,
    profile: null,
    role: 'none',
    canWrite: false,
    view: 'all',
    contacts: [],
    categories: [],
    contactCategories: [],
    followups: [],
    users: [],
    selectedId: null,
    selectedDetails: { interactions: [], followups: [], relationships: [] },
    duplicates: [],
    loading: false,
    reloadQueued: false,
    detailRequest: 0,
    realtimeChannel: null,
    realtimeTimer: 0,
    duplicateTimer: 0,
    toastTimer: 0
  };

  const supa = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const $ = id => document.getElementById(id);
  const text = value => String(value ?? '').trim();
  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#64748B';
  const normalizeText = value => text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const normalizeEmail = value => text(value).toLowerCase();
  const normalizePhone = value => text(value).replace(/\D/g, '');
  const initials = value => text(value).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  const contactById = id => state.contacts.find(contact => contact.id === id) || null;
  const categoryById = id => state.categories.find(category => category.id === id) || null;
  const activeCategories = () => state.categories.filter(category => category.is_active);
  const isArchived = contact => Boolean(contact.archived_at) || contact.status === 'Arquivado';

  function localProfile() {
    try {
      return JSON.parse(sessionStorage.getItem('t4_session') || 'null');
    } catch {
      return null;
    }
  }

  function roleLabel(role) {
    if (role === 'admin') return 'Administrador';
    if (role === 'recrutador') return 'Recrutador';
    if (role === 'viewer') return 'Visualizador';
    return 'Sem acesso';
  }

  function setSync(mode, label) {
    const dot = $('contacts-sync-dot');
    if (dot) dot.className = `contacts-sync-dot${mode ? ` ${mode}` : ''}`;
    if ($('contacts-sync-label')) $('contacts-sync-label').textContent = label;
  }

  function toast(message, type = '') {
    const element = $('contacts-toast');
    if (!element) return;
    clearTimeout(state.toastTimer);
    element.textContent = message;
    element.className = `contacts-toast show${type ? ` ${type}` : ''}`;
    state.toastTimer = window.setTimeout(() => {
      element.className = 'contacts-toast';
    }, 3600);
  }

  function showSetupError(error) {
    const alert = $('contacts-setup-alert');
    const message = $('contacts-setup-message');
    if (!alert || !message) return;
    alert.hidden = false;
    const missing = ['42P01', 'PGRST205', 'PGRST204'].includes(error?.code)
      || /contact_records|schema cache|does not exist/i.test(error?.message || '');
    message.textContent = missing
      ? 'Execute primeiro a pré-checagem e a migration do módulo de contatos.'
      : `Não foi possível ler o módulo: ${error?.message || 'erro desconhecido'}`;
  }

  function clearSetupError() {
    if ($('contacts-setup-alert')) $('contacts-setup-alert').hidden = true;
  }

  function formatDate(value, withTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' }).format(date);
  }

  function toLocalInput(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function toIso(localValue) {
    if (!localValue) return null;
    const date = new Date(localValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function slugify(value) {
    return normalizeText(value).replace(/\s+/g, '-').slice(0, 80);
  }

  function dateBucket(value) {
    const date = new Date(value);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);
    if (date < start) return 'overdue';
    if (date < end) return 'today';
    return 'upcoming';
  }

  async function fetchAll(factory) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const response = await factory(from, from + PAGE_SIZE - 1);
      if (response.error) throw response.error;
      const page = response.data || [];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  async function requireSession() {
    if (!supa) throw new Error('Biblioteca do Supabase indisponível.');
    const { data, error } = await supa.auth.getSession();
    if (error || !data?.session) {
      location.replace('index.html');
      return false;
    }

    state.session = data.session;
    state.profile = localProfile() || {};
    const roleResponse = await supa.rpc('current_app_role');
    const remoteRole = String(roleResponse.data || '').toLowerCase();
    const localRole = String(state.profile.role || '').toLowerCase();
    state.role = ALLOWED_ROLES.has(remoteRole) ? remoteRole : (ALLOWED_ROLES.has(localRole) ? localRole : 'none');
    state.canWrite = WRITER_ROLES.has(state.role);

    if (state.role === 'none') {
      throw new Error('Seu usuário não possui um perfil ativo autorizado para este módulo.');
    }

    const metadata = data.session.user.user_metadata || {};
    const emailName = (data.session.user.email || '').split('@')[0];
    const name = text(state.profile.nome || metadata.name || metadata.username || state.profile.user || emailName || 'Usuário');
    $('contacts-user-name').textContent = name;
    $('contacts-user-role').textContent = roleLabel(state.role);
    $('contacts-user-avatar').textContent = initials(name).slice(0, 1);
    applyWriteAccess();
    return true;
  }

  function applyWriteAccess() {
    [
      'contacts-new-btn', 'contacts-empty-new-btn', 'contacts-category-btn',
      'detail-interaction-btn', 'detail-followup-btn', 'detail-edit-btn', 'detail-archive-btn',
      'detail-followup-inline-btn', 'detail-relationship-btn', 'detail-interaction-inline-btn',
      'contact-quick-category-btn'
    ].forEach(id => {
      const element = $(id);
      if (element) element.hidden = !state.canWrite;
    });
  }

  async function loadCore({ silent = false } = {}) {
    if (state.loading) {
      state.reloadQueued = true;
      return;
    }
    state.loading = true;
    if (!silent) setSync('loading', 'sincronizando...');

    try {
      const [contacts, categories, contactCategories, followups, usersResponse] = await Promise.all([
        fetchAll((from, to) => supa.from(TABLES.contacts).select('*').order('display_name').range(from, to)),
        fetchAll((from, to) => supa.from(TABLES.categories).select('*').order('sort_order').order('name').range(from, to)),
        fetchAll((from, to) => supa.from(TABLES.contactCategories).select('*').range(from, to)),
        fetchAll((from, to) => supa.from(TABLES.followups).select('*').eq('status', 'Pendente').order('due_at').range(from, to)),
        supa.from(TABLES.users).select('username,nome,role,ativo').order('nome').limit(1000)
      ]);

      state.contacts = contacts;
      state.categories = categories;
      state.contactCategories = contactCategories;
      state.followups = followups;
      state.users = usersResponse.error ? [] : (usersResponse.data || []);
      state.duplicates = buildDuplicatePairs(contacts);
      clearSetupError();
      refreshFilterOptions();
      renderAll();
      setSync('', `sincronizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`);
    } catch (error) {
      console.error('[T4 Contatos] loadCore:', error);
      showSetupError(error);
      setSync('error', 'falha na sincronização');
      renderAll();
    } finally {
      state.loading = false;
      if (state.reloadQueued) {
        state.reloadQueued = false;
        loadCore({ silent: true });
      }
    }
  }

  function categoriesFor(contactId) {
    const ids = new Set(state.contactCategories.filter(link => link.contact_id === contactId).map(link => link.category_id));
    return state.categories.filter(category => ids.has(category.id));
  }

  function organizationName(contact) {
    return contact.primary_organization_id ? (contactById(contact.primary_organization_id)?.display_name || '') : '';
  }

  function ownerOptions() {
    const options = new Map();
    state.users.forEach(user => {
      if (String(user.ativo || '').toUpperCase() === 'NAO' || user.ativo === false) return;
      const username = text(user.username);
      if (username) options.set(username, text(user.nome || username));
    });
    state.contacts.forEach(contact => {
      const username = text(contact.owner_username);
      if (username && !options.has(username)) options.set(username, username);
    });
    const localUsername = text(state.profile?.user || state.profile?.username);
    if (localUsername && !options.has(localUsername)) options.set(localUsername, text(state.profile?.nome || localUsername));
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }

  function refreshFilterOptions() {
    const selectedCategory = $('contacts-category-filter').value;
    $('contacts-category-filter').innerHTML = '<option value="">Todas as categorias</option>'
      + activeCategories().map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
    $('contacts-category-filter').value = selectedCategory;

    const selectedOwner = $('contacts-owner-filter').value;
    $('contacts-owner-filter').innerHTML = '<option value="">Todos os responsáveis</option>'
      + ownerOptions().map(([username, name]) => `<option value="${escapeHtml(username)}">${escapeHtml(name)}</option>`).join('');
    $('contacts-owner-filter').value = selectedOwner;

    const ownerFields = [$('contact-owner'), $('followup-assigned')];
    ownerFields.forEach(field => {
      const selected = field.value;
      field.innerHTML = '<option value="">Não atribuído</option>'
        + ownerOptions().map(([username, name]) => `<option value="${escapeHtml(username)}">${escapeHtml(name)}</option>`).join('');
      field.value = selected;
    });
  }

  function buildDuplicatePairs(contacts) {
    const active = contacts.filter(contact => !isArchived(contact));
    const indexes = { email: new Map(), phone: new Map(), name: new Map() };
    const add = (map, key, contact) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(contact);
    };

    active.forEach(contact => {
      [contact.email, contact.secondary_email].map(normalizeEmail).filter(Boolean).forEach(key => add(indexes.email, key, contact));
      [contact.phone, contact.whatsapp].map(normalizePhone).filter(key => key.length >= 8).forEach(key => add(indexes.phone, key, contact));
      const nameKey = `${contact.entity_type}|${normalizeText(contact.display_name)}`;
      if (normalizeText(contact.display_name).length >= 5) add(indexes.name, nameKey, contact);
    });

    const pairs = new Map();
    const collect = (map, reason) => {
      map.forEach(group => {
        if (group.length < 2) return;
        for (let left = 0; left < group.length; left += 1) {
          for (let right = left + 1; right < group.length; right += 1) {
            if (group[left].id === group[right].id) continue;
            const ids = [group[left].id, group[right].id].sort();
            const key = ids.join('|');
            if (!pairs.has(key)) pairs.set(key, { left: contactById(ids[0]) || group[left], right: contactById(ids[1]) || group[right], reasons: new Set() });
            pairs.get(key).reasons.add(reason);
          }
        }
      });
    };
    collect(indexes.email, 'mesmo e-mail');
    collect(indexes.phone, 'mesmo telefone');
    collect(indexes.name, 'mesmo nome normalizado');
    return [...pairs.values()].map(pair => ({ ...pair, reasons: [...pair.reasons] }));
  }

  function duplicateMatchesDraft(draft, ignoredId = '') {
    const emails = [normalizeEmail(draft.email), normalizeEmail(draft.secondary_email)].filter(Boolean);
    const phones = [normalizePhone(draft.phone), normalizePhone(draft.whatsapp)].filter(value => value.length >= 8);
    const name = normalizeText(draft.display_name);
    return state.contacts.filter(contact => contact.id !== ignoredId && !isArchived(contact)).map(contact => {
      const reasons = [];
      const existingEmails = [normalizeEmail(contact.email), normalizeEmail(contact.secondary_email)].filter(Boolean);
      const existingPhones = [normalizePhone(contact.phone), normalizePhone(contact.whatsapp)].filter(value => value.length >= 8);
      if (emails.some(value => existingEmails.includes(value))) reasons.push('e-mail igual');
      if (phones.some(value => existingPhones.includes(value))) reasons.push('telefone igual');
      if (name.length >= 5 && contact.entity_type === draft.entity_type && normalizeText(contact.display_name) === name) reasons.push('nome igual');
      return reasons.length ? { contact, reasons } : null;
    }).filter(Boolean);
  }

  function currentFilters() {
    return {
      query: normalizeText($('contacts-search').value),
      type: $('contacts-type-filter').value,
      category: $('contacts-category-filter').value,
      status: $('contacts-status-filter').value,
      owner: $('contacts-owner-filter').value
    };
  }

  function contactMatchesFilters(contact, filters = currentFilters()) {
    if (state.view === 'people' && contact.entity_type !== 'Pessoa') return false;
    if (state.view === 'organizations' && contact.entity_type !== 'Organização') return false;
    if (filters.type && contact.entity_type !== filters.type) return false;
    if (filters.status) {
      if (contact.status !== filters.status) return false;
    } else if (isArchived(contact)) return false;
    if (filters.owner && contact.owner_username !== filters.owner) return false;
    const categoryIds = state.contactCategories.filter(link => link.contact_id === contact.id).map(link => link.category_id);
    if (filters.category && !categoryIds.includes(filters.category)) return false;
    if (!filters.query) return true;
    const haystack = [
      contact.display_name, contact.legal_name, contact.job_title, organizationName(contact),
      contact.email, contact.secondary_email, contact.phone, contact.whatsapp,
      contact.country, contact.city, contact.address_line, contact.source,
      contact.owner_username, contact.notes, ...categoriesFor(contact.id).map(category => category.name)
    ].map(normalizeText).join(' ');
    return haystack.includes(filters.query);
  }

  function filteredContacts() {
    return state.contacts.filter(contact => contactMatchesFilters(contact));
  }

  function renderAll() {
    renderNavigation();
    renderKpis();
    renderMainView();
    renderCategoryManager();
  }

  function renderNavigation() {
    const visible = state.contacts.filter(contact => !isArchived(contact));
    $('nav-all-count').textContent = visible.length;
    $('nav-people-count').textContent = visible.filter(contact => contact.entity_type === 'Pessoa').length;
    $('nav-organizations-count').textContent = visible.filter(contact => contact.entity_type === 'Organização').length;
    $('nav-followups-count').textContent = state.followups.length;
    $('nav-duplicates-count').textContent = state.duplicates.length;
    document.querySelectorAll('[data-contact-view]').forEach(button => {
      const active = button.dataset.contactView === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function renderKpis() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000);
    const staleLimit = Date.now() - 60 * 86400000;
    const active = state.contacts.filter(contact => !isArchived(contact) && ['Ativo', 'A acompanhar'].includes(contact.status));
    $('kpi-active').textContent = active.length;
    $('kpi-today').textContent = state.followups.filter(item => {
      const due = new Date(item.due_at);
      return due >= start && due < end;
    }).length;
    $('kpi-overdue').textContent = state.followups.filter(item => new Date(item.due_at) < start).length;
    $('kpi-stale').textContent = active.filter(contact => !contact.last_interaction_at || new Date(contact.last_interaction_at).getTime() < staleLimit).length;
  }

  function setView(view) {
    state.view = view;
    const copy = {
      all: ['Central de Contatos', 'Agenda e relacionamentos profissionais', 'Todos os contatos'],
      people: ['Pessoas', 'Contatos individuais e seus vínculos profissionais', 'Pessoas'],
      organizations: ['Organizações', 'Empresas, escolas, fornecedores e demais entidades', 'Organizações'],
      followups: ['Próximos contatos', 'Ações pendentes organizadas por prazo', 'Próximos contatos'],
      duplicates: ['Possíveis duplicados', 'Revisão preventiva antes de unificar registros', 'Possíveis duplicados']
    }[view] || [];
    $('contacts-page-title').textContent = copy[0] || 'Central de Contatos';
    $('contacts-page-subtitle').textContent = copy[1] || '';
    $('contacts-list-title').textContent = copy[2] || '';
    renderNavigation();
    renderMainView();
  }

  function renderMainView() {
    const table = $('contacts-table-wrap');
    const followups = $('contacts-followup-list');
    const duplicates = $('contacts-duplicates-list');
    const empty = $('contacts-empty');
    table.hidden = state.view === 'followups' || state.view === 'duplicates';
    followups.hidden = state.view !== 'followups';
    duplicates.hidden = state.view !== 'duplicates';
    empty.hidden = true;

    if (state.view === 'followups') renderFollowups();
    else if (state.view === 'duplicates') renderDuplicates();
    else renderContactsTable();
  }

  function categoryChips(contactId, limit = 3) {
    const categories = categoriesFor(contactId).filter(category => category.is_active);
    if (!categories.length) return '<span class="contacts-chip muted">Sem categoria</span>';
    const visible = categories.slice(0, limit).map(category => `<span class="contacts-chip" style="--chip-color:${safeColor(category.color)}">${escapeHtml(category.name)}</span>`).join('');
    return visible + (categories.length > limit ? `<span class="contacts-chip muted">+${categories.length - limit}</span>` : '');
  }

  function statusClass(status) {
    if (status === 'Arquivado') return 'archived';
    if (status === 'A acompanhar') return 'follow';
    if (status === 'Inativo') return 'inactive';
    return '';
  }

  function dueClass(value) {
    if (!value) return '';
    const bucket = dateBucket(value);
    return bucket === 'overdue' ? 'overdue' : (bucket === 'today' ? 'today' : '');
  }

  function renderContactsTable() {
    const rows = filteredContacts();
    $('contacts-result-count').textContent = rows.length;
    $('contacts-table-body').innerHTML = rows.map(contact => {
      const organization = organizationName(contact);
      const meta = contact.email || contact.phone || contact.whatsapp || 'Sem canal cadastrado';
      return `<tr>
        <td><button type="button" class="contacts-row-button" data-open-contact="${escapeHtml(contact.id)}"><span class="contacts-record"><span class="contacts-record-avatar${contact.entity_type === 'Organização' ? ' organization' : ''}">${escapeHtml(initials(contact.display_name))}</span><span><span class="contacts-record-name">${escapeHtml(contact.display_name)}</span><span class="contacts-record-meta">${escapeHtml(meta)}</span></span></span></button></td>
        <td><div class="contacts-chip-list">${categoryChips(contact.id)}</div></td>
        <td><div class="contacts-cell-primary">${escapeHtml(organization || contact.job_title || contact.entity_type)}</div><div class="contacts-cell-secondary">${escapeHtml(contact.relationship_stage || '—')}</div></td>
        <td><div class="contacts-cell-primary">${escapeHtml(contact.owner_username || 'Não atribuído')}</div></td>
        <td><span class="contacts-cell-date">${escapeHtml(formatDate(contact.last_interaction_at))}</span><div class="contacts-cell-secondary">${escapeHtml(contact.last_interaction_type || '')}</div></td>
        <td><span class="contacts-cell-date ${dueClass(contact.next_followup_at)}">${escapeHtml(formatDate(contact.next_followup_at, true))}</span></td>
        <td><span class="contacts-chip status ${statusClass(contact.status)}">${escapeHtml(contact.status)}</span></td>
      </tr>`;
    }).join('');
    $('contacts-empty').hidden = rows.length > 0;
  }

  function filteredFollowups() {
    const filters = currentFilters();
    return state.followups.filter(followup => {
      const contact = contactById(followup.contact_id);
      return contact && contactMatchesFilters(contact, filters);
    });
  }

  function renderFollowups() {
    const items = filteredFollowups();
    $('contacts-result-count').textContent = items.length;
    const groups = [
      ['overdue', 'Atrasados'],
      ['today', 'Hoje'],
      ['upcoming', 'Próximos']
    ];
    $('contacts-followup-list').innerHTML = groups.map(([bucket, title]) => {
      const group = items.filter(item => dateBucket(item.due_at) === bucket);
      if (!group.length) return '';
      return `<div class="contacts-followup-group-title">${title} · ${group.length}</div>` + group.map(item => {
        const contact = contactById(item.contact_id);
        return `<article class="contacts-followup-card ${bucket}">
          <div><div class="contacts-followup-title">${escapeHtml(contact?.display_name || 'Contato indisponível')}</div><div class="contacts-followup-note">${escapeHtml(contact?.entity_type || '')}</div></div>
          <div><div class="contacts-cell-primary">${escapeHtml(item.title)}</div><div class="contacts-followup-note">${escapeHtml(item.notes || 'Sem observações')}</div></div>
          <div><div class="contacts-cell-date ${bucket === 'overdue' ? 'overdue' : bucket === 'today' ? 'today' : ''}">${escapeHtml(formatDate(item.due_at, true))}</div><div class="contacts-followup-note">${escapeHtml(item.assigned_username || 'Não atribuído')} · ${escapeHtml(item.priority)}</div></div>
          <div class="contacts-followup-actions"><button type="button" class="btn btn-ghost" data-open-contact="${escapeHtml(item.contact_id)}">Abrir</button>${state.canWrite ? `<button type="button" class="btn btn-primary" data-complete-followup="${escapeHtml(item.id)}">Concluir</button>` : ''}</div>
        </article>`;
      }).join('');
    }).join('');
    $('contacts-empty').hidden = items.length > 0;
  }

  function renderDuplicates() {
    const query = currentFilters().query;
    const pairs = state.duplicates.filter(pair => {
      if (!query) return true;
      return normalizeText(`${pair.left.display_name} ${pair.right.display_name} ${pair.reasons.join(' ')}`).includes(query);
    });
    $('contacts-result-count').textContent = pairs.length;
    $('contacts-duplicates-list').innerHTML = pairs.map(pair => `<article class="contacts-duplicate-card">
      ${duplicateContactCard(pair.left)}
      ${duplicateContactCard(pair.right)}
      <div><div class="contacts-duplicate-reason">${escapeHtml(pair.reasons.join(' · '))}</div><div class="contacts-followup-actions"><button type="button" class="btn btn-ghost" data-open-contact="${escapeHtml(pair.left.id)}">Abrir primeiro</button><button type="button" class="btn btn-ghost" data-open-contact="${escapeHtml(pair.right.id)}">Abrir segundo</button></div></div>
    </article>`).join('');
    $('contacts-empty').hidden = pairs.length > 0;
  }

  function duplicateContactCard(contact) {
    return `<div class="contacts-record"><span class="contacts-record-avatar${contact.entity_type === 'Organização' ? ' organization' : ''}">${escapeHtml(initials(contact.display_name))}</span><span><span class="contacts-record-name">${escapeHtml(contact.display_name)}</span><span class="contacts-record-meta">${escapeHtml(contact.email || contact.phone || contact.entity_type)}</span></span></div>`;
  }

  function openModal(id) {
    const element = $(id);
    if (!element) return;
    element.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => element.querySelector('input:not([type="hidden"]),select,textarea,button')?.focus(), 20);
  }

  function closeModal(id) {
    const element = $(id);
    if (!element) return;
    element.hidden = true;
    if (![...document.querySelectorAll('.contacts-modal-overlay')].some(modal => !modal.hidden) && !$('contacts-drawer').classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function closeDrawer() {
    state.selectedId = null;
    $('contacts-drawer').classList.remove('open');
    $('contacts-drawer').setAttribute('aria-hidden', 'true');
    $('contacts-drawer-backdrop').hidden = true;
    document.body.style.overflow = '';
  }

  async function openDrawer(contactId) {
    const contact = contactById(contactId);
    if (!contact) return;
    state.selectedId = contactId;
    const requestId = ++state.detailRequest;
    $('contacts-drawer').classList.add('open');
    $('contacts-drawer').setAttribute('aria-hidden', 'false');
    $('contacts-drawer-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    renderDrawer(contact, { loading: true });
    try {
      const [interactions, followups, relationships] = await Promise.all([
        supa.from(TABLES.interactions).select('*').eq('contact_id', contactId).order('occurred_at', { ascending: false }).limit(150),
        supa.from(TABLES.followups).select('*').eq('contact_id', contactId).order('due_at', { ascending: true }).limit(500),
        supa.from(TABLES.relationships).select('*').or(`contact_id.eq.${contactId},related_contact_id.eq.${contactId}`).order('created_at', { ascending: false }).limit(500)
      ]);
      const error = interactions.error || followups.error || relationships.error;
      if (error) throw error;
      if (requestId !== state.detailRequest || state.selectedId !== contactId) return;
      state.selectedDetails = {
        interactions: interactions.data || [],
        followups: followups.data || [],
        relationships: relationships.data || []
      };
      renderDrawer(contact);
    } catch (error) {
      console.error('[T4 Contatos] openDrawer:', error);
      toast(error.message || 'Falha ao carregar detalhes.', 'error');
    }
  }

  function detailItem(label, value) {
    return `<div class="contacts-detail-item"><div class="contacts-detail-label">${escapeHtml(label)}</div><div class="contacts-detail-value">${escapeHtml(value || '—')}</div></div>`;
  }

  function renderDrawer(contact, { loading = false } = {}) {
    $('detail-avatar').textContent = initials(contact.display_name);
    $('detail-avatar').classList.toggle('organization', contact.entity_type === 'Organização');
    $('detail-name').textContent = contact.display_name;
    $('detail-subtitle').textContent = [contact.entity_type, contact.job_title, organizationName(contact)].filter(Boolean).join(' · ');
    $('detail-info').innerHTML = [
      ['E-mail', contact.email], ['Telefone', contact.phone || contact.whatsapp],
      ['Canal preferencial', contact.preferred_channel], ['Local', [contact.city, contact.country].filter(Boolean).join(', ')],
      ['Etapa', contact.relationship_stage], ['Prioridade', contact.priority],
      ['Responsável', contact.owner_username], ['Origem', contact.source],
      ['Última interação', formatDate(contact.last_interaction_at, true)], ['Próxima ação', formatDate(contact.next_followup_at, true)]
    ].map(([label, value]) => detailItem(label, value)).join('');
    $('detail-categories').innerHTML = categoryChips(contact.id, 99);
    $('detail-notes').textContent = contact.notes || 'Nenhuma observação registrada.';
    if (loading) {
      const loadingCopy = '<div class="contacts-detail-empty">Carregando...</div>';
      $('detail-followups').innerHTML = loadingCopy;
      $('detail-relationships').innerHTML = loadingCopy;
      $('detail-timeline').innerHTML = loadingCopy;
      return;
    }
    renderDrawerFollowups(contact);
    renderDrawerRelationships(contact);
    renderDrawerTimeline();
  }

  function renderDrawerFollowups(contact) {
    const items = state.selectedDetails.followups;
    $('detail-followups').innerHTML = items.length ? `<div class="contacts-mini-list">${items.map(item => `<div class="contacts-mini-item">
      <div class="contacts-mini-item-head"><span class="contacts-mini-item-title">${escapeHtml(item.title)}</span><span class="contacts-mini-item-meta">${escapeHtml(formatDate(item.due_at, true))}</span></div>
      <div class="contacts-mini-item-note">${escapeHtml(item.status)} · ${escapeHtml(item.priority)}${item.assigned_username ? ` · ${escapeHtml(item.assigned_username)}` : ''}${item.notes ? `<br>${escapeHtml(item.notes)}` : ''}</div>
      ${state.canWrite && item.status === 'Pendente' ? `<div class="contacts-mini-item-actions"><button type="button" class="btn btn-primary" data-complete-followup="${escapeHtml(item.id)}">Concluir</button><button type="button" class="btn btn-ghost" data-edit-followup="${escapeHtml(item.id)}">Editar</button></div>` : ''}
    </div>`).join('')}</div>` : '<div class="contacts-detail-empty">Nenhuma ação programada.</div>';
    $('detail-followup-btn').dataset.contactId = contact.id;
    $('detail-followup-inline-btn').dataset.contactId = contact.id;
  }

  function renderDrawerRelationships(contact) {
    const items = state.selectedDetails.relationships.map(relationship => {
      const otherId = relationship.contact_id === contact.id ? relationship.related_contact_id : relationship.contact_id;
      return { relationship, other: contactById(otherId) };
    }).filter(item => item.other);
    if (contact.primary_organization_id && !items.some(item => item.other.id === contact.primary_organization_id)) {
      const primary = contactById(contact.primary_organization_id);
      if (primary) items.unshift({ relationship: { relationship_label: 'Organização principal', is_primary: true }, other: primary });
    }
    $('detail-relationships').innerHTML = items.length ? `<div class="contacts-mini-list">${items.map(({ relationship, other }) => `<button type="button" class="contacts-mini-item contacts-row-button" data-open-contact="${escapeHtml(other.id)}">
      <div class="contacts-mini-item-head"><span class="contacts-mini-item-title">${escapeHtml(other.display_name)}</span><span class="contacts-mini-item-meta">${escapeHtml(other.entity_type)}</span></div>
      <div class="contacts-mini-item-note">${escapeHtml(relationship.relationship_label)}${relationship.is_primary ? ' · principal' : ''}</div>
    </button>`).join('')}</div>` : '<div class="contacts-detail-empty">Nenhum relacionamento vinculado.</div>';
    $('detail-relationship-btn').dataset.contactId = contact.id;
  }

  function renderDrawerTimeline() {
    const items = state.selectedDetails.interactions;
    $('detail-timeline').innerHTML = items.length ? items.map(item => `<article class="contacts-timeline-item">
      <div class="contacts-timeline-type">${escapeHtml(item.interaction_type)}</div>
      <div class="contacts-timeline-title">${escapeHtml(item.subject || item.outcome || 'Interação registrada')}</div>
      <div class="contacts-timeline-summary">${escapeHtml(item.summary)}</div>
      <div class="contacts-timeline-date">${escapeHtml(formatDate(item.occurred_at, true))}</div>
    </article>`).join('') : '<div class="contacts-detail-empty">Nenhuma interação registrada.</div>';
  }

  function resetContactForm(contact = null) {
    $('contact-form').reset();
    $('contact-id').value = contact?.id || '';
    $('contact-modal-title').textContent = contact ? 'Editar contato' : 'Novo contato';
    $('contact-entity-type').value = contact?.entity_type || 'Pessoa';
    $('contact-display-name').value = contact?.display_name || '';
    $('contact-legal-name').value = contact?.legal_name || '';
    $('contact-job-title').value = contact?.job_title || '';
    fillOrganizationSelect(contact?.primary_organization_id || '', contact?.id || '');
    $('contact-email').value = contact?.email || '';
    $('contact-secondary-email').value = contact?.secondary_email || '';
    $('contact-phone').value = contact?.phone || '';
    $('contact-whatsapp').value = contact?.whatsapp || '';
    $('contact-website').value = contact?.website || '';
    $('contact-linkedin').value = contact?.linkedin_url || '';
    $('contact-preferred-channel').value = contact?.preferred_channel || '';
    $('contact-language').value = contact?.language || '';
    $('contact-status').value = contact?.status || 'Ativo';
    $('contact-stage').value = contact?.relationship_stage || 'Novo';
    $('contact-priority').value = contact?.priority || 'Normal';
    $('contact-owner').value = contact?.owner_username || text(state.profile?.user || state.profile?.username);
    $('contact-source').value = contact?.source || '';
    $('contact-retention-review').value = contact?.retention_review_at || '';
    $('contact-country').value = contact?.country || '';
    $('contact-city').value = contact?.city || '';
    $('contact-postal-code').value = contact?.postal_code || '';
    $('contact-address').value = contact?.address_line || '';
    $('contact-notes').value = contact?.notes || '';
    renderCategoryPicker(contact ? categoriesFor(contact.id).map(category => category.id) : []);
    toggleEntityFields();
    renderDraftDuplicates();
  }

  function fillOrganizationSelect(selected = '', ignoredId = '') {
    const organizations = state.contacts.filter(contact => contact.entity_type === 'Organização' && !isArchived(contact) && contact.id !== ignoredId);
    $('contact-primary-organization').innerHTML = '<option value="">Nenhuma</option>' + organizations.map(contact => `<option value="${escapeHtml(contact.id)}">${escapeHtml(contact.display_name)}</option>`).join('');
    $('contact-primary-organization').value = selected;
  }

  function renderCategoryPicker(selectedIds = []) {
    const selected = new Set(selectedIds);
    const categories = activeCategories();
    $('contact-category-picker').innerHTML = categories.length ? categories.map(category => `<label class="contacts-category-option" style="--category-color:${safeColor(category.color)}"><input type="checkbox" value="${escapeHtml(category.id)}"${selected.has(category.id) ? ' checked' : ''}><span>${escapeHtml(category.name)}</span></label>`).join('') : '<span class="contacts-detail-empty">Nenhuma categoria ativa.</span>';
  }

  function selectedCategoryIds() {
    return [...$('contact-category-picker').querySelectorAll('input:checked')].map(input => input.value);
  }

  function contactDraft() {
    return {
      entity_type: $('contact-entity-type').value,
      display_name: text($('contact-display-name').value),
      legal_name: text($('contact-legal-name').value) || null,
      job_title: text($('contact-job-title').value) || null,
      primary_organization_id: $('contact-entity-type').value === 'Pessoa' ? ($('contact-primary-organization').value || null) : null,
      email: text($('contact-email').value) || null,
      secondary_email: text($('contact-secondary-email').value) || null,
      phone: text($('contact-phone').value) || null,
      whatsapp: text($('contact-whatsapp').value) || null,
      website: text($('contact-website').value) || null,
      linkedin_url: text($('contact-linkedin').value) || null,
      preferred_channel: $('contact-preferred-channel').value || null,
      language: text($('contact-language').value) || null,
      status: $('contact-status').value,
      relationship_stage: $('contact-stage').value,
      priority: $('contact-priority').value,
      owner_username: $('contact-owner').value || null,
      source: text($('contact-source').value) || null,
      retention_review_at: $('contact-retention-review').value || null,
      country: text($('contact-country').value) || null,
      city: text($('contact-city').value) || null,
      postal_code: text($('contact-postal-code').value) || null,
      address_line: text($('contact-address').value) || null,
      notes: text($('contact-notes').value) || null
    };
  }

  function renderDraftDuplicates() {
    clearTimeout(state.duplicateTimer);
    state.duplicateTimer = window.setTimeout(() => {
      const draft = contactDraft();
      const ignoredId = $('contact-id').value;
      const matches = duplicateMatchesDraft(draft, ignoredId);
      const alert = $('contact-duplicate-alert');
      alert.hidden = matches.length === 0;
      alert.innerHTML = matches.length ? `<strong>Possível duplicidade encontrada</strong>${matches.slice(0, 4).map(item => `${escapeHtml(item.contact.display_name)} (${escapeHtml(item.reasons.join(', '))})`).join('<br>')}` : '';
    }, 160);
  }

  function toggleEntityFields() {
    const organization = $('contact-entity-type').value === 'Organização';
    document.querySelectorAll('.organization-only').forEach(element => { element.hidden = !organization; });
    document.querySelectorAll('.person-only').forEach(element => { element.hidden = organization; });
  }

  async function reconcileCategories(contactId, desiredIds) {
    const currentIds = state.contactCategories.filter(link => link.contact_id === contactId).map(link => link.category_id);
    const insertIds = desiredIds.filter(id => !currentIds.includes(id));
    const deleteIds = currentIds.filter(id => !desiredIds.includes(id));
    if (deleteIds.length) {
      const response = await supa.from(TABLES.contactCategories).delete().eq('contact_id', contactId).in('category_id', deleteIds);
      if (response.error) throw response.error;
    }
    if (insertIds.length) {
      const response = await supa.from(TABLES.contactCategories).insert(insertIds.map(categoryId => ({ contact_id: contactId, category_id: categoryId })));
      if (response.error) throw response.error;
    }
  }

  async function reconcilePrimaryRelationship(contactId, organizationId) {
    const currentResponse = await supa.from(TABLES.relationships).select('id,related_contact_id,relationship_label,is_primary').eq('contact_id', contactId).eq('is_primary', true);
    if (currentResponse.error) throw currentResponse.error;
    const current = currentResponse.data || [];
    const oldIds = current.filter(item => item.related_contact_id !== organizationId).map(item => item.id);
    if (oldIds.length) {
      const clearResponse = await supa.from(TABLES.relationships).update({ is_primary: false }).in('id', oldIds);
      if (clearResponse.error) throw clearResponse.error;
    }
    if (!organizationId) return;
    const existingResponse = await supa.from(TABLES.relationships)
      .select('id')
      .eq('contact_id', contactId)
      .eq('related_contact_id', organizationId)
      .eq('relationship_label', 'Trabalha em')
      .maybeSingle();
    if (existingResponse.error) throw existingResponse.error;
    const existing = current.find(item => item.related_contact_id === organizationId) || existingResponse.data;
    if (existing) {
      const updateResponse = await supa.from(TABLES.relationships).update({ is_primary: true }).eq('id', existing.id);
      if (updateResponse.error) throw updateResponse.error;
    } else {
      const insertResponse = await supa.from(TABLES.relationships).insert({
        contact_id: contactId,
        related_contact_id: organizationId,
        relationship_label: 'Trabalha em',
        is_primary: true
      });
      if (insertResponse.error && insertResponse.error.code !== '23505') throw insertResponse.error;
    }
  }

  async function saveContact(event) {
    event.preventDefault();
    if (!state.canWrite) return;
    const draft = contactDraft();
    const id = $('contact-id').value;
    if (!draft.display_name) return toast('Informe o nome do contato.', 'warning');
    const duplicateMatches = duplicateMatchesDraft(draft, id);
    if (duplicateMatches.length && !window.confirm(`Encontramos ${duplicateMatches.length} possível(is) duplicidade(s). Deseja salvar mesmo assim?`)) return;
    const button = $('contact-save-btn');
    button.disabled = true;
    try {
      draft.archived_at = draft.status === 'Arquivado' ? (contactById(id)?.archived_at || new Date().toISOString()) : null;
      draft.updated_by = state.session.user.id;
      let savedId = id;
      if (id) {
        const response = await supa.from(TABLES.contacts).update(draft).eq('id', id).select('id').single();
        if (response.error) throw response.error;
      } else {
        const response = await supa.from(TABLES.contacts).insert({ ...draft, created_by: state.session.user.id }).select('id').single();
        if (response.error) throw response.error;
        savedId = response.data.id;
      }
      await reconcileCategories(savedId, selectedCategoryIds());
      await reconcilePrimaryRelationship(savedId, draft.primary_organization_id);
      closeModal('contact-modal');
      await loadCore();
      toast(id ? 'Contato atualizado.' : 'Contato criado.');
      if (state.selectedId === savedId) await openDrawer(savedId);
    } catch (error) {
      console.error('[T4 Contatos] saveContact:', error);
      toast(error.message || 'Falha ao salvar contato.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function openContactModal(id = '') {
    if (!state.canWrite) return;
    const contact = id ? contactById(id) : null;
    resetContactForm(contact);
    openModal('contact-modal');
  }

  function openInteractionModal(contactId) {
    if (!state.canWrite) return;
    const contact = contactById(contactId);
    if (!contact) return;
    $('interaction-form').reset();
    $('interaction-contact-id').value = contactId;
    $('interaction-contact-name').textContent = contact.display_name;
    $('interaction-occurred-at').value = toLocalInput();
    $('interaction-type').value = 'Nota';
    openModal('interaction-modal');
  }

  async function saveInteraction(event) {
    event.preventDefault();
    if (!state.canWrite) return;
    const payload = {
      contact_id: $('interaction-contact-id').value,
      occurred_at: toIso($('interaction-occurred-at').value),
      interaction_type: $('interaction-type').value,
      subject: text($('interaction-subject').value) || null,
      summary: text($('interaction-summary').value),
      outcome: text($('interaction-outcome').value) || null
    };
    if (!payload.summary || !payload.occurred_at) return toast('Preencha data e resumo.', 'warning');
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const response = await supa.from(TABLES.interactions).insert(payload);
      if (response.error) throw response.error;
      closeModal('interaction-modal');
      await loadCore({ silent: true });
      toast('Interação registrada.');
      await openDrawer(payload.contact_id);
    } catch (error) {
      toast(error.message || 'Falha ao registrar interação.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openFollowupModal(contactId, followupId = '') {
    if (!state.canWrite) return;
    const contact = contactById(contactId);
    if (!contact) return;
    const followup = followupId
      ? [...state.followups, ...state.selectedDetails.followups].find(item => item.id === followupId)
      : null;
    $('followup-form').reset();
    $('followup-id').value = followup?.id || '';
    $('followup-contact-id').value = contactId;
    $('followup-modal-title').textContent = followup ? 'Editar ação' : 'Nova ação';
    $('followup-contact-name').textContent = contact.display_name;
    $('followup-title').value = followup?.title || '';
    $('followup-due-at').value = followup ? toLocalInput(followup.due_at) : toLocalInput(new Date(Date.now() + 86400000));
    $('followup-priority').value = followup?.priority || 'Normal';
    $('followup-assigned').value = followup?.assigned_username || text(state.profile?.user || state.profile?.username);
    $('followup-status').value = followup?.status || 'Pendente';
    $('followup-notes').value = followup?.notes || '';
    openModal('followup-modal');
  }

  async function saveFollowup(event) {
    event.preventDefault();
    if (!state.canWrite) return;
    const id = $('followup-id').value;
    const payload = {
      contact_id: $('followup-contact-id').value,
      title: text($('followup-title').value),
      due_at: toIso($('followup-due-at').value),
      priority: $('followup-priority').value,
      assigned_username: $('followup-assigned').value || null,
      status: $('followup-status').value,
      notes: text($('followup-notes').value) || null
    };
    if (!payload.title || !payload.due_at) return toast('Informe a ação e o prazo.', 'warning');
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const response = id
        ? await supa.from(TABLES.followups).update(payload).eq('id', id)
        : await supa.from(TABLES.followups).insert(payload);
      if (response.error) throw response.error;
      closeModal('followup-modal');
      await loadCore({ silent: true });
      toast(id ? 'Ação atualizada.' : 'Ação programada.');
      await openDrawer(payload.contact_id);
    } catch (error) {
      toast(error.message || 'Falha ao salvar ação.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function completeFollowup(id) {
    if (!state.canWrite) return;
    const item = [...state.followups, ...state.selectedDetails.followups].find(followup => followup.id === id);
    if (!item) return;
    try {
      const response = await supa.from(TABLES.followups).update({ status: 'Concluído', completed_at: new Date().toISOString() }).eq('id', id);
      if (response.error) throw response.error;
      await loadCore({ silent: true });
      toast('Ação concluída.');
      if (state.selectedId === item.contact_id) await openDrawer(item.contact_id);
    } catch (error) {
      toast(error.message || 'Falha ao concluir ação.', 'error');
    }
  }

  function openRelationshipModal(contactId) {
    if (!state.canWrite) return;
    const contact = contactById(contactId);
    if (!contact) return;
    $('relationship-form').reset();
    $('relationship-contact-id').value = contactId;
    $('relationship-contact-name').textContent = contact.display_name;
    $('relationship-related-id').innerHTML = '<option value="">Selecionar</option>' + state.contacts
      .filter(item => item.id !== contactId && !isArchived(item))
      .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.display_name)} · ${escapeHtml(item.entity_type)}</option>`).join('');
    openModal('relationship-modal');
  }

  async function saveRelationship(event) {
    event.preventDefault();
    if (!state.canWrite) return;
    const payload = {
      contact_id: $('relationship-contact-id').value,
      related_contact_id: $('relationship-related-id').value,
      relationship_label: text($('relationship-label').value),
      notes: text($('relationship-notes').value) || null
    };
    if (!payload.related_contact_id || !payload.relationship_label) return toast('Selecione o contato e descreva o vínculo.', 'warning');
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const response = await supa.from(TABLES.relationships).insert(payload);
      if (response.error) throw response.error;
      closeModal('relationship-modal');
      toast('Relacionamento vinculado.');
      await openDrawer(payload.contact_id);
    } catch (error) {
      toast(error.code === '23505' ? 'Esse relacionamento já está cadastrado.' : (error.message || 'Falha ao criar vínculo.'), error.code === '23505' ? 'warning' : 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderCategoryManager() {
    const container = $('category-manager-list');
    if (!container) return;
    container.innerHTML = state.categories.map(category => `<div class="contacts-category-row">
      <span class="contacts-category-dot" style="background:${safeColor(category.color)}"></span>
      <span class="contacts-category-name">${escapeHtml(category.name)}</span>
      <span class="contacts-category-meta">${category.is_system ? 'Padrão' : 'Personalizada'} · ${category.is_active ? 'Ativa' : 'Inativa'}</span>
      ${state.canWrite && !category.is_system ? `<button type="button" data-toggle-category="${escapeHtml(category.id)}">${category.is_active ? 'Desativar' : 'Ativar'}</button>` : ''}
    </div>`).join('');
  }

  async function saveCategory(event) {
    event.preventDefault();
    if (!state.canWrite) return;
    const name = text($('category-name').value);
    const slug = slugify(name);
    if (!name || !slug) return toast('Informe uma categoria válida.', 'warning');
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const response = await supa.from(TABLES.categories).insert({ name, slug, color: safeColor($('category-color').value) });
      if (response.error) throw response.error;
      $('category-form').reset();
      $('category-color').value = '#2563EB';
      await loadCore({ silent: true });
      renderCategoryPicker(selectedCategoryIds());
      toast('Categoria adicionada.');
    } catch (error) {
      toast(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : (error.message || 'Falha ao criar categoria.'), error.code === '23505' ? 'warning' : 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function toggleCategory(id) {
    if (!state.canWrite) return;
    const category = categoryById(id);
    if (!category || category.is_system) return;
    try {
      const response = await supa.from(TABLES.categories).update({ is_active: !category.is_active }).eq('id', id);
      if (response.error) throw response.error;
      await loadCore({ silent: true });
      toast(category.is_active ? 'Categoria desativada.' : 'Categoria ativada.');
    } catch (error) {
      toast(error.message || 'Falha ao atualizar categoria.', 'error');
    }
  }

  async function archiveSelected() {
    if (!state.canWrite || !state.selectedId) return;
    const contact = contactById(state.selectedId);
    if (!contact || !window.confirm(`Arquivar “${contact.display_name}”? O registro e seu histórico serão preservados.`)) return;
    try {
      const response = await supa.from(TABLES.contacts).update({ status: 'Arquivado', archived_at: new Date().toISOString() }).eq('id', contact.id);
      if (response.error) throw response.error;
      closeDrawer();
      await loadCore();
      toast('Contato arquivado.');
    } catch (error) {
      toast(error.message || 'Falha ao arquivar contato.', 'error');
    }
  }

  function clearFilters() {
    $('contacts-search').value = '';
    $('contacts-type-filter').value = '';
    $('contacts-category-filter').value = '';
    $('contacts-status-filter').value = '';
    $('contacts-owner-filter').value = '';
    renderMainView();
  }

  function installRealtime() {
    if (!supa || state.realtimeChannel) return;
    let channel = supa.channel('t4-contacts-live');
    Object.values(TABLES).filter(table => table.startsWith('contact_')).forEach(table => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(state.realtimeTimer);
        state.realtimeTimer = window.setTimeout(() => loadCore({ silent: true }), 450);
      });
    });
    state.realtimeChannel = channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSync('error', 'sincronização em tempo real indisponível');
    });
  }

  function bindEvents() {
    document.querySelectorAll('[data-contact-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.contactView)));
    $('contacts-new-btn').addEventListener('click', () => openContactModal());
    $('contacts-empty-new-btn').addEventListener('click', () => openContactModal());
    $('contacts-category-btn').addEventListener('click', () => openModal('category-modal'));
    $('contact-quick-category-btn').addEventListener('click', () => openModal('category-modal'));
    $('contacts-refresh-btn').addEventListener('click', () => loadCore());
    $('contacts-clear-filters').addEventListener('click', clearFilters);
    ['contacts-search', 'contacts-type-filter', 'contacts-category-filter', 'contacts-status-filter', 'contacts-owner-filter'].forEach(id => {
      $(id).addEventListener(id === 'contacts-search' ? 'input' : 'change', renderMainView);
    });
    $('contact-entity-type').addEventListener('change', () => { toggleEntityFields(); renderDraftDuplicates(); });
    ['contact-display-name', 'contact-email', 'contact-secondary-email', 'contact-phone', 'contact-whatsapp'].forEach(id => $(id).addEventListener('input', renderDraftDuplicates));
    $('contact-form').addEventListener('submit', saveContact);
    $('interaction-form').addEventListener('submit', saveInteraction);
    $('followup-form').addEventListener('submit', saveFollowup);
    $('relationship-form').addEventListener('submit', saveRelationship);
    $('category-form').addEventListener('submit', saveCategory);
    $('detail-close-btn').addEventListener('click', closeDrawer);
    $('contacts-drawer-backdrop').addEventListener('click', closeDrawer);
    $('detail-interaction-btn').addEventListener('click', () => openInteractionModal(state.selectedId));
    $('detail-interaction-inline-btn').addEventListener('click', () => openInteractionModal(state.selectedId));
    $('detail-followup-btn').addEventListener('click', () => openFollowupModal(state.selectedId));
    $('detail-followup-inline-btn').addEventListener('click', () => openFollowupModal(state.selectedId));
    $('detail-relationship-btn').addEventListener('click', () => openRelationshipModal(state.selectedId));
    $('detail-edit-btn').addEventListener('click', () => openContactModal(state.selectedId));
    $('detail-archive-btn').addEventListener('click', archiveSelected);
    document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
    document.querySelectorAll('.contacts-modal-overlay').forEach(overlay => overlay.addEventListener('mousedown', event => {
      if (event.target === overlay) closeModal(overlay.id);
    }));
    document.addEventListener('click', event => {
      const open = event.target.closest('[data-open-contact]');
      if (open) openDrawer(open.dataset.openContact);
      const complete = event.target.closest('[data-complete-followup]');
      if (complete) completeFollowup(complete.dataset.completeFollowup);
      const edit = event.target.closest('[data-edit-followup]');
      if (edit) {
        const item = state.selectedDetails.followups.find(followup => followup.id === edit.dataset.editFollowup);
        if (item) openFollowupModal(item.contact_id, item.id);
      }
      const toggle = event.target.closest('[data-toggle-category]');
      if (toggle) toggleCategory(toggle.dataset.toggleCategory);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const openModalElement = [...document.querySelectorAll('.contacts-modal-overlay')].reverse().find(modal => !modal.hidden);
      if (openModalElement) closeModal(openModalElement.id);
      else closeDrawer();
    });
  }

  async function init() {
    bindEvents();
    try {
      const authorized = await requireSession();
      if (!authorized) return;
      await loadCore();
      installRealtime();
    } catch (error) {
      console.error('[T4 Contatos] init:', error);
      showSetupError(error);
      setSync('error', 'acesso indisponível');
      toast(error.message || 'Não foi possível iniciar o módulo.', 'error');
    } finally {
      $('contacts-loading').hidden = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
