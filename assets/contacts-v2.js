(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data, R = window.T4Records;
  const e = U.esc, a = U.attr;
  const app = U.mount({ module: 'contacts', moduleLabel: 'Contatos', defaultView: 'all', views: [
    { id: 'all', label: 'Agenda profissional', subtitle: 'Todos os relacionamentos da Talents 4, organizados e conectados.', icon: 'contact' },
    { id: 'people', label: 'Pessoas', subtitle: 'Talentos, professores, funcionários e parceiros.', icon: 'people' },
    { id: 'organizations', label: 'Organizações', subtitle: 'Empregadores, fornecedores e demais organizações.', icon: 'building' },
    { id: 'followups', label: 'Próximos passos', subtitle: 'Próximos passos, prazos e responsáveis.', icon: 'bell' },
    { id: 'categories', label: 'Categorias', subtitle: 'Um contato pode exercer mais de um papel.', icon: 'list', primary: false },
    { id: 'duplicates', label: 'Revisar duplicidades', subtitle: 'Sinais para conferência humana. Nenhuma fusão automática.', icon: 'merge', primary: false }
  ] });
  const state = { talents: [], employers: [], contacts: [], categories: [], categoryLinks: [], relationships: [], interactions: [], followups: [], unified: [], query: '', category: '', status: '', owner: '', quick: 'active', followupScope: 'open', loaded: false };
  const sources = {
    talents: { label: 'Talentos', load: () => D.loadCandidates({ activeOnly: false }) },
    employers: { label: 'Empregadores', load: () => D.loadEmployers({ activeOnly: false }) },
    contacts: { label: 'Agenda profissional', load: () => D.loadContacts({ includeArchived: true }) },
    categories: { label: 'Categorias', load: () => D.all(D.TABLES.categories) },
    categoryLinks: { label: 'Papéis dos contatos', load: () => D.all(D.TABLES.contactCategories, '*', null, { orderKeys: ['contact_id', 'category_id'] }) },
    relationships: { label: 'Relacionamentos', load: () => D.all(D.TABLES.relationships) },
    interactions: { label: 'Interações', load: () => D.all(D.TABLES.interactions, '*', (q) => q.order('occurred_at', { ascending: false })) },
    followups: { label: 'Acompanhamentos', load: () => D.all(D.TABLES.followups, '*', (q) => q.order('due_at')) }
  };
  const load = W.loader(app, state, sources, () => { state.unified = M.buildContacts(state.talents, state.employers, state.contacts, state.categories, state.categoryLinks); render(); });
  const byKey = (key) => state.unified.find((r) => r.key === key);
  const byContact = (id) => state.unified.find((r) => r.contactIds.some((key) => M.same(key, id)));
  const relatedTo = (row, item) => row.contactIds.some((id) => M.same(id, item.contact_id));
  const match = (values) => !state.query || M.norm(values.filter(M.present).join(' ')).includes(M.norm(state.query));
  const nextFollowup = (row) => state.followups.find((f) => relatedTo(row, f) && f.status === 'Pendente');
  const values = (value) => Array.isArray(value) ? value.filter(M.present).map(String) : M.present(value) ? [String(value)] : [];
  const matches = (value, selected) => { const wanted = values(selected); return !wanted.length || wanted.some((item) => (Array.isArray(value) ? value : [value]).some((candidate) => M.norm(candidate) === M.norm(item))); };
  const closedFollowup = (row) => /conclu|cancel|arquiv|encerr/i.test(M.norm(row?.status || '')) || !!row?.deleted_at;
  const closedContact = (row) => /inativ|arquiv|exclu|cancel|encerr/i.test(M.norm(row?.status || '')) || !!row?.deleted_at;
  function directoryRows() {
    return state.unified.filter((r) => matches(r.roles, state.category) && matches(r.status, state.status) && matches(r.owner, state.owner) && (app.view !== 'people' || r.entityType === 'Pessoa') && (app.view !== 'organizations' || r.entityType === 'Organização') && (state.quick !== 'active' || !closedContact(r)) && (state.quick !== 'archived' || closedContact(r)) && (state.quick !== 'followups' || nextFollowup(r)) && match([r.displayName, r.email, r.phone, r.jobTitle, r.organization, r.city, r.roles.join(' '), r.link?.secondary_email, r.link?.whatsapp]));
  }
  const filterLabels = { category: 'Categoria', status: 'Situação', owner: 'Responsável' };
  function filters() {
    const roles = [...new Set(state.unified.flatMap((r) => r.roles))].sort();
    return `<div class="t4-toolbar">${W.multiFilter('category', 'Categorias', roles, state.category)}${W.multiFilter('status', 'Situações', ['Ativo', 'A acompanhar', 'Inativo', 'Arquivado'], state.status)}${W.multiFilter('owner', 'Responsáveis', W.unique(state.unified, 'owner'), state.owner)}<span class="t4-toolbar-spacer"></span>${W.button('Limpar', 'clear', '', { className: 'ghost sm' })}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div>${W.activeFiltersBar(state, ['category', 'status', 'owner'], filterLabels)}`;
  }
  function render() {
    if (!state.loaded) return;
    app.setSearchHandler((q) => { state.query = q; render(); }, 'Buscar nome, empresa, e-mail ou telefone…');
    app.setPrimaryAction(app.view === 'categories' ? 'Nova categoria' : 'Novo contato', D.canEdit() ? () => app.view === 'categories' ? editCategory() : editContact() : null);
    app.setCounts({ all: state.unified.length, people: state.unified.filter((r) => r.entityType === 'Pessoa').length, organizations: state.unified.filter((r) => r.entityType === 'Organização').length, followups: state.followups.filter((r) => r.status === 'Pendente').length, duplicates: M.duplicateGroups(state.unified).length });
    let html = '';
    if (['all', 'people', 'organizations'].includes(app.view)) html = directoryView();
    else if (app.view === 'followups') html = followupsView();
    else if (app.view === 'categories') html = categoriesView();
    else html = duplicatesView();
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html;
    U.animateCounters(app.pageRoot);
  }
  function directoryView() {
    const missing = state.unified.filter((r) => r.unresolved);
    const activeCount = state.unified.filter((r) => !closedContact(r)).length, archiveCount = state.unified.filter(closedContact).length;
    return `${app.view === 'all' ? `<div class="t4-directory-intro"><div><span class="t4-overline">REDE DE RELACIONAMENTOS</span><h2>Pessoas certas. Contexto sempre à mão.</h2><p>A agenda começa pelos relacionamentos ativos; o arquivo fica separado para consulta.</p></div><div class="t4-directory-total"><strong>${activeCount}</strong><span>ativos · ${archiveCount} no arquivo</span></div></div>` : ''}
      ${missing.length ? W.note(`${missing.length} contatos possuem uma origem não encontrada entre os registros acessíveis. Eles continuam visíveis e identificados para revisão.`, 'warning') : ''}
      ${W.chips([{ id: 'active', label: 'Ativos', count: activeCount, icon: 'contact' }, { id: 'all', label: 'Todos os registros', count: state.unified.length, icon: 'list' }, { id: 'followups', label: 'Com próximo passo', icon: 'clock' }, { id: 'archived', label: 'Arquivo', count: archiveCount, icon: 'archive' }], state.quick)}${filters()}
      ${contactTable(directoryRows())}`;
  }
  function contactTable(rows, id = 'contacts') {
    return W.table({ id, rows, columns: [
      { key: 'displayName', label: 'Contato', required: true, render: (r) => W.person(r.displayName, [r.city, r.entityType].filter(Boolean).join(' · '), '', 'contact-detail', r.key) },
      { key: 'roles', label: 'Categorias', value: (r) => r.roles.join(' '), render: (r) => `<div class="t4-chip-row">${(r.roles.length ? r.roles : ['Sem categoria']).map((v) => U.badge(v, v === 'Talento' ? 'info' : v === 'Empregador' ? 'success' : 'purple')).join('')}</div>` },
      { key: 'organization', label: 'Organização / função', render: (r) => W.stack(r.organization || r.jobTitle, r.organization ? r.jobTitle : '') },
      { key: 'email', label: 'Canais', render: (r) => W.stack(r.email || r.phone, r.email ? r.phone : '') },
      { key: 'stage', label: 'Relacionamento', render: (r) => W.status(r.stage) }, { key: 'owner', label: 'Responsável' },
      { key: 'next', label: 'Próximo passo', value: (r) => nextFollowup(r)?.due_at || '', render: (r) => { const f = nextFollowup(r); return f ? W.stack(f.title, U.formatDate(f.due_at, true)) : '<span class="t4-muted">Não definido</span>'; } },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => W.button('Abrir', 'contact-detail', r.key, { className: 'sm ghost', icon: 'chevron' }) }
    ] });
  }
  function followupTable(rows, id = 'followups') {
    return W.table({ id, rows, columns: [
      { key: 'title', label: 'Acompanhamento', required: true, render: (r) => `<button class="t4-row-link" data-action="edit-followup" data-id="${a(r.id)}">${e(r.title)}</button><span class="t4-cell-secondary">${e(byContact(r.contact_id)?.displayName || 'Contato não encontrado')}</span>` },
      { key: 'due_at', label: 'Prazo', render: (r) => `${e(U.formatDate(r.due_at, true))}${M.overdue(r.due_at, r.status) ? U.badge('Vencido', 'danger') : ''}` }, { key: 'assigned_username', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }, { key: 'priority', label: 'Prioridade' },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => D.canEdit() && r.status === 'Pendente' ? W.button('Concluir', 'finish-followup', r.id, { className: 'sm', icon: 'check' }) : '' }
    ] });
  }
  function followupsView() {
    const scope = state.followupScope || 'open';
    const rows = state.followups.filter((r) => (scope === 'open' ? !closedFollowup(r) : scope === 'closed' ? closedFollowup(r) : true) && matches(r.status, state.status) && match([r.title, r.notes, byContact(r.contact_id)?.displayName, r.assigned_username]));
    const count = (which) => state.followups.filter((r) => which === 'open' ? !closedFollowup(r) : which === 'closed' ? closedFollowup(r) : true).length;
    return W.chips([{ id: 'open', label: 'Pendentes', count: count('open'), icon: 'clock' }, { id: 'all', label: 'Todos os passos', count: count('all'), icon: 'list' }, { id: 'closed', label: 'Histórico', count: count('closed'), icon: 'archive' }], scope, 'followup-scope') + `<div class="t4-toolbar">${W.multiFilter('status', 'Situações', ['Pendente', 'Concluído', 'Cancelado'], state.status)}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div><section class="t4-kpi-grid">${U.kpi('Pendentes', rows.filter((r) => r.status === 'Pendente').length, 'Próximas ações')}${U.kpi('Vencidos', rows.filter((r) => M.overdue(r.due_at, r.status)).length, 'Revisar prazo e responsável', 'warn')}${U.kpi('Concluídos', rows.filter((r) => r.status === 'Concluído').length, 'Histórico preservado', 'good')}${U.kpi('Contatos acompanhados', new Set(rows.map((r) => r.contact_id)).size, 'Neste recorte')}</section>` + followupTable(rows);
  }
  function categoriesView() {
    return W.table({ id: 'categories', rows: state.categories.filter((r) => match([r.name, r.slug])), columns: [
      { key: 'name', label: 'Categoria', required: true, render: (r) => U.badge(U.term(r.name), 'purple') }, { key: 'is_system', label: 'Origem', render: (r) => e(r.is_system ? 'Padrão do sistema' : 'Personalizada') }, { key: 'is_active', label: 'Situação', render: (r) => W.status(r.is_active ? 'Ativa' : 'Inativa') },
      { key: 'count', label: 'Contatos', value: (r) => state.categoryLinks.filter((l) => M.same(l.category_id, r.id)).length, render: (r) => e(state.categoryLinks.filter((l) => M.same(l.category_id, r.id)).length) }, { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => D.canEdit() && !r.is_system ? W.button('Editar', 'edit-category', r.id, { className: 'sm', icon: 'edit' }) : '' }
    ] });
  }
  function duplicatesView() {
    const groups = M.duplicateGroups(state.unified).filter((g) => match([g.value, ...g.rows.map((r) => r.displayName)]));
    return W.note('E-mail ou telefone repetido é apenas um sinal. As comparações incluem e-mail secundário e WhatsApp; organizações e pessoas podem compartilhar canais legitimamente. Nenhum registro será unido ou excluído automaticamente.') +
      (groups.length ? groups.map((g, i) => W.section(`${g.type}: ${g.value}`, contactTable(g.rows, `duplicate-${i}`), U.badge(`${g.rows.length} registros`, 'warning'))).join('') : U.emptyState('Nenhuma repetição encontrada', 'Esta checagem não substitui a revisão humana de nomes e vínculos.'));
  }
  function contactDetail(row) {
    if (!row) return;
    const contact = row.link || {};
    const relations = state.relationships.filter((r) => row.contactIds.some((id) => M.same(r.contact_id, id) || M.same(r.related_contact_id, id)));
    const interactions = state.interactions.filter((r) => relatedTo(row, r));
    const categories = state.categoryLinks.filter((r) => row.contactIds.some((id) => M.same(r.contact_id, id)));
    U.openDrawer({ title: row.displayName, subtitle: `${row.entityType} · ${row.roles.join(', ') || 'Sem categoria'}`, actions: `${D.canEdit() ? W.button('Editar contato', 'edit-contact', row.key, { className: 'sm', icon: 'edit' }) + W.button('Nova interação', 'new-interaction', row.key, { className: 'sm', icon: 'note' }) + W.button('Agendar próximo passo', 'new-followup', row.key, { className: 'primary sm', icon: 'plus' }) : ''}${row.source === 'talent' ? W.link('Ficha do talento', `./index.html?talent=${encodeURIComponent(row.sourceId)}`, 'user') : row.source === 'employer' ? W.link('Dossiê do empregador', `./organizacional.html?employer=${encodeURIComponent(row.sourceId)}`, 'building') : ''}`,
      body: `${row.unresolved ? W.note('O registro de origem não está entre os dados acessíveis. O contato e seu histórico foram preservados; confirme o vínculo antes de editar a identificação.', 'warning') : ''}
        <div class="t4-detail-grid">${U.field('E-mail', row.email)}${U.field('E-mail secundário', contact.secondary_email)}${U.field('Telefone', row.phone)}${U.field('WhatsApp', contact.whatsapp)}${U.field('Função / área', row.jobTitle)}${U.field('Organização', row.organization)}${U.field('Cidade', row.city)}${U.field('País', contact.country)}${U.field('Endereço', contact.address_line)}${U.field('Código postal', contact.postal_code)}${U.field('Responsável', row.owner)}${U.field('Relacionamento', row.stage)}${U.field('Canal preferido', contact.preferred_channel)}${U.field('Idioma', contact.language)}</div>
        <div class="t4-resource-links">${W.external('Site', contact.website || (row.source === 'employer' ? row.raw.site : ''))}${W.external('LinkedIn', contact.linkedin_url)}</div>
        ${W.section('Papéis e categorias', `<div class="t4-chip-row">${categories.map((c) => `<span class="t4-category-tag">${e(U.term(W.find(state.categories, c.category_id)?.name || 'Categoria'))}${D.canEdit() ? `<button type="button" aria-label="Remover categoria" data-action="remove-category-link" data-id="${a(`${c.contact_id}|${c.category_id}`)}">×</button>` : ''}</span>`).join('') || '<span class="t4-muted">Sem categorias adicionais.</span>'}</div>`, D.canEdit() ? W.button('Adicionar', 'add-category', row.key, { className: 'sm', icon: 'plus' }) : '')}
        ${W.section('Relacionamentos', relations.length ? relations.map((r) => { const isOwn = row.contactIds.some((id) => M.same(id, r.contact_id)); const target = byContact(isOwn ? r.related_contact_id : r.contact_id); return `<div class="t4-relation-row"><div><strong>${e(target?.displayName || 'Contato não encontrado')}</strong><span>${e(isOwn ? r.relationship_label : `${r.relationship_label} · vínculo recebido`)}${r.is_primary ? ' · principal' : ''}</span><small>${e(r.notes || '')}</small></div>${target ? W.button('Abrir', 'contact-detail', target.key, { className: 'sm ghost' }) : ''}${D.canEdit() ? W.button('Remover vínculo', 'remove-relation', r.id, { className: 'ghost sm' }) : ''}</div>`; }).join('') : '<p class="t4-muted">Nenhum relacionamento registrado.</p>', D.canEdit() ? W.button('Novo vínculo', 'new-relation', row.key, { className: 'sm', icon: 'link' }) : '')}
        ${W.section('Próximos passos e histórico', followupTable(state.followups.filter((r) => relatedTo(row, r)), 'contact-followups'))}
        ${W.section('Linha do tempo', W.table({ id: 'contact-timeline', rows: interactions, columns: [
          { key: 'occurred_at', label: 'Data', render: (r) => e(U.formatDate(r.occurred_at, true)) }, { key: 'interaction_type', label: 'Canal' }, { key: 'subject', label: 'Assunto', required: true }, { key: 'summary', label: 'Resumo', render: (r) => `<span class="t4-preserve">${e(r.summary)}</span>` }, { key: 'outcome', label: 'Resultado' }, { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: (r) => D.canEdit() ? W.button('Editar', 'edit-interaction', r.id, { className: 'ghost sm' }) : '' }
        ] }))}
        <p class="t4-preserve">${e(contact.notes || '')}</p>${row.source === 'contact' && !row.unresolved && D.canEdit() ? `<div class="t4-chip-row">${W.button('Vincular a talento ou empregador existente', 'link-canonical', row.key, { className: 'sm', icon: 'link' })}${W.button(row.status === 'Arquivado' ? 'Reativar contato' : 'Arquivar contato', 'archive-contact', row.key, { className: 'sm', icon: 'archive' })}</div>` : ''}${R.storedFields(contact, ['id', 'display_name', 'email', 'secondary_email', 'phone', 'whatsapp', 'notes', 'country', 'city', 'address_line', 'postal_code', 'language', 'source_system', 'source_record_id'])}` });
  }
  async function ensureContact(row) {
    if (row.contactId) return row.contactId;
    if (!['talent', 'employer'].includes(row.source)) throw new Error('Contato inválido.');
    const source = row.source === 'talent' ? 'candidatos' : 'employers';
    const existing = await D.select(D.TABLES.contacts, '*', (q) => q.eq('source_system', source).eq('source_record_id', String(row.sourceId)).limit(1));
    const created = existing[0] || await D.insert(D.TABLES.contacts, { id: D.uuid(), entity_type: row.entityType, display_name: row.displayName, email: row.email || null, phone: row.phone || null, source_system: source, source_record_id: String(row.sourceId), status: 'Ativo', relationship_stage: 'Relacionamento', priority: 'Normal' });
    row.contactId = created.id; row.contactIds = [...new Set([...row.contactIds, created.id])]; row.link = created;
    return created.id;
  }
  function editContact(row) {
    if (!D.canEdit()) return;
    const linked = row && row.source !== 'contact';
    const data = row ? { ...row.link, entity_type: row.entityType, display_name: row.displayName, job_title: row.jobTitle, email: row.email, phone: row.phone, city: row.city, owner_username: row.owner, status: row.link?.status || 'Ativo', relationship_stage: row.stage, priority: row.link?.priority || 'Normal' }
      : { entity_type: 'Pessoa', status: 'Ativo', relationship_stage: 'Novo', priority: 'Normal', owner_username: D.profile.username };
    const id = row?.contactId || D.uuid();
    const coreNames = ['display_name', 'job_title', 'email', 'phone', 'city', 'owner_username'];
    return W.form({ title: row ? 'Editar contato' : 'Novo contato', row: data,
      notice: linked ? 'Nome, função/área, e-mail, telefone, cidade e responsável pertencem ao cadastro original e aparecem nas outras áreas. Categorias e dados de relacionamento pertencem à agenda.' : 'Um contato geral não é transformado automaticamente em talento ou empregador. Você pode vinculá-lo a um cadastro existente pela ficha.',
      fields: [
        { section: 'Identificação e canais' },
        { name: 'entity_type', label: 'Tipo de contato', type: 'select', options: ['Pessoa', 'Organização'], required: true, readonly: !!linked, placeholder: null },
        { name: 'display_name', label: 'Nome de exibição', required: true, readonly: row?.unresolved },
        { name: 'legal_name', label: 'Nome legal / razão social' }, { name: 'job_title', label: 'Função / área', readonly: row?.unresolved },
        { name: 'email', label: 'E-mail principal', type: 'email', readonly: row?.unresolved }, { name: 'secondary_email', label: 'E-mail secundário', type: 'email' },
        { name: 'phone', label: 'Telefone', readonly: row?.unresolved }, { name: 'whatsapp', label: 'WhatsApp' }, { name: 'website', label: 'Site', type: 'url' }, { name: 'linkedin_url', label: 'LinkedIn', type: 'url' },
        { name: 'preferred_channel', label: 'Canal preferido', type: 'select', options: ['E-mail', 'Telefone', 'WhatsApp', 'LinkedIn', 'Outro'] }, { name: 'language', label: 'Idioma de comunicação' },
        { section: 'Organização e endereço' },
        { name: 'primary_organization_id', label: 'Organização principal', type: 'select', options: state.contacts.filter((r) => r.entity_type === 'Organização' && !M.same(r.id, row?.contactId)).map((r) => ({ value: r.id, label: byContact(r.id)?.displayName || r.display_name })), wide: true },
        { name: 'address_line', label: 'Endereço', wide: true }, { name: 'city', label: 'Cidade', readonly: row?.unresolved }, { name: 'country', label: 'País' }, { name: 'postal_code', label: 'Código postal' },
        { section: 'Relacionamento profissional' },
        { name: 'status', label: 'Situação na agenda', type: 'select', options: ['Ativo', 'A acompanhar', 'Inativo', 'Arquivado'], required: true, placeholder: null, help: 'Não altera a etapa seletiva nem exclui o cadastro original.' },
        { name: 'relationship_stage', label: 'Etapa do relacionamento', type: 'select', options: ['Novo', 'Em contato', 'Relacionamento', 'Sem retorno', 'Encerrado'], required: true, placeholder: null },
        { name: 'priority', label: 'Prioridade do contato', type: 'select', options: R.PRIORITIES, required: true, placeholder: null }, { name: 'owner_username', label: 'Responsável', readonly: row?.unresolved },
        { name: 'source', label: 'Como chegou até nós?' }, { name: 'retention_review_at', label: 'Revisão de retenção', type: 'date' }, { name: 'notes', label: 'Observações', type: 'textarea', wide: true }
      ], onSubmit: async (values, changes) => {
        let sourceSaved = false;
        try {
          if (linked) {
            const mapping = row.source === 'talent' ? { display_name: 'nome_completo', job_title: 'profissao_principal', email: 'email', phone: 'telefone', city: 'cidade_atual', owner_username: 'responsavel_interno' }
              : { display_name: 'nome', job_title: 'area_atuacao', email: 'email_principal', phone: 'telefone', city: 'cidade', owner_username: 'responsavel_interno' };
            const patch = Object.fromEntries(coreNames.filter((key) => key in changes).map((key) => [mapping[key], values[key]]));
            if (Object.keys(patch).length) {
              const table = row.source === 'talent' ? D.TABLES.candidates : D.TABLES.employers;
              const expected = row.raw.updated_at || row.raw.ultima_atualizacao;
              const opts = expected ? { expectedUpdatedAt: expected, expectedColumn: row.raw.updated_at ? 'updated_at' : 'ultima_atualizacao' } : {};
              if (row.source === 'talent') patch.ultima_atualizacao = new Date().toISOString();
              if (row.source === 'employer' && 'nome' in patch) patch.nome_normalizado = M.norm(patch.nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
              row.raw = await D.update(table, row.sourceId, patch, opts);
              sourceSaved = true;
              row.displayName = values.display_name; row.email = values.email; row.phone = values.phone;
            }
            const meta = Object.fromEntries(Object.entries(changes).filter(([key]) => !coreNames.includes(key)));
            if (Object.keys(meta).length || row.contactId && sourceSaved) {
              const contactId = await ensureContact(row);
              if ('status' in meta) meta.archived_at = values.status === 'Arquivado' ? new Date().toISOString() : null;
              if (sourceSaved) for (const key of coreNames.filter((k) => k in changes)) meta[key] = values[key];
              if (Object.keys(meta).length) await D.update(D.TABLES.contacts, contactId, meta, row.link.updated_at ? { expectedUpdatedAt: row.link.updated_at } : {});
            }
          } else {
            if (!row) values.archived_at = values.status === 'Arquivado' ? new Date().toISOString() : null;
            if ('status' in changes) changes.archived_at = values.status === 'Arquivado' ? new Date().toISOString() : null;
            await W.saveRecord(D.TABLES.contacts, row?.link, values, changes, id);
          }
          U.toast('Contato salvo. Os cadastros vinculados usam os mesmos dados principais.', 'success');
          await load();
        } catch (error) {
          if (sourceSaved) {
            await load();
            const partial = new Error('Os dados principais foram salvos, mas os complementos da agenda não foram confirmados. Reabra a ficha para conferir: ' + W.formatError(error));
            partial.partial = true; throw partial;
          }
          throw error;
        }
      } });
  }
  async function editInteraction(row, contact) {
    if (!D.canEdit()) return;
    const contactId = row?.contact_id || contact?.contactId;
    return W.recordForm({ title: row ? 'Editar interação' : 'Registrar interação', subtitle: contact?.displayName || byContact(contactId)?.displayName || '', table: D.TABLES.interactions, row: row || { occurred_at: new Date().toISOString(), interaction_type: 'Nota' }, fields: [
      { name: 'interaction_type', label: 'Canal', type: 'select', options: ['E-mail', 'Telefone', 'WhatsApp', 'Reunião', 'LinkedIn', 'Presencial', 'Nota', 'Outro'], required: true, placeholder: null },
      { name: 'occurred_at', label: 'Data e hora', type: 'datetime-local', required: true }, { name: 'subject', label: 'Assunto', wide: true }, { name: 'summary', label: 'Resumo da interação', type: 'textarea', required: true, wide: true }, { name: 'outcome', label: 'Resultado / decisão', type: 'textarea', wide: true }
    ], async prepare(v) { if (!row) v.contact_id = contactId || await ensureContact(contact); }, after: load });
  }
  function editCategory(row) {
    if (!D.canEdit() || row?.is_system) return;
    return W.recordForm({ title: row ? 'Editar categoria' : 'Nova categoria', table: D.TABLES.categories, row: row || { color: '#245B85', is_active: true, sort_order: 100 }, fields: [
      { name: 'name', label: 'Nome', required: true }, { name: 'color', label: 'Cor', type: 'color', required: true }, { name: 'sort_order', label: 'Ordem', type: 'number', required: true }, { name: 'is_active', label: 'Categoria ativa', type: 'checkbox' }
    ], prepare(v) { if (!row) Object.assign(v, { slug: M.norm(v.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), is_system: false }); }, after: load });
  }
  function addCategory(row) {
    if (!D.canEdit()) return;
    const roles = state.categories.filter((r) => r.is_active && !(r.is_system && /candidat|talento|empregador|employer/.test(M.norm(r.name))));
    return W.form({ title: 'Adicionar categoria', subtitle: row.displayName, fields: [{ name: 'category_id', label: 'Categoria', type: 'select', options: R.choices(roles, 'name'), required: true }], onSubmit: async (values) => {
      const contactId = await ensureContact(row);
      if (state.categoryLinks.some((r) => M.same(r.contact_id, contactId) && M.same(r.category_id, values.category_id))) throw new Error('Este contato já possui a categoria.');
      await D.insert(D.TABLES.contactCategories, { contact_id: contactId, category_id: values.category_id });
      U.toast('Categoria vinculada.', 'success'); await load();
    } });
  }
  function newRelationship(row) {
    if (!D.canEdit()) return;
    const choices = state.unified.filter((r) => r.key !== row.key && !r.unresolved);
    return W.form({ title: 'Novo relacionamento', subtitle: row.displayName, fields: [
      { name: 'related_key', label: 'Outro contato', type: 'select', options: choices.map((r) => ({ value: r.key, label: `${r.displayName} · ${r.entityType}` })), required: true, wide: true },
      { name: 'relationship_label', label: 'Relação', placeholder: 'Ex.: Trabalha em, Professor de, Parceiro de', required: true, wide: true }, { name: 'is_primary', label: 'Vínculo principal', type: 'checkbox' }, { name: 'notes', label: 'Contexto do relacionamento', type: 'textarea', wide: true }
    ], onSubmit: async (v) => {
      const target = byKey(v.related_key);
      if (!target || target.key === row.key) throw new Error('Selecione outro contato.');
      const contactId = await ensureContact(row), targetId = await ensureContact(target);
      if (v.is_primary && state.relationships.some((r) => M.same(r.contact_id, contactId) && r.is_primary)) throw new Error('Este contato já tem um vínculo principal. Revise o vínculo existente primeiro.');
      await D.insert(D.TABLES.relationships, { id: D.uuid(), contact_id: contactId, related_contact_id: targetId, relationship_label: v.relationship_label, is_primary: v.is_primary, notes: v.notes });
      U.toast('Relacionamento registrado nas duas fichas.', 'success'); await load();
    } });
  }
  function linkCanonical(row) {
    if (!D.canEdit() || row.source !== 'contact' || row.unresolved) return;
    const targets = state.unified.filter((r) => r.source !== 'contact' && r.entityType === row.entityType && !r.contactId);
    return W.form({ title: 'Vincular ao cadastro existente', subtitle: row.displayName,
      notice: 'O cadastro escolhido passa a ser a fonte do nome e dos canais principais. O contato, suas observações e seu histórico permanecem preservados. Não cria um novo talento nem um novo empregador.', fields: [{ name: 'target_key', label: 'Cadastro original', type: 'select', options: targets.map((r) => ({ value: r.key, label: r.displayName })), required: true, wide: true }], onSubmit: async (v) => {
        const target = byKey(v.target_key);
        if (!target || target.contactId || target.entityType !== row.entityType) throw new Error('O vínculo não está mais disponível. Atualize a agenda.');
        await D.update(D.TABLES.contacts, row.contactId, { source_system: target.source === 'talent' ? 'candidatos' : 'employers', source_record_id: String(target.sourceId) }, row.raw.updated_at ? { expectedUpdatedAt: row.raw.updated_at } : {});
        U.toast('Vínculo confirmado. Histórico preservado.', 'success'); await load();
      } });
  }
  W.bind(app, { change(key, value) { state[key] = value; render(); }, async action(action, id) {
    if (action === 'reload') return D.session ? load() : location.reload();
    if (action === 'clear') { state.category = []; state.status = []; state.owner = []; state.query = ''; state.quick = 'active'; state.followupScope = 'open'; app.resetSearch(); render(); return; }
    if (action === 'active-filter-remove') { const [key, value] = JSON.parse(id); if (Array.isArray(state[key])) state[key] = state[key].filter((v) => v !== value); render(); return; }
    if (action === 'quick') { state.quick = id; render(); return; }
    if (action === 'followup-scope') { state.followupScope = ['open', 'all', 'closed'].includes(id) ? id : 'open'; state.status = []; render(); return; }
    if (action === 'contact-detail') return contactDetail(byKey(id));
    if (action === 'edit-contact') return editContact(byKey(id));
    if (action === 'edit-category') return editCategory(W.find(state.categories, id));
    if (action === 'new-interaction') return editInteraction(null, byKey(id));
    if (action === 'edit-interaction') return editInteraction(W.find(state.interactions, id));
    if (action === 'new-followup') { const row = byKey(id); return R.editFollowup(null, () => ensureContact(row), load); }
    if (action === 'edit-followup') { const row = W.find(state.followups, id); if (D.canEdit()) return R.editFollowup(row, row.contact_id, load); U.openDrawer({ title: row.title, body: R.storedFields(row) }); return; }
    if (action === 'finish-followup') { const row = W.find(state.followups, id); await D.update(D.TABLES.followups, id, { status: 'Concluído', completed_at: new Date().toISOString() }, row.updated_at ? { expectedUpdatedAt: row.updated_at } : {}); U.toast('Acompanhamento concluído.', 'success'); return load(); }
    if (action === 'add-category') return addCategory(byKey(id));
    if (action === 'new-relation') return newRelationship(byKey(id));
    if (action === 'link-canonical') return linkCanonical(byKey(id));
    if (action === 'remove-category-link') {
      const [contact_id, category_id] = id.split('|');
      if (!await U.confirm({ title: 'Remover esta categoria?', message: 'Somente a associação será removida. O contato, a categoria e o histórico serão preservados.', confirmLabel: 'Remover associação' })) return;
      await D.removeAssociation(D.TABLES.contactCategories, { contact_id, category_id }); U.closeDrawer(); return load();
    }
    if (action === 'remove-relation') {
      if (!await U.confirm({ title: 'Remover este relacionamento?', message: 'As duas fichas de contato permanecem. Apenas este vínculo será removido.', confirmLabel: 'Remover vínculo' })) return;
      await D.removeAssociation(D.TABLES.relationships, { id }); U.closeDrawer(); return load();
    }
    if (action === 'archive-contact') {
      const row = byKey(id), restore = row.status === 'Arquivado';
      if (!await U.confirm({ title: restore ? 'Reativar contato?' : 'Arquivar contato?', message: `${row.displayName}: nenhuma interação ou acompanhamento será excluído.`, confirmLabel: restore ? 'Reativar' : 'Arquivar' })) return;
      await D.update(D.TABLES.contacts, row.contactId, { status: restore ? 'Ativo' : 'Arquivado', archived_at: restore ? null : new Date().toISOString() }, row.raw.updated_at ? { expectedUpdatedAt: row.raw.updated_at } : {});
      U.closeDrawer(); return load();
    }
  } });
  app.onRoute(() => { state.status = ''; if (['all', 'people', 'organizations'].includes(app.view)) state.quick = 'active'; render(); });
  W.start(app, async () => {
    await load();
    const p = new URLSearchParams(location.search);
    if (!state.openedInitial && (p.has('contact') || p.has('talent') || p.has('employer'))) {
      state.openedInitial = true;
      contactDetail(p.has('contact') ? byContact(p.get('contact')) : byKey(`${p.has('talent') ? 'talent' : 'employer'}:${p.get('talent') || p.get('employer')}`));
    }
  }, [D.TABLES.candidates, D.TABLES.employers, D.TABLES.contacts, D.TABLES.categories, D.TABLES.contactCategories, D.TABLES.relationships, D.TABLES.interactions, D.TABLES.followups]);
})();
