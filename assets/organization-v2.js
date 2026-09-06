(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data, R = window.T4Records;
  const e = U.esc, a = U.attr;
  const VIEWS = [
    { id: 'overview', label: 'Meu dia', subtitle: 'Empregadores, compromissos e decisões em um só lugar.', icon: 'dashboard' },
    { id: 'employers', label: 'Empregadores', subtitle: 'Relacionamento, vagas, talentos e histórico de cada empresa.', icon: 'building' },
    { id: 'pipeline', label: 'Seleções', subtitle: 'Cada linha representa Talento + empregador + vaga + etapa.', icon: 'columns' },
    { id: 'opportunities', label: 'Oportunidades', subtitle: 'Demanda real e requisitos de cada oportunidade.', icon: 'briefcase' },
    { id: 'calendar', label: 'Agenda', subtitle: 'Planejamento, reuniões e tarefas com data definida.', icon: 'calendar' },
    { id: 'planning', label: 'Planejamento mensal', subtitle: 'Um mês por vez, o que precisa de atenção primeiro.', icon: 'list', primary: false },
    { id: 'meetings', label: 'Reuniões e decisões', subtitle: 'Pauta, decisões, pendências e próximos passos.', icon: 'people', primary: false },
    { id: 'operations', label: 'PO operacional', subtitle: 'Atividades abertas e histórico completo.', icon: 'activity', primary: false },
    { id: 'summary', label: 'Resumo geral', subtitle: 'Leitura consolidada das atividades e do histórico.', icon: 'history', primary: false },
    { id: 'history', label: 'Acervo anterior', subtitle: 'Consulta protegida das informações anteriores à V2.', icon: 'archive', primary: false }
  ];
  const app = U.mount({ module: 'organization', moduleLabel: 'Organizacional', views: VIEWS, defaultView: 'employers' });
  const state = { talents: [], employers: [], openings: [], selections: { rows: [], modern: false }, activities: [], plans: [], meetings: [], summaries: [], replacements: [], tasks: [], metrics: [], taskResponsibles: [], users: [], query: '', employer: '', month: '', status: '', employerScope: 'active', employerClassification: 'partner', employerDisplay: 'cards', planningFocus: 'all', planningMonth: M.today().slice(0, 7), operationsFocus: 'all', operationsMonth: M.today().slice(0, 7), operationsDisplay: 'activities', meetingsMonth: M.today().slice(0, 7), selectionDisplay: 'list', selectionScope: 'active', selectionShowClosed: false, opportunityScope: 'open', calendar: M.today().slice(0, 7), loaded: false, archive: null };
  const operationalKeys = ['plans', 'meetings', 'summaries', 'replacements', 'tasks', 'metrics'];
  const labels = { plans: 'Planejamento mensal', meetings: 'Reuniões', summaries: 'Resumos manuais', replacements: 'Reposições', tasks: 'Tarefas operacionais', metrics: 'Métricas' };
  const sources = {
    talents: { label: 'Talentos', load: () => D.loadCandidates({ activeOnly: false }) },
    employers: { label: 'Empregadores', load: () => D.loadEmployers({ activeOnly: false }) },
    openings: { label: 'Vagas', load: () => D.loadOpenings() },
    selections: { label: 'Seleções e vínculos anteriores', load: () => D.loadMatches() },
    activities: { label: 'Agenda integrada', load: () => D.loadActivities() },
    ...Object.fromEntries(operationalKeys.map((key) => [key, { label: labels[key], load: () => D.optionalAll(D.TABLES[key], '*', (q) => q.is('deleted_at', null)) }])),
    taskResponsibles: { label: 'Responsáveis das tarefas', load: () => D.optionalAll(D.TABLES.taskResponsibles, '*', (q) => q.is('deleted_at', null)) },
    users: { label: 'Usuários do sistema', load: () => D.optionalSelect(D.TABLES.users, D.SELECTS.users, (q) => q.order('nome', { ascending: true })) }
  };
  const load = W.loader(app, state, sources, render);
  const employerOf = (r) => W.find(state.employers, r.employer_id)?.nome || r.employer_name_snapshot || r.group_name || 'Talents 4 · interno';
  const values = (value) => Array.isArray(value) ? value.filter(M.present).map(String) : M.present(value) ? [String(value)] : [];
  const firstValue = (value) => values(value)[0] || '';
  const matches = (value, selected) => { const wanted = values(selected); return !wanted.length || wanted.some((item) => M.same(item, value) || M.norm(item) === M.norm(value)); };
  const scoped = (r) => matches(r.employer_id, state.employer) || (!r.employer_id && values(state.employer).some((id) => M.norm(r.employer_name_snapshot) === M.norm(W.find(state.employers, id)?.nome)));
  const matchQuery = (r) => !state.query || M.norm(Object.values(r).filter((v) => typeof v !== 'object').join(' ')).includes(M.norm(state.query));
  const closedStatus = (value) => /^(conclu|cancel|arquiv|inativ|removid|exclu|encerr|rejeit|desist|pronto|contratad|transferid)/i.test(M.norm(value));
  // Operational registers start clean: a negative lifecycle only appears
  // after the user selects that status (or asks for the archive view).
  const matchesPeriod = (row, selected, dateField = '') => {
    const wanted = values(selected);
    if (!wanted.length) return true;
    const rowMonths = rowPeriodKeys(row);
    if (!rowMonths.length && dateField) {
      const fallback = periodKey(row?.[dateField]);
      return wanted.some((item) => M.same(item, fallback));
    }
    return rowMonths.some((month) => wanted.some((item) => M.same(item, month)));
  };
  const filtered = (rows, dateField = '') => rows.filter((r) => scoped(r) && matchesPeriod(r, state.month, dateField) && (values(state.status).length ? matches(r.status, state.status) : !closedStatus(r.status)) && matchQuery(r));
  const actions = (row, kind) => D.canEdit() ? W.button('Editar', `edit-${kind}`, row.id, { className: 'sm ghost', icon: 'edit' }) : '';
  const periodKey = (value) => {
    const match = String(value ?? '').match(/^(\d{4})-(\d{1,2})(?:-|T|$)/);
    if (!match) return '';
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? `${match[1]}-${String(month).padStart(2, '0')}` : '';
  };
  const rowPeriodKeys = (row) => ['month_ref', 'scheduled_at', 'due_date', 'start_date', 'end_date', 'period_start', 'period_end', 'completed_at'].flatMap((key) => {
    const value = periodKey(row?.[key]);
    return value ? [value] : [];
  });
  const months = () => {
    const current = periodKey(M.today());
    const discovered = operationalKeys.flatMap((key) => state[key].flatMap(rowPeriodKeys));
    return [...new Set([current, ...discovered])].filter(Boolean).sort((left, right) => left === current ? -1 : right === current ? 1 : String(right).localeCompare(String(left), 'pt-BR', { numeric: true }));
  };
  const filterLabels = { employer: 'Empregador', month: 'Período', status: 'Situação' };
  const monthLabel = (value) => { const d = new Date(`${value}-01T12:00:00`); if (Number.isNaN(d.getTime())) return value; const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return label.charAt(0).toUpperCase() + label.slice(1); };
  const monthOptions = () => months().map((value) => ({ value, label: monthLabel(value), group: value.slice(0, 4), current: value === periodKey(M.today()) }));
  const filterValueLabel = (key, value) => key === 'employer' ? R.employerName(state, value) : key === 'month' ? monthLabel(value) : value;
  const toolbar = (rows = [], opts = {}) => {
    const keys = ['employer', ...(opts.noMonth ? [] : ['month']), ...(opts.noStatus ? [] : ['status'])];
    return `<div class="t4-toolbar">${W.multiFilter('employer', 'Empregadores', R.choices(state.employers, 'nome'), state.employer)}${opts.noMonth ? '' : W.periodFilter('month', 'Períodos', monthOptions(), state.month)}${opts.noStatus ? '' : W.multiFilter('status', 'Situações', W.unique(rows, 'status'), state.status)}<span class="t4-toolbar-spacer"></span>${W.button('Limpar', 'clear', '', { className: 'ghost sm' })}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div>${W.activeFiltersBar(state, keys, filterLabels, filterValueLabel)}`;
  };
  // A navegação oficial é a lateral. A antiga barra de “visões salvas” duplicava
  // os mesmos destinos, ocupava espaço e dava a impressão de abas concorrentes.
  // A API permanece compatível para links antigos, mas não renderiza uma segunda
  // navegação em cada tela.
  const workViews = () => '';
  const available = (key) => state.sources[key]?.available === true;
  const can = (key) => D.canEdit() && available(key) && (key !== 'selections' || state.selections.modern);
  const currentUsername = () => String(D.profile?.username || '').trim();
  const userRecord = (username) => state.users.find((row) => M.norm(row.username) === M.norm(username));
  const userLabel = (username) => userRecord(username)?.nome || username || 'Usuário não informado';
  function activeUsers() {
    return state.users.filter((row) => M.active(row.ativo) && row.username).sort((left, right) => userLabel(left.username).localeCompare(userLabel(right.username), 'pt-BR'));
  }
  const taskResponsiblesFor = (rowOrId) => {
    const taskId = typeof rowOrId === 'object' ? rowOrId?.id : rowOrId;
    return state.taskResponsibles.filter((item) => M.same(item.task_id, taskId) && !item.deleted_at);
  };
  const taskOwnerMatches = (row, username = currentUsername()) => {
    const owner = row?.owner_user_key || row?.assigned_user_key;
    const profile = userRecord(username);
    return [username, profile?.username, profile?.nome].filter(Boolean).some((candidate) => M.norm(owner) === M.norm(candidate));
  };
  const taskVisible = (row) => {
    // The database remains the authority when the additive association table
    // has not been applied yet. The demo fixture also has no association
    // source, so its sample task must remain visible for UI tests.
    if (state.sources?.taskResponsibles?.available !== true) return true;
    return taskOwnerMatches(row) || taskResponsiblesFor(row).some((item) => taskOwnerMatches({ owner_user_key: item.username }));
  };
  const responsibleUsernames = (row) => [...new Set([row?.owner_user_key || row?.assigned_user_key, ...taskResponsiblesFor(row).map((item) => item.username)].filter(Boolean))];
  const responsibleLabels = (row) => responsibleUsernames(row).map(userLabel).join(', ');
  const taskResponsibleOptions = (primary) => activeUsers().filter((item) => M.norm(item.username) !== M.norm(primary)).map((item) => ({ value: item.username, label: userLabel(item.username) }));
  function events() {
    return [
      ...state.plans.map((r) => ({ ...r, title: r.activity_label, due: r.end_date || r.start_date, start: r.start_date, owner: r.responsavel, type: 'Planejamento', action: 'edit-plan', detail: r.obs })),
      ...state.meetings.map((r) => ({ ...r, title: r.topic || r.title, due: r.scheduled_at, owner: r.owner_name, type: 'Reunião', action: 'meeting-detail', detail: r.decision_summary, next: r.next_action })),
      ...state.tasks.filter(taskVisible).map((r) => ({ ...r, due: r.due_date, owner: responsibleLabels(r), type: 'PO operacional', action: 'edit-task', detail: r.description, next: r.notes })),
      ...state.activities.map((r) => ({ ...r, due: r.due_at, owner: r.owner_username, type: r.contact_followup_id ? 'Contatos' : 'Agenda integrada', action: 'edit-activity', detail: r.notes, next: r.outcome }))
    ].sort((x, y) => String(x.due || '9999').localeCompare(String(y.due || '9999')));
  }
  function eventTable(rows, id) {
    return W.table({ id, rows, columns: [
      { key: 'title', label: 'Atividade / assunto', required: true, render: (r) => `<button type="button" class="t4-row-link" data-action="${a(r.action)}" data-id="${a(r.id)}">${e(r.title || 'Sem título')}</button><span class="t4-cell-secondary">${e(r.type)}</span>` },
      { key: 'employer', label: 'Empregador / escopo', value: employerOf, render: (r) => e(employerOf(r)) },
      { key: 'due', label: 'Prazo', render: (r) => `${e(U.formatDate(r.due))}${M.overdue(r.due, r.status) ? U.badge('Vencido', 'danger') : ''}` },
      { key: 'owner', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'detail', label: 'Contexto / decisão', render: (r) => `<span class="t4-clamp-3">${e(r.detail || '—')}</span>` },
      { key: 'next', label: 'Próxima ação / resultado', render: (r) => `<span class="t4-clamp-3">${e(r.next || '—')}</span>` }
    ] });
  }
  function render() {
    if (!state.loaded) return;
    app.setCounts({ employers: state.employers.filter((r) => M.activeRecord(r)).length, pipeline: state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed').length, meetings: state.meetings.length, operations: state.tasks.filter((r) => taskVisible(r) && M.isOpen(r.status)).length });
    app.setSearchHandler((q) => { state.query = q; render(); }, 'Buscar nesta área…');
    const primary = { overview: ['Nova atividade', () => R.editActivity(state, null, {}, load), 'activities'], employers: ['Novo empregador', () => editEmployer(), 'employers'], opportunities: ['Nova vaga', () => editOpening(), 'openings'], pipeline: ['Nova seleção', () => R.editSelection(state, null, {}, load), 'selections'], planning: ['Nova atividade mensal', () => editPlan(), 'plans'], calendar: ['Nova reunião', () => editMeeting(), 'meetings'], meetings: ['Nova reunião', () => editMeeting(), 'meetings'], operations: ['Nova tarefa', () => editTask(), 'tasks'], summary: ['Adicionar resumo', () => editSummary(), 'summaries'] }[app.view];
    app.setPrimaryAction(primary?.[0], primary && can(primary[2]) ? primary[1] : null);
    const html = ({ overview, employers: employersView, opportunities: opportunitiesView, pipeline: pipelineView, planning: planningView, calendar: calendarView, meetings: meetingsView, operations: operationsView, summary: summaryView, history: historyView }[app.view] || overview)();
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html;
    U.animateCounters(app.pageRoot);
  }
  function overview() {
    const activeEmployers = state.employers.filter((r) => M.activeRecord(r));
    const pending = events().filter((r) => scoped(r) && matchQuery(r) && M.isOpen(r.status));
    const late = pending.filter((r) => M.overdue(r.due, r.status));
    const soon = pending.filter((r) => r.due && !M.overdue(r.due, r.status));
    return workViews('overview') + `<div class="t4-work-intro"><div><span class="t4-overline">OPERAÇÃO E RELACIONAMENTO</span><h2>O próximo passo de cada parceria.</h2><p>Acompanhe decisões, avance seleções e mantenha o contexto da equipe.</p></div>${W.button('Ver calendário', 'go', 'calendar', { icon: 'calendar' })}</div>
      <section class="t4-kpi-grid">${U.kpi('Empregadores ativos', available('employers') ? activeEmployers.length : '—', 'Base de relacionamento')}${U.kpi('Vagas abertas', available('openings') ? state.openings.filter((r) => M.isOpen(r.status) && !/fechad/i.test(r.status)).reduce((n, r) => n + (Number(r.quantity) || 0), 0) : '—', 'Quantidade de posições')}${U.kpi('Ações em aberto', pending.length, 'Nas fontes carregadas')}${U.kpi('Prazos vencidos', late.length, 'Revisar com a equipe', late.length ? 'risk' : 'good')}</section>
      ${state.selections.rows.length ? stagePulse(state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed')) : ''}
      ${W.section('Precisa de atenção', eventTable(late, 'org-late'), U.badge(late.length, late.length ? 'danger' : 'success'))}
      ${W.section('A seguir', eventTable(soon, 'org-soon'), W.button('Agenda completa', 'go', 'calendar', { className: 'ghost sm' }))}
      ${W.section('Parcerias em foco', employerCards(activeEmployers.filter(matchQuery).slice(0, 6)), W.button('Todos os empregadores', 'go', 'employers', { className: 'sm' }))}`;
  }
  function employerCards(rows) {
    return `<div class="t4-cards-grid">${rows.map((r) => {
      const selections = state.selections.rows.filter((s) => M.same(s.employer_id, r.id) && M.selectionBucket(s) !== 'closed');
      const jobs = state.openings.filter((s) => M.same(s.employer_id, r.id) && !/fechad|cancel/i.test(s.status || ''));
      const pending = events().filter((s) => (M.same(s.employer_id, r.id) || (!s.employer_id && M.norm(s.employer_name_snapshot) === M.norm(r.nome))) && M.isOpen(s.status));
      const employerColor = window.T4Modern?.color(r) || '#002a4a';
      const active = M.activeRecord(r);
      return `<article class="t4-company-card ${active ? '' : 'v25-negative-surface'}" style="--employer-color:${a(employerColor)}"><div class="t4-company-head"><span class="t4-company-avatar">${U.icon('building')}</span>${W.status(active ? (r.status || 'Ativo') : 'Arquivado')}</div><button class="t4-card-title" data-action="employer-detail" data-id="${a(r.id)}">${e(r.nome)}</button><p class="t4-card-location">${e([r.cidade, r.pais].filter(Boolean).join(' · ') || 'Localização não informada')}</p>${R.employerClassificationHtml(r)}<p class="t4-clamp-3">${e(r.descricao_resumida || r.descricao_operacional || 'Adicione o contexto desta parceria.')}</p><div class="t4-card-stats"><span><strong>${jobs.length}</strong> oportunidades</span><span><strong>${new Set(selections.map((s) => s.talent_id)).size}</strong> talentos</span><span><strong>${pending.length}</strong> ações</span></div><footer><span>${e(r.responsavel_interno || 'Sem responsável')}</span>${W.button('Abrir dossiê', 'employer-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</footer></article>`;
    }).join('') || U.emptyState('Nenhum empregador neste filtro', 'Limpe os filtros para conferir todos os registros.')}</div>`;
  }
  function employersView() {
    const scope = state.employerScope || 'active';
    const classification = state.employerClassification || 'all';
    const employerPriority = (row) => {
      if (R.employerClassificationMatches(row, 'partner')) return 0;
      if (R.employerClassificationMatches(row, 'nectanet')) return 1;
      if (R.employerClassificationMatches(row, 'general')) return 2;
      if (R.employerClassificationMatches(row, 'external')) return 3;
      return 4;
    };
    const rows = state.employers.filter((r) => {
      const isActive = M.activeRecord(r);
      if (scope === 'active' && !isActive) return false;
      if (scope === 'archived' && isActive) return false;
      return matches(r.id, state.employer) && matches(r.status || 'Ativo', state.status) && R.employerClassificationMatches(r, classification) && matchQuery(r);
    }).sort((left, right) => employerPriority(left) - employerPriority(right) || M.norm(left.nome).localeCompare(M.norm(right.nome), 'pt-BR'));
    const scopeCount = (id) => id === 'active' ? state.employers.filter((r) => M.activeRecord(r)).length : id === 'archived' ? state.employers.filter((r) => !M.activeRecord(r)).length : state.employers.length;
    const scopeBar = W.chips([{ id: 'active', label: 'Ativos', count: scopeCount('active'), icon: 'building' }, { id: 'all', label: 'Todos os registros', count: scopeCount('all'), icon: 'list' }, { id: 'archived', label: 'Arquivo', count: scopeCount('archived'), icon: 'archive' }], scope, 'employer-scope');
    const classificationOptions = [{ id: 'partner', label: 'Parceiras diretas', icon: 'check' }, { id: 'nectanet', label: 'Apresentadas pela NectaNet', icon: 'arrow' }, { id: 'general', label: 'Empresas gerais', icon: 'building' }, { id: 'pending', label: 'Parceria a confirmar', icon: 'warning' }, { id: 'all', label: 'Todos', icon: 'list' }];
    const classificationCount = (id) => state.employers.filter((r) => (scope === 'active' ? M.activeRecord(r) : scope === 'archived' ? !M.activeRecord(r) : true) && R.employerClassificationMatches(r, id)).length;
    const classificationBar = `<div class="v25-classification-filter"><div><strong>Tipo de relação</strong><span>Parceira, origem do contato ou empresa geral.</span></div>${W.chips(classificationOptions.map((item) => ({ ...item, count: item.id === 'all' ? scopeCount(scope === 'active' ? 'active' : scope === 'archived' ? 'archived' : 'all') : classificationCount(item.id) })), classification, 'employer-classification')}</div>`;
    const displayBar = W.chips([{ id: 'cards', label: 'Cartões', icon: 'grid' }, { id: 'list', label: 'Lista', icon: 'list' }], state.employerDisplay, 'employer-display');
    const classificationHelp = 'Parceira direta = confirmação manual. Apresentada pela NectaNet = origem do contato. Empresa geral = sem parceria confirmada.';
    const list = W.table({ id: 'employers', rows, columns: [
      { key: 'nome', label: 'Empregador', required: true, render: (r) => { const color = window.T4Modern?.color(r) || '#7890a4'; return `<div class="v25-employer-cell" style="--employer-color:${a(color)}"><i></i>${W.person(r.nome, r.area_atuacao || '', '', 'employer-detail', r.id)}</div>`; } },
      { key: 'cidade', label: 'Cidade' }, { key: 'contato_principal', label: 'Contato principal' }, { key: 'email_principal', label: 'E-mail' }, { key: 'responsavel_interno', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(M.activeRecord(r) ? (r.status || 'Ativo') : 'Arquivado') },
      { key: 'classification', label: 'Classificação', sort: false, render: (r) => R.employerClassificationHtml(r) },
      { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: (r) => actions(r, 'employer') }
    ] });
    return workViews('employers') + scopeBar + classificationBar + `<p class="v25-classification-help">${e(classificationHelp)}</p>` + toolbar(state.employers, { noMonth: true }) + displayBar + (state.employerDisplay === 'cards' ? employerCards(rows) : list);
  }
  // A tela de Planejamento trabalha com um mês visível por vez. O stepper
  // permite navegar indefinidamente entre anos sem transformar um filtro em
  // uma lista impossível de usar quando chegarem períodos futuros.
  function planningDaysOpen(row) {
    if (!row.start_date) return null;
    const start = new Date(`${row.start_date}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    return Math.max(0, Math.round((Date.now() - start.getTime()) / 86400000));
  }
  function planningAgingCell(row) {
    const days = planningDaysOpen(row);
    if (days == null) return '<span class="t4-muted">Sem data de início</span>';
    const label = days === 0 ? 'Iniciado hoje' : `há ${days} dia${days === 1 ? '' : 's'}`;
    return days >= 21 ? U.badge(label, 'danger') : days >= 10 ? U.badge(label, 'warning') : e(label);
  }
  function shiftMonth(value, delta) {
    const date = new Date(`${value}-01T12:00:00`);
    if (Number.isNaN(date.getTime())) return M.today().slice(0, 7);
    date.setMonth(date.getMonth() + delta);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  function planningMonthStepper() {
    const isCurrent = state.planningMonth === M.today().slice(0, 7);
    return `<div class="t4-calendar-heading"><div>${W.button('Anterior', 'planning-month-prev', '', { className: 'sm' })}<h2>${e(monthLabel(state.planningMonth))}</h2>${W.button('Próximo', 'planning-month-next', '', { className: 'sm' })}</div>${isCurrent ? '' : W.button('Mês atual', 'planning-month-today', '', { className: 'sm primary' })}</div>`;
  }
  function operationsMonthStepper() {
    const current = periodKey(M.today()), selected = state.operationsMonth || current;
    return `<div class="t4-calendar-heading org-operations-month-stepper"><div><span class="org-panel-kicker">MÊS DE EXECUÇÃO</span>${W.button('Anterior', 'operations-month-prev', '', { className: 'sm' })}<h2>${e(monthLabel(selected))}</h2>${W.button('Próximo', 'operations-month-next', '', { className: 'sm' })}</div>${selected === current ? '' : W.button('Mês atual', 'operations-month-today', '', { className: 'sm primary' })}</div>`;
  }
  function meetingsMonthStepper() {
    const current = periodKey(M.today()), selected = state.meetingsMonth || current;
    return `<div class="t4-calendar-heading org-operations-month-stepper"><div><span class="org-panel-kicker">MÊS DE REFERÊNCIA</span>${W.button('Anterior', 'meetings-month-prev', '', { className: 'sm' })}<h2>${e(monthLabel(selected))}</h2>${W.button('Próximo', 'meetings-month-next', '', { className: 'sm' })}</div>${selected === current ? '' : W.button('Mês atual', 'meetings-month-today', '', { className: 'sm primary' })}</div>`;
  }
  function planningView() {
    const currentMonth = periodKey(M.today()), selectedMonth = state.planningMonth || currentMonth;
    const monthRows = state.plans.filter((r) => scoped(r) && matchQuery(r) && String(r.month_ref) === selectedMonth);
    const openRows = state.plans.filter((r) => scoped(r) && matchQuery(r) && M.isOpen(r.status));
    const dueOf = (r) => M.dateOnly(r.end_date || r.start_date);
    const priorityRank = { critica: 0, alta: 1, media: 2, normal: 2, baixa: 3 };
    const planSort = (left, right) => (M.isOpen(left.status) ? 0 : 1) - (M.isOpen(right.status) ? 0 : 1) || (priorityRank[M.norm(left.priority)] ?? 9) - (priorityRank[M.norm(right.priority)] ?? 9) || String(dueOf(left) || '9999').localeCompare(String(dueOf(right) || '9999')) || M.norm(left.activity_label).localeCompare(M.norm(right.activity_label), 'pt-BR');
    const historyDateOf = (r) => M.dateOnly(r.completed_at) || M.dateOnly(r.updated_at) || M.dateOnly(r.created_at) || M.dateOnly(r.end_date) || M.dateOnly(r.start_date) || M.dateOnly(r.month_ref);
    const historyMomentOf = (r) => String(r.completed_at || r.updated_at || r.created_at || r.end_date || r.start_date || r.month_ref || '');
    // Mesma ordem de planSort acima, só com vencida antes de prioridade
    // (pedido específico para o histórico completo) e o desempate por
    // mais recente no lugar do alfabético como penúltimo critério.
    const historyRows = [...state.plans.filter((r) => scoped(r) && matchQuery(r))].sort((left, right) => (M.isOpen(left.status) ? 0 : 1) - (M.isOpen(right.status) ? 0 : 1)
      || (M.overdue(dueOf(left), left.status) ? 0 : 1) - (M.overdue(dueOf(right), right.status) ? 0 : 1)
      || (priorityRank[M.norm(left.priority)] ?? 9) - (priorityRank[M.norm(right.priority)] ?? 9)
      || String(dueOf(left) || '9999').localeCompare(String(dueOf(right) || '9999'))
      || historyMomentOf(right).localeCompare(historyMomentOf(left), 'pt-BR', { numeric: true })
      || M.norm(left.activity_label).localeCompare(M.norm(right.activity_label), 'pt-BR'));
    const planCard = (r, index) => `<article class="org-ready-card ${index === 0 ? 'is-next' : ''} ${M.overdue(dueOf(r), r.status) ? 'is-overdue' : ''}"><div class="org-ready-card-head"><span class="org-ready-card-index">${String(index + 1).padStart(2, '0')}</span>${U.badge(M.isOpen(r.status) ? 'Em aberto' : 'Concluída', M.isOpen(r.status) ? 'warning' : 'success')}<span class="org-ready-card-deadline ${M.overdue(dueOf(r), r.status) ? 'is-overdue' : 'is-scheduled'}">${U.icon('calendar')}${e(dueOf(r) ? U.formatDate(dueOf(r)) : 'Sem prazo')}</span></div><h3><button type="button" class="t4-row-link" data-action="edit-plan" data-id="${a(r.id)}">${e(r.activity_label || 'Atividade sem título')}</button></h3><p class="org-ready-card-context">${e([employerOf(r), r.responsavel || 'sem responsável'].join(' · '))}</p><p class="org-ready-card-description">${e(r.obs || 'Sem observação registrada.')}</p><footer class="org-ready-card-footer"><span>${W.status(r.status || 'Sem status')}</span><div>${actions(r, 'plan')}</div></footer></article>`;
    const monthCards = monthRows.map(planCard).join('');
    const openCards = openRows.sort(planSort).map(planCard).join('');
    const historyTable = W.table({ id: 'planning-history', rows: historyRows, pageSize: 20, empty: 'Nenhuma atividade registrada no histórico.', columns: [
      { key: 'activity_label', label: 'Atividade', required: true, render: (r) => `<button class="t4-row-link" data-action="edit-plan" data-id="${a(r.id)}">${e(r.activity_label || 'Atividade sem título')}</button><span class="t4-cell-secondary t4-clamp-2">${e(r.obs || 'Sem observação registrada.')}</span>` },
      { key: 'history_date', label: 'Mais recente em', value: historyDateOf, render: (r) => e(historyDateOf(r) ? U.formatDate(historyDateOf(r)) : 'Data não registrada') },
      { key: 'responsavel', label: 'Responsável', render: (r) => e(r.responsavel || 'Sem responsável') }, { key: 'employer', label: 'Empregador / escopo', value: employerOf, render: (r) => e(employerOf(r)) }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }, { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: (r) => actions(r, 'plan') }
    ] });
    return `<div class="org-workspace org-planning-view">${planningMonthStepper()}${toolbar(state.plans, { noMonth: true })}<section class="t4-panel org-ready-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">ATIVIDADES DO MÊS</span><h2>Atividades de ${e(monthLabel(selectedMonth))}</h2><p>Atividades do mês selecionado, com situação e prazo visíveis.</p></div><strong class="org-panel-count">${monthRows.length} registros</strong></div><div class="t4-panel-body"><div class="org-ready-list">${monthCards || U.emptyState('Nenhuma atividade neste mês', 'Navegue para outro mês para consultar registros.')}</div></div></section><section class="t4-panel org-open-tasks-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">PENDÊNCIAS ABERTAS</span><h2>Todas as atividades em aberto</h2><p>Atividades pendentes de todos os meses, ordenadas por prioridade e prazo.</p></div><strong class="org-panel-count">${openRows.length} abertas</strong></div><div class="t4-panel-body"><div class="org-ready-list">${openCards || U.emptyState('Nenhuma atividade em aberto', 'O histórico completo fica abaixo.')}</div></div></section><section class="t4-panel org-history-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">HISTÓRICO COMPLETO</span><h2>Histórico completo</h2><p>Todos os registros: abertas primeiro e, depois, da mais recente à mais antiga.</p></div><strong class="org-panel-count">${historyRows.length} registros</strong></div><div class="t4-panel-body">${historyTable}</div></section></div>`;
  }
  function meetingsView() {
    const currentMonth = periodKey(M.today()), selectedMonth = state.meetingsMonth || currentMonth;
    const inMonth = (r) => { const explicit = periodKey(r.month_ref); return explicit ? explicit === selectedMonth : rowPeriodKeys(r).includes(selectedMonth); };
    const statusFilter = (r) => values(state.status).length ? matches(r.status, state.status) : true;
    const scopedRows = state.meetings.filter((r) => scoped(r) && matchQuery(r) && statusFilter(r));
    const monthRows = scopedRows.filter(inMonth).sort((x, y) => String(y.scheduled_at || '').localeCompare(String(x.scheduled_at || '')));
    const openRows = state.meetings.filter((r) => scoped(r) && matchQuery(r) && M.isOpen(r.status)).sort((x, y) => String(x.scheduled_at || '9999').localeCompare(String(y.scheduled_at || '9999')));
    const historyMomentOf = (r) => String(r.completed_at || r.updated_at || r.created_at || r.scheduled_at || r.month_ref || '');
    const historyDateOf = (r) => M.dateOnly(r.completed_at) || M.dateOnly(r.updated_at) || M.dateOnly(r.created_at) || M.dateOnly(r.scheduled_at) || M.dateOnly(r.month_ref);
    // Sem campo de prioridade em reuniões (não existe esse conceito aqui)
    // — abertas > vencidas (pela data agendada) > mais recente > mais
    // antigo, pulando o critério de prioridade que não se aplica.
    const historyRows = [...scopedRows].sort((left, right) => (M.isOpen(left.status) ? 0 : 1) - (M.isOpen(right.status) ? 0 : 1)
      || (M.overdue(left.scheduled_at, left.status) ? 0 : 1) - (M.overdue(right.scheduled_at, right.status) ? 0 : 1)
      || historyMomentOf(right).localeCompare(historyMomentOf(left), 'pt-BR', { numeric: true })
      || M.norm(left.topic || left.title).localeCompare(M.norm(right.topic || right.title), 'pt-BR'));
    const meetingCard = (r, index) => `<article class="org-ready-card ${index === 0 ? 'is-next' : ''} ${M.overdue(r.scheduled_at, r.status) ? 'is-overdue' : ''}"><div class="org-ready-card-head"><span class="org-ready-card-index">${String(index + 1).padStart(2, '0')}</span>${U.badge('Reunião', 'info')}<span class="org-ready-card-deadline ${M.overdue(r.scheduled_at, r.status) ? 'is-overdue' : 'is-scheduled'}">${U.icon('calendar')}${e(r.scheduled_at ? U.formatDate(r.scheduled_at, true) : 'Sem data')}</span></div><h3><button type="button" class="t4-row-link" data-action="meeting-detail" data-id="${a(r.id)}">${e(r.topic || r.title || 'Reunião sem título')}</button></h3><p class="org-ready-card-context">${e([employerOf(r), r.owner_name || 'sem responsável'].join(' · '))}</p><p class="org-ready-card-description">${e(r.pending_items || r.decision_summary || r.notes || 'Sem pendência ou decisão registrada.')}</p><footer class="org-ready-card-footer"><span>${W.status(r.status || 'Sem status')}</span><div>${actions(r, 'meeting')}</div></footer></article>`;
    const monthCards = monthRows.map(meetingCard).join('');
    const openCards = openRows.map(meetingCard).join('');
    const historyColumns = [
      { key: 'topic', label: 'Reunião / pauta', required: true, render: (r) => `<button class="t4-row-link" data-action="meeting-detail" data-id="${a(r.id)}">${e(r.topic || r.title)}</button><span class="t4-cell-secondary">${e(employerOf(r))}</span>` },
      { key: 'history_date', label: 'Mais recente em', value: historyDateOf, render: (r) => e(historyDateOf(r) ? U.formatDate(historyDateOf(r)) : 'Data não registrada') },
      { key: 'decision_summary', label: 'O que foi decidido', render: (r) => `<span class="t4-clamp-3">${e(r.decision_summary || '—')}</span>` }, { key: 'pending_items', label: 'Pendências', render: (r) => `<span class="t4-clamp-3">${e(r.pending_items || '—')}</span>` }, { key: 'owner_name', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }
    ];
    const historyTable = W.table({ id: 'meetings-history', rows: historyRows, pageSize: 20, columns: historyColumns, empty: 'Nenhuma reunião registrada ainda.' });
    return `<div class="org-workspace org-meetings-view">${meetingsMonthStepper()}${toolbar(state.meetings, { noMonth: true })}<section class="t4-panel org-ready-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">ATIVIDADES DO MÊS</span><h2>Atividades de ${e(monthLabel(selectedMonth))}</h2><p>Todas as reuniões do mês selecionado, com qualquer situação.</p></div><strong class="org-panel-count">${monthRows.length} registros</strong></div><div class="t4-panel-body"><div class="org-ready-list">${monthCards || U.emptyState('Nenhuma atividade neste mês', 'Navegue para outro mês para consultar registros.')}</div></div></section><section class="t4-panel org-open-tasks-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">PENDÊNCIAS ABERTAS</span><h2>Todas as atividades em aberto</h2><p>Reuniões pendentes de todos os períodos, organizadas para a próxima ação.</p></div><strong class="org-panel-count">${openRows.length} abertas</strong></div><div class="t4-panel-body"><div class="org-ready-list">${openCards || U.emptyState('Nenhuma atividade em aberto', 'O histórico completo fica abaixo.')}</div></div></section><section class="t4-panel org-history-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">HISTÓRICO COMPLETO</span><h2>Histórico completo</h2><p>Todos os registros: abertas primeiro e, depois, da mais recente à mais antiga.</p></div><strong class="org-panel-count">${historyRows.length} registros</strong></div><div class="t4-panel-body">${historyTable}</div></section></div>`;
  }
  function meetingDetail(row) {
    if (!row) return;
    U.openDrawer({ title: row.topic || row.title || 'Reunião', subtitle: `${employerOf(row)} · ${U.formatDate(row.scheduled_at, true)}`,
      actions: actions(row, 'meeting') + (can('tasks') ? W.button('Criar tarefa a partir da decisão', 'meeting-task', row.id, { className: 'primary', icon: 'plus' }) : ''),
      body: `<div class="t4-detail-grid">${U.field('Semana', row.week_label)}${U.field('Responsável', row.owner_name)}${U.field('Situação', row.status)}${U.field('Escopo', row.meeting_scope)}</div>${[['Decisões', row.decision_summary], ['Itens resolvidos', row.resolved_items], ['Pendências', row.pending_items], ['Próxima ação', row.next_action], ['Observações', row.notes]].map(([label, value]) => W.section(label, `<p class="t4-preserve">${e(value || 'Não informado')}</p>`)).join('')}` });
  }
  function operationsView() {
    const today = M.today(), currentMonth = periodKey(today), selectedMonth = state.operationsMonth || currentMonth;
    const inMonth = (r, month) => { const explicit = periodKey(r.month_ref); return explicit ? explicit === month : rowPeriodKeys(r).includes(month); };
    const scopedTasks = state.tasks.filter((r) => taskVisible(r) && scoped(r) && matchQuery(r));
    const monthTasks = scopedTasks.filter((r) => inMonth(r, selectedMonth));
    const allTasks = monthTasks.filter((r) => values(state.status).length ? matches(r.status, state.status) : true);
    const priorityRank = { critica: 0, alta: 1, media: 2, normal: 2, baixa: 3 };
    const dueOf = (r) => M.dateOnly(r.due_date);
    const isHigh = (r) => /alta|crit/i.test(M.norm(r.priority));
    const isUnassigned = (r) => !String(r.owner_user_key || r.assigned_user_key || '').trim();
    const isOverdue = (r) => M.overdue(dueOf(r), r.status);
    const isToday = (r) => M.isOpen(r.status) && dueOf(r) === today;
    const priorityClass = (r) => { const priority = M.norm(r.priority); return /crit/.test(priority) ? 'priority-critical' : /alta/.test(priority) ? 'priority-high' : /baixa/.test(priority) ? 'priority-low' : 'priority-medium'; };
    const deadlineClass = (r) => isOverdue(r) ? 'is-overdue' : isToday(r) ? 'is-today' : dueOf(r) ? 'is-scheduled' : 'is-no-date';
    const deadlineLabel = (r) => isOverdue(r) ? `Vencida · ${U.formatDate(dueOf(r))}` : isToday(r) ? `Hoje · ${U.formatDate(dueOf(r))}` : dueOf(r) ? `Prazo · ${U.formatDate(dueOf(r))}` : 'Sem prazo definido';
    const taskSort = (left, right) => (M.isOpen(left.status) ? 0 : 1) - (M.isOpen(right.status) ? 0 : 1) || (priorityRank[M.norm(left.priority)] ?? 9) - (priorityRank[M.norm(right.priority)] ?? 9) || (isOverdue(left) ? 0 : 1) - (isOverdue(right) ? 0 : 1) || String(dueOf(left) || '9999').localeCompare(String(dueOf(right) || '9999')) || M.norm(left.title).localeCompare(M.norm(right.title), 'pt-BR');
    const focus = ['all', 'overdue', 'today', 'high', 'unassigned'].includes(state.operationsFocus) ? state.operationsFocus : 'all';
    const matchesFocus = (r) => focus === 'all' || (M.isOpen(r.status) && ({ overdue: isOverdue(r), today: isToday(r), high: isHigh(r), unassigned: isUnassigned(r) }[focus] || false));
    const tasks = allTasks.filter(matchesFocus).sort(taskSort);
    const readyTasks = tasks.filter((r) => M.isOpen(r.status));
    const allOpenTasks = scopedTasks.filter((r) => M.isOpen(r.status)).sort(taskSort);
    const historyMomentOf = (r) => String(r.completed_at || r.updated_at || r.created_at || r.due_date || r.month_ref || '');
    const historyDateOf = (r) => M.dateOnly(r.completed_at) || M.dateOnly(r.updated_at) || M.dateOnly(r.created_at) || M.dateOnly(r.due_date) || M.dateOnly(r.month_ref);
    // Abertas > vencidas > alta prioridade > prazo mais próximo > mais
    // recente > mais antigo por último — mesmos critérios de taskSort
    // acima, só na ordem pedida especificamente para o histórico
    // completo (vencida antes de prioridade, não depois).
    const historySort = (left, right) => (M.isOpen(left.status) ? 0 : 1) - (M.isOpen(right.status) ? 0 : 1)
      || (isOverdue(left) ? 0 : 1) - (isOverdue(right) ? 0 : 1)
      || (priorityRank[M.norm(left.priority)] ?? 9) - (priorityRank[M.norm(right.priority)] ?? 9)
      || String(dueOf(left) || '9999').localeCompare(String(dueOf(right) || '9999'))
      || historyMomentOf(right).localeCompare(historyMomentOf(left), 'pt-BR', { numeric: true })
      || M.norm(left.title).localeCompare(M.norm(right.title), 'pt-BR');
    const historyRows = [...scopedTasks].sort(historySort);
    const open = allTasks.filter((r) => M.isOpen(r.status)).length, overdue = allTasks.filter(isOverdue).length, todayCount = allTasks.filter(isToday).length, high = allTasks.filter((r) => M.isOpen(r.status) && isHigh(r)).length, unassigned = allTasks.filter((r) => M.isOpen(r.status) && isUnassigned(r)).length;
    const taskCount = (bucket) => ({ overdue, today: todayCount, high, unassigned }[bucket] ?? 0);
    const display = ['activities', 'all'].includes(state.operationsDisplay) ? state.operationsDisplay : 'activities';
    const focusBar = `<div class="org-focus-bar org-operations-focus-bar"><div class="org-focus-group"><span class="org-focus-label">Mostrar</span>${W.chips([{ id: 'activities', label: 'Atividades', count: open, icon: 'activity' }, { id: 'all', label: 'Todos', count: allTasks.length, icon: 'list' }], display, 'operations-display')}</div><div class="org-focus-group"><span class="org-focus-label">Filtrar</span>${W.chips([{ id: 'all', label: 'Todas', count: allTasks.length, icon: 'list' }, { id: 'overdue', label: 'Vencidas', count: taskCount('overdue'), icon: 'warning' }, { id: 'today', label: 'Para hoje', count: taskCount('today'), icon: 'calendar' }, { id: 'high', label: 'Alta prioridade', count: taskCount('high'), icon: 'activity' }, { id: 'unassigned', label: 'Sem responsável', count: taskCount('unassigned'), icon: 'people' }], focus, 'operations-focus')}</div></div>`;
    const taskCard = (r, index) => `<article class="org-ready-card ${index === 0 ? 'is-next' : ''} ${isOverdue(r) ? 'is-overdue' : ''} ${priorityClass(r)}" data-ready-task="${a(r.id)}"><div class="org-ready-card-head"><span class="org-ready-card-index">${String(index + 1).padStart(2, '0')}</span>${U.badge(r.priority || 'Normal', isHigh(r) ? 'danger' : M.norm(r.priority) === 'media' ? 'warning' : '')}<span class="org-ready-card-deadline ${deadlineClass(r)}">${U.icon('calendar')}${e(deadlineLabel(r))}</span></div><h3><button type="button" class="t4-row-link" data-action="edit-task" data-id="${a(r.id)}">${e(r.title || 'Tarefa sem título')}</button></h3><p class="org-ready-card-context">${e([employerOf(r), responsibleLabels(r) || 'sem responsável'].join(' · '))}</p><p class="org-ready-card-description">${e(r.description || r.notes || 'Sem descrição registrada.')}</p><footer class="org-ready-card-footer"><span>${W.status(r.status || 'Sem status')}</span><div>${D.canEdit() && M.isOpen(r.status) ? W.button('Concluir', 'finish-task', r.id, { className: 'sm', icon: 'check' }) : ''}${actions(r, 'task')}</div></footer></article>`;
    const readyCards = readyTasks.map(taskCard).join('');
    const openCards = allOpenTasks.map(taskCard).join('');
    const readyBody = readyCards || U.emptyState('Nenhuma tarefa em aberto', focus === 'all' ? 'O histórico completo fica abaixo.' : 'Remova o recorte para conferir as demais tarefas abertas.');
    const taskActions = (r) => `<div class="t4-chip-row">${D.canEdit() && M.isOpen(r.status) ? W.button('Concluir', 'finish-task', r.id, { className: 'sm', icon: 'check' }) : ''}${actions(r, 'task')}</div>`;
    const taskTable = W.table({ id: 'tasks', rows: tasks, columns: [
      { key: 'title', label: 'Tarefa / entrega', required: true, render: (r) => `<button class="t4-row-link" data-action="edit-task" data-id="${a(r.id)}">${e(r.title || 'Tarefa sem título')}</button><span class="t4-cell-secondary t4-clamp-3">${e(r.description || r.notes || 'Sem descrição ou resultado registrado.')}</span>` },
      { key: 'due_date', label: 'Prazo', render: (r) => `${e(dueOf(r) ? U.formatDate(dueOf(r)) : 'Sem prazo')}${M.overdue(dueOf(r), r.status) ? U.badge('Vencida', 'danger') : dueOf(r) === today && M.isOpen(r.status) ? U.badge('Hoje', 'warning') : ''}` }, { key: 'priority', label: 'Prioridade', render: (r) => U.badge(r.priority || 'Normal', /alta|crit/i.test(M.norm(r.priority)) ? 'danger' : '') }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }, { key: 'owner_user_key', label: 'Responsáveis', render: (r) => e(responsibleLabels(r) || 'Sem responsável') }, { key: 'context_type', label: 'Empregador / escopo', render: (r) => W.stack(employerOf(r), r.team_scope) }, { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: taskActions }
    ] });
    const historyTable = W.table({ id: 'operations-history', rows: historyRows, pageSize: 20, empty: 'Nenhuma atividade registrada neste histórico.', columns: [
      { key: 'title', label: 'Atividade / entrega', required: true, render: (r) => `<button class="t4-row-link" data-action="edit-task" data-id="${a(r.id)}">${e(r.title || 'Tarefa sem título')}</button><span class="t4-cell-secondary t4-clamp-2">${e(r.description || r.notes || 'Sem descrição registrada.')}</span>` },
      { key: 'history_date', label: 'Mais recente em', value: historyDateOf, render: (r) => e(historyDateOf(r) ? U.formatDate(historyDateOf(r)) : 'Data não registrada') },
      { key: 'priority', label: 'Prioridade', render: (r) => U.badge(r.priority || 'Normal', isHigh(r) ? 'danger' : M.norm(r.priority) === 'media' ? 'warning' : '') },
      { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'owner_user_key', label: 'Responsáveis', render: (r) => e(responsibleLabels(r) || 'Sem responsável') },
      { key: 'context_type', label: 'Empregador / escopo', render: (r) => W.stack(employerOf(r), r.team_scope) },
      { key: 'notes', label: 'Resultado / observação', render: (r) => `<span class="t4-clamp-3">${e(r.notes || r.description || '—')}</span>` },
      { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: (r) => actions(r, 'task') }
    ] });
    const readyPanel = `<section class="t4-panel org-ready-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">ATIVIDADES DO MÊS</span><h2>Atividades do mês</h2><p>Pendências abertas de ${e(monthLabel(selectedMonth))}, ordenadas por prioridade e prazo.</p></div><strong class="org-panel-count">${readyTasks.length} abertas</strong></div><div class="t4-panel-body"><div class="org-ready-list">${readyBody}</div></div></section>`;
    const openPanel = `<section class="t4-panel org-open-tasks-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">PENDÊNCIAS ABERTAS</span><h2>Todas as atividades em aberto</h2><p>Inclui todos os meses para você não perder nenhuma pendência.</p></div><strong class="org-panel-count">${allOpenTasks.length} abertas</strong></div><div class="t4-panel-body"><div class="org-ready-list">${openCards || U.emptyState('Nenhuma atividade em aberto', 'As tarefas concluídas ficam no histórico completo abaixo.')}</div></div></section>`;
    const listTitle = focus === 'all' ? 'Lista completa' : 'Lista filtrada';
    const listSubtitle = focus === 'all' ? 'Todos os registros de ${monthLabel(selectedMonth)}; tarefas abertas primeiro e, depois, por prioridade.' : 'Registros do filtro atual, ordenados por status aberto e prioridade.';
    const listPanel = `<section class="t4-panel org-all-tasks-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">CONSULTAR HISTÓRICO</span><h2>${listTitle}</h2><p>${e(listSubtitle)}</p></div><strong class="org-panel-count">${tasks.length} registros</strong></div><div class="t4-panel-body">${taskTable}</div></section>`;
    const surface = display === 'activities' ? `${readyPanel}${openPanel}` : listPanel;
    const historyPanel = `<section class="t4-panel org-history-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">HISTÓRICO COMPLETO</span><h2>Histórico completo</h2><p>Todas as atividades deste recorte, sem limitar ao período acima: abertas primeiro; depois, da mais recente para a mais antiga.</p></div><strong class="org-panel-count">${historyRows.length} registro${historyRows.length === 1 ? '' : 's'}</strong></div><div class="t4-panel-body">${historyTable}</div></section>`;
    return `<div class="org-workspace org-operations-view">${operationsMonthStepper()}${focusBar}${toolbar(allTasks, { noMonth: true })}${surface}${historyPanel}</div>`;
  }
  function summaryView() {
    const manual = state.summaries.map((r) => ({ ...r, title: r.what_was_done, detail: r.result_summary, next: r.next_action, due: r.period_end, owner: r.owner_name, type: 'Resumo manual', action: 'edit-summary' }));
    const rows = filtered([...events(), ...manual], 'due');
    return toolbar(rows) + W.note('Esta visão reúne registros das fontes existentes. Planejamento e reuniões continuam independentes; não são copiados nem regravados para gerar o resumo.') + eventTable(rows, 'summary');
  }
  function calendarView() {
    const [year, month] = state.calendar.split('-').map(Number);
    const first = new Date(year, month - 1, 1), offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month - 1, 1 - offset);
    // Ao contrário das filas de trabalho (Planejamento, PO), a agenda é um
    // calendário: mostra o que aconteceu num dia, não só o que ainda está
    // aberto. Escondendo "Concluído" por padrão, marcar uma atividade como
    // concluída a fazia sumir do próprio dia em que ela aconteceu — pedido
    // explícito para corrigir. Mostra tudo, a menos que o usuário filtre
    // por uma situação específica.
    const rows = events().filter((r) => scoped(r) && matchQuery(r) && (values(state.status).length ? matches(r.status, state.status) : true));
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayEvents = rows.filter((r) => M.dateOnly(r.due) === key);
      return `<div class="t4-calendar-day ${d.getMonth() === month - 1 ? '' : 'outside'} ${key === M.today() ? 'today' : ''}"><div class="t4-calendar-date">${d.getDate()}</div>${dayEvents.map((r) => `<button class="t4-calendar-event ${/Reunião/.test(r.type) ? 'meeting' : ''}" data-action="${a(r.action)}" data-id="${a(r.id)}" title="${a(employerOf(r) + ' · ' + r.title)}"><small>${e(r.type)}</small>${e(r.title)}</button>`).join('')}</div>`;
    });
    return toolbar(rows, { noMonth: true }) + `<div class="t4-calendar-heading"><div>${W.button('Anterior', 'month-prev', '', { className: 'sm' })}<h2>${e(first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2>${W.button('Próximo', 'month-next', '', { className: 'sm' })}</div>${W.button('Hoje', 'month-today', '', { className: 'sm' })}${can('plans') ? W.button('Novo planejamento', 'new-plan', '', { className: 'primary sm', icon: 'plus' }) : ''}</div><div class="t4-calendar"><div class="t4-calendar-weekdays">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<span>${d}</span>`).join('')}</div><div class="t4-calendar-grid">${days.join('')}</div></div>${W.section('Sem prazo definido', eventTable(rows.filter((r) => !r.due && M.isOpen(r.status)), 'no-date'))}`;
  }
  function opportunitiesView() {
    const scope = state.opportunityScope || 'open';
    const isClosed = (r) => /fechad|cancel|arquiv|removid|encerr/i.test(M.norm(r.status || '')) || !!r.deleted_at;
    const rows = state.openings.filter((r) => {
      if (scope === 'open' && isClosed(r)) return false;
      if (scope === 'closed' && !isClosed(r)) return false;
      return scoped(r) && matchQuery(r) && matches(r.status, state.status);
    });
    const count = (id) => state.openings.filter((r) => id === 'open' ? !isClosed(r) : id === 'closed' ? isClosed(r) : true).length;
    const scopeBar = W.chips([{ id: 'open', label: 'Abertas', count: count('open'), icon: 'briefcase' }, { id: 'all', label: 'Todas', count: count('all'), icon: 'list' }, { id: 'closed', label: 'Encerradas', count: count('closed'), icon: 'archive' }], scope, 'opportunity-scope');
    return workViews('opportunities') + `<div class="v25-page-intro"><div><span class="mx-eyebrow">MERCADO DE OPORTUNIDADES</span><h2>Oportunidades separadas das seleções.</h2><p>Uma vaga pode receber vários Talentos; a etapa de cada vínculo fica em Seleções.</p></div><span class="v25-result-count">${rows.length} vaga${rows.length === 1 ? '' : 's'}</span></div>` + scopeBar + toolbar(state.openings, { noMonth: true }) + opportunityRegister(rows, scope);
  }
  const GENERAL_LINK_STAGE_ORDER = Object.freeze(['Aguardando retorno', 'Aguardando envio', 'Aguardando resposta', 'Reunião marcada', 'Em processo', 'Gostou', 'Não gostou', 'Contratado', 'Removido', 'Excluído', 'Sem etapa']);
  const GENERAL_LINK_STAGE_RANK = new Map(GENERAL_LINK_STAGE_ORDER.map((stage, index) => [M.norm(stage), index]));
  const generalLinkStageRank = (row) => GENERAL_LINK_STAGE_RANK.get(M.norm(row?.stage)) ?? GENERAL_LINK_STAGE_ORDER.length;
  const isGeneralLink = (row) => row?.modern === false;
  const compareSelectionDateDesc = (left, right, field) => {
    const leftTime = Date.parse(String(left?.[field] || ''));
    const rightTime = Date.parse(String(right?.[field] || ''));
    const leftHasDate = Number.isFinite(leftTime), rightHasDate = Number.isFinite(rightTime);
    if (leftHasDate && !rightHasDate) return -1;
    if (!leftHasDate && rightHasDate) return 1;
    if (leftHasDate && rightHasDate && leftTime !== rightTime) return rightTime - leftTime;
    return 0;
  };

  function pipelineView() {
    const rows = state.selections.rows.filter((r) => {
      const talent = W.find(state.talents, r.talent_id);
      return M.isTalent(talent || {}) && scoped(r) && matchQuery({ ...r, talent: R.talentName(state, r.talent_id), employer: employerOf(r) }) && matches(r.stage, state.status);
    });
    const activeRows = rows.filter((r) => M.selectionBucket(r) !== 'closed');
    const closedRows = rows.filter((r) => M.selectionBucket(r) === 'closed');
    const scope = ['active', 'all', 'closed'].includes(state.selectionScope) ? state.selectionScope : 'active';
    const visibleRows = scope === 'closed' ? closedRows : scope === 'all' ? rows : activeRows;
    const display = state.selectionDisplay === 'cards' ? 'cards' : 'list';
    // "Mais recente" considera a última movimentação registrada no vínculo;
    // a próxima ação continua sendo usada apenas para ordenar os painéis de
    // acompanhamento abertos.
    const recencyOf = (r) => String(r.updated_at || r.responded_at || r.sent_at || r.created_at || '');
    const byRecency = (left, right) => recencyOf(right).localeCompare(recencyOf(left), 'pt-BR', { numeric: true });
    const generalRows = rows.filter(isGeneralLink);
    // SELEÇÕES EM ABERTO e CONTRATADOS precisam de todo mundo (vagas
    // modernas e vínculos gerais), não só generalRows — diferente de
    // stagePulse logo abaixo, que é deliberadamente só sobre o vínculo
    // geral. Sem isto, uma seleção nova de vaga moderna não aparecia em
    // nenhum dos dois painéis (achado que motivou remover os painéis por
    // engano em vez de alargar a fonte).
    const openPipelineRows = rows.filter((r) => M.selectionBucket(r) !== 'closed' && M.selectionBucket(r) !== 'hired')
      .sort((left, right) => generalLinkStageRank(left) - generalLinkStageRank(right)
        || compareSelectionDateDesc(left, right, 'next_action_at')
        || byRecency(left, right)
        || M.norm(R.talentName(state, left.talent_id)).localeCompare(M.norm(R.talentName(state, right.talent_id)), 'pt-BR'));
    const hiredRows = rows.filter((r) => M.selectionBucket(r) === 'hired').sort(byRecency);
    const selectionCard = (r, index) => {
      const opening = W.find(state.openings, r.opening_id), overdue = M.overdue(r.next_action_at, r.status);
      return `<article class="org-ready-card ${index === 0 ? 'is-next' : ''} ${overdue ? 'is-overdue' : ''}" data-ready-selection="${a(r.key)}"><div class="org-ready-card-head"><span class="org-ready-card-index">${String(index + 1).padStart(2, '0')}</span>${W.status(r.stage)}<span class="org-ready-card-deadline ${overdue ? 'is-overdue' : r.next_action_at ? 'is-scheduled' : 'is-no-date'}">${U.icon('calendar')}${e(r.next_action_at ? U.formatDate(r.next_action_at) : 'Sem prazo')}</span></div><h3><button type="button" class="t4-row-link" data-action="selection-detail" data-id="${a(r.key)}">${e(R.talentName(state, r.talent_id))}</button></h3><p class="org-ready-card-context">${e([employerOf(r), opening?.title || 'Vínculo geral · anterior à V2'].join(' · '))}</p><p class="org-ready-card-description">${e(r.next_action || 'Definir próxima ação')}</p><footer class="org-ready-card-footer"><span>${e(r.owner_username || 'Sem responsável')}</span><div>${W.button('Abrir', 'selection-detail', r.key, { className: 'sm', icon: 'chevron' })}</div></footer></article>`;
    };
    const openSelectionGroups = [
      { id: 'review', label: 'Em análise', description: 'Triagem e avaliação inicial.' },
      { id: 'sent', label: 'Apresentados', description: 'Relações já enviadas ou em acompanhamento de retorno.' },
      { id: 'interview', label: 'Entrevistas', description: 'Reuniões e entrevistas marcadas ou em andamento.' },
      { id: 'offer', label: 'Propostas', description: 'Retorno positivo e propostas em negociação.' }
    ];
    const openSelectionSections = openSelectionGroups.map((group) => {
      const groupRows = openPipelineRows.filter((r) => M.selectionBucket(r) === group.id);
      return `<section class="org-selection-stage-group is-${group.id}" data-selection-stage-group="${group.id}"><header class="org-selection-stage-group-head"><div><span class="org-selection-stage-kicker">ETAPA DO VÍNCULO</span><h3>${e(group.label)}</h3><p>${e(group.description)}</p></div><strong class="org-selection-stage-count">${groupRows.length}</strong></header><div class="org-ready-list org-selection-stage-cards">${groupRows.map(selectionCard).join('') || U.emptyState('Nenhuma seleção nesta etapa', 'Novas relações aparecerão aqui quando chegarem a esta fase.')}</div></section>`;
    }).join('');
    const openPanel = `<section class="t4-panel org-open-tasks-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">SELEÇÕES EM ABERTO</span><h2>Todas as seleções em aberto</h2><p>Separadas por etapa do vínculo; dentro de cada grupo, pela data da próxima ação mais recente.</p></div><strong class="org-panel-count">${openPipelineRows.length} abertas</strong></div><div class="t4-panel-body"><div class="org-selection-stage-groups" aria-label="Seleções abertas separadas por etapa">${openSelectionSections}</div></div></section>`;
    const hiredPanel = `<section class="t4-panel org-ready-panel"><div class="t4-panel-head"><div><span class="org-panel-kicker">CONTRATADOS</span><h2>Contratações mais recentes</h2><p>Seleções na etapa Contratado, da mais recente para a mais antiga.</p></div><strong class="org-panel-count">${hiredRows.length} contratada${hiredRows.length === 1 ? '' : 's'}</strong></div><div class="t4-panel-body"><div class="org-ready-list">${hiredRows.map(selectionCard).join('') || U.emptyState('Nenhuma contratação registrada ainda', 'Assim que uma seleção avançar para Contratado, ela aparece aqui.')}</div></div></section>`;

    const historyRows = rows
      .filter((r) => /^(excluid[oa]|removid[oa])/.test(M.norm(r.stage || r.status || '')))
      .sort(byRecency);
    const historySection = W.section('Histórico de excluídos e removidos',
      historyRows.length ? R.selectionTable(state, historyRows, 'org-selection-history') : U.emptyState('Nenhum registro excluído ou removido', 'Os registros retirados do acompanhamento aparecerão aqui.'),
      U.badge(historyRows.length, historyRows.length ? 'info' : 'neutral'),
      'Fora do acompanhamento ativo; preservado somente para consulta.');
    const sortedVisibleRows = [...visibleRows].sort(byRecency);
    const current = display === 'cards' && scope !== 'closed'
      ? R.selectionBoard(state, sortedVisibleRows)
      : R.selectionAnalytics(state, visibleRows, { scope, idPrefix: 'org-selection' });
    // Lista analítica mantém os painéis de trabalho (abertas por etapa +
    // contratados); Quadro opcional mostra só o Kanban. Painéis e tabela
    // agora vêm da mesma coleção (rows) — o problema que motivou removê-los
    // era a fonte restrita a generalRows, já corrigido acima.
    const analyticalPanels = display === 'list' && scope !== 'closed' ? openPanel + hiredPanel : '';
    const scopeBar = W.chips([
      { id: 'active', label: 'Em andamento', count: activeRows.length, icon: 'columns' },
      { id: 'all', label: 'Todas as relações', count: rows.length, icon: 'list' },
      { id: 'closed', label: 'Encerradas', count: closedRows.length, icon: 'archive' }
    ], scope, 'selection-scope');
    const displayBar = W.chips([
      { id: 'list', label: 'Lista analítica', icon: 'list' },
      { id: 'cards', label: 'Quadro opcional', icon: 'columns' }
    ], display, 'selection-display');
    return workViews('pipeline') + `<div class="v25-page-intro"><div><span class="mx-eyebrow">CENTRO DE SELEÇÕES</span><h2>Acompanhe cada vínculo por etapa.</h2><p>Seleção = Talento + empregador + vaga + etapa. O cadastro do Talento e o dossiê do empregador continuam sendo únicos.</p></div><span class="v25-result-count">${activeRows.length} ativa${activeRows.length === 1 ? '' : 's'}</span></div>` + scopeBar + displayBar + toolbar(rows.map((r) => ({ status: r.stage })), { noMonth: true }) + current +
      W.section('Reposições', replacementTable(state.replacements.filter(scoped)), can('replacements') ? W.button('Nova reposição', 'new-replacement', '', { className: 'sm', icon: 'plus' }) : '');
  }
  function selectionRegister(rows, closed = false) {
    if (!rows.length) return `<div class="mx-empty"><strong>${closed ? 'Nenhuma seleção encerrada neste filtro.' : 'Nenhuma seleção neste filtro.'}</strong><span>Use filtros diferentes ou crie uma relação a partir de uma vaga válida.</span></div>`;
    const groups = new Map();
    rows.forEach((r) => { const key = String(r.employer_id || 'internal'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
    const active = rows.filter((r) => !closed && M.isOpen(r.status)).length, overdue = rows.filter((r) => M.overdue(r.next_action_at, r.status)).length;
    const metrics = `<div class="mx-metric-strip"><div><span>Relações</span><strong>${rows.length}</strong></div><div><span>Empregadores</span><strong>${groups.size}</strong></div><div><span>Próximas ações</span><strong>${active}</strong></div><div class="${overdue ? 'risk' : ''}"><span>Vencidas</span><strong>${overdue}</strong></div></div>`;
    const blocks = [...groups.entries()].map(([key, items]) => { const emp = W.find(state.employers, key) || { id:key, nome:employerOf(items[0]) }, color = window.T4Modern?.color(emp) || '#7890a4';
      return `<section class="mx-register-group" style="--employer-color:${a(color)}"><header><div>${window.T4Modern?.employer ? window.T4Modern.employer(emp) : `<strong>${e(emp.nome)}</strong>`}<span>${items.length} relação(ões) · ${items.filter((r) => M.selectionBucket(r) === 'hired').length} contratação(ões)</span></div><button type="button" class="t4-btn ghost sm" data-action="go-employer" data-id="${a(key)}">Abrir empregador</button></header><div class="mx-register-rows">${items.map((r) => { const talent = W.find(state.talents, r.talent_id), opening = W.find(state.openings, r.opening_id); return `<article class="mx-register-row"><div class="mx-register-person"><span class="t4-avatar sm">${e(U.initials(talent?.nome_completo || R.talentName(state,r.talent_id)))}</span><div><button class="t4-row-link" data-action="selection-detail" data-id="${a(r.key)}">${e(R.talentName(state,r.talent_id))}</button><span>${e(talent?.profissao_principal || talent?.area_profissional || 'Área não informada')}</span></div></div><div><strong>${e(opening?.title || 'Vínculo geral anterior')}</strong><span>${e([opening?.location, talent?.nivel_alemao ? `Alemão ${talent.nivel_alemao}` : ''].filter(Boolean).join(' · ') || 'Detalhes da vaga não informados')}</span></div><div>${W.status(r.stage)}<span class="mx-register-meta">${e(r.viability || 'Viabilidade não avaliada')}</span></div><div class="mx-next"><strong>${e(r.next_action || 'Definir próxima ação')}</strong><span>${e([r.next_action_at ? U.formatDate(r.next_action_at) : 'Sem prazo', r.owner_username || 'Sem responsável'].join(' · '))}</span></div><div class="mx-register-actions">${D.canEdit() ? W.button('Editar','edit-selection',r.key,{className:'ghost sm',icon:'edit'}) : ''}${W.button('Detalhes','selection-detail',r.key,{className:'sm'})}</div></article>`; }).join('')}</div></section>`;
    }).join('');
    return metrics + `<div class="mx-register" aria-label="Registro de seleções">${blocks}</div>`;
  }
  // 'critical', não 'danger': tom do .t4-funnel-seg (t4-components.css)
  // é um vocabulário próprio (info/warning/success/critical), diferente
  // do U.badge usado em outro lugar do app. Com 'danger' o segmento não
  // batia com nenhuma classe CSS e caía no cinza neutro sem tom.
  const SELECTION_BUCKET_TONE = { review: '', sent: 'info', interview: 'info', offer: 'warning', hired: 'success', closed: 'critical' };
  // As seleções misturam duas taxonomias (vagas modernas: Mapeado…Contratado;
  // vínculos anteriores: Aguardando envio…Removido). Um funil com etapas fixas
  // de uma só taxonomia esconde a outra inteira. Aqui o funil conta a etapa
  // real de cada linha (campo "Etapa do vínculo") e só usa M.selectionBucket
  // — a mesma classificação do quadro Kanban — para ordenar e colorir.
  function stagePulse(rows) {
    const counts = new Map();
    rows.filter(isGeneralLink).forEach((r) => { const stage = r.stage || 'Sem etapa'; counts.set(stage, (counts.get(stage) || 0) + 1); });
    const bucketOf = (stage) => M.selectionBucket({ stage, status: '' });
    const buckets = [...counts.entries()]
      .sort((left, right) => generalLinkStageRank({ stage: left[0] }) - generalLinkStageRank({ stage: right[0] }) || right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
      .map(([stage, count]) => ({ label: stage, tone: SELECTION_BUCKET_TONE[bucketOf(stage)] || '', count }));
    return W.funnelChart('Distribuição por etapa do vínculo geral', 'LEITURA RÁPIDA', `${rows.length} vínculo${rows.length === 1 ? '' : 's'} gerais`, buckets);
  }
  function opportunityRegister(rows, scope = 'open') {
    if (!rows.length) return `<div class="mx-empty"><strong>Nenhuma oportunidade encontrada.</strong><span>Cadastre vagas no Organizacional ou limpe os filtros.</span></div>`;
    return W.table({ id: 'org-opportunities', rows, columns: [
      { key: 'title', label: 'Oportunidade', required: true, render: (r) => `<button class="t4-row-link" data-action="opening-detail" data-id="${a(r.id)}">${e(r.title || 'Oportunidade sem nome')}</button><span class="t4-cell-secondary">${e(r.area || 'Área não informada')}</span>` },
      { key: 'employer_id', label: 'Empregador', value: employerOf, render: (r) => { const emp = W.find(state.employers, r.employer_id) || { id: r.employer_id, nome: employerOf(r) }; const color = window.T4Modern?.color(emp) || '#7890a4'; return `<div class="v25-employer-cell" style="--employer-color:${a(color)}"><i></i>${W.person(emp.nome, '', '', 'employer-detail', r.employer_id)}</div>`; } },
      { key: 'quantity', label: 'Posições', render: (r) => W.stack(r.quantity || 0, 'posição(ões)') },
      { key: 'location', label: 'Local' }, { key: 'language_requirement', label: 'Idioma' },
      { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'linked', label: 'Talentos vinculados', value: (r) => state.selections.rows.filter((s) => M.same(s.opening_id, r.id) && (scope === 'all' || scope === 'open' && M.selectionBucket(s) !== 'closed' || scope === 'closed' && M.selectionBucket(s) === 'closed')).length, render: (r) => { const linked = state.selections.rows.filter((s) => M.same(s.opening_id, r.id) && (scope === 'all' || scope === 'open' && M.selectionBucket(s) !== 'closed' || scope === 'closed' && M.selectionBucket(s) === 'closed')); return W.stack(linked.length, linked.length === 1 ? 'talento' : 'talentos'); } },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => `<div class="t4-chip-row">${actions(r, 'opening')}${W.button('Dossiê', 'opening-detail', r.id, { className: 'sm' })}</div>` }
    ], empty: 'Cadastre uma vaga ou ajuste os filtros.' });
  }
  function replacementTable(rows) {
    return W.table({ id: 'replacements', rows, columns: [
      { key: 'profile_needed', label: 'Perfil procurado', required: true }, { key: 'employer', label: 'Empregador', value: employerOf, render: (r) => e(employerOf(r)) }, { key: 'replaces_candidate_name_snapshot', label: 'Substitui' }, { key: 'priority', label: 'Prioridade' }, { key: 'search_status', label: 'Situação', render: (r) => W.status(r.search_status) }, { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: (r) => actions(r, 'replacement') }
    ] });
  }
  function employerDetail(row) {
    if (!row) return;
    const id = row.id, relationships = state.selections.rows.filter((r) => M.same(r.employer_id, id)), select = relationships.filter((r) => M.selectionBucket(r) !== 'closed'), closedSelect = relationships.filter((r) => M.selectionBucket(r) === 'closed');
    const related = (r) => M.same(r.employer_id, id) || (!r.employer_id && M.norm(r.employer_name_snapshot) === M.norm(row.nome));
    U.openDrawer({ title: row.nome, subtitle: [row.area_atuacao, row.cidade, row.pais].filter(Boolean).join(' · '),
      actions: actions(row, 'employer') + W.link('Contatos vinculados', `./contatos.html?employer=${encodeURIComponent(id)}`, 'contact') + (can('openings') ? W.button('Nova vaga', 'new-opening-for', id, { className: 'primary sm', icon: 'plus' }) : ''),
      body: `${R.employerClassificationHtml(row)}<p class="v25-classification-help">Parceira Talents 4 exige confirmação direta. A origem “Apresentada pela NectaNet” é informativa e não altera a parceria nem a etapa de nenhuma seleção.</p><div class="t4-detail-grid">${U.field('Responsável', row.responsavel_interno)}${U.field('Situação', row.status)}${U.field('Contato principal', row.contato_principal)}${U.field('E-mail', row.email_principal)}${U.field('Telefone', row.telefone)}${U.field('Alemão mínimo', row.nivel_alemao_minimo)}</div>
        ${W.section('Contexto da parceria', `<p class="t4-preserve">${e(row.descricao_operacional || row.descricao_resumida || 'Não informado')}</p><div class="t4-detail-grid">${U.field('Áreas-foco', row.area_atuacao)}${U.field('Perfis buscados', row.perfis_buscados)}${U.field('Requisitos', row.requisitos_principais)}${U.field('Diferenciais', row.diferenciais_desejaveis)}</div>${W.external('Site / referência', row.site)}`)}
        ${W.section('Seleções em andamento', R.selectionTable(state, select, 'dossier-selections'))}${closedSelect.length ? W.section('Histórico de seleções encerradas', R.selectionTable(state, closedSelect, 'dossier-closed-selections'), U.badge(`${closedSelect.length} preservada(s)`, 'info')) : ''}
        ${W.section('Próximas ações e reuniões', eventTable(events().filter(related), 'dossier-events'))}
        ${W.section('Reposições', replacementTable(state.replacements.filter(related)))}
        ${W.section('Observações internas', `<p class="t4-preserve">${e(row.observacoes_internas || 'Não informadas')}</p>`)}
        ${W.note('Informações que existam somente no acervo anterior podem ser consultadas sem restaurar ou sobrescrever o banco.')}${W.button('Consultar acervo anterior', 'go', 'history', { className: 'sm', icon: 'history' })}${R.storedFields(row, [
          'id', 'nome', 'responsavel_interno', 'status', 'contato_principal', 'email_principal', 'telefone', 'nivel_alemao_minimo',
          'descricao_operacional', 'descricao_resumida', 'area_atuacao', 'perfis_buscados', 'requisitos_principais', 'diferenciais_desejaveis', 'site',
          'observacoes_internas',
          'presented_by_nectanet', 'source_channel', 'direct_talents4_partnership', 'partnership_status', 'company_scope', 'classification_confidence', 'classification_source', 'classification_notes'
        ])}` });
  }
  const EMPLOYER_CLASSIFICATION_EDIT_KEYS = ['company_scope', 'direct_talents4_partnership', 'partnership_status', 'classification_notes'];
  const employerClassificationSchemaReady = (row = null) => row
    ? EMPLOYER_CLASSIFICATION_EDIT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(row, key))
    : state.employers.some((item) => EMPLOYER_CLASSIFICATION_EDIT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(item, key)));
  const EMPLOYER_CLASSIFICATION_FIELDS = [
    { section: 'Relacionamento e classificação' },
    { name: 'company_scope', label: 'Tipo de relação', type: 'select', options: [{ value: 'GENERAL', label: 'Empresa geral' }, { value: 'NECTANET_PRESENTED', label: 'Apresentada pela NectaNet' }, { value: 'TALENTS4_PARTNER', label: 'Parceira Talents 4 · escopo' }, { value: 'EXTERNAL_BW', label: 'Externa · BW' }, { value: 'UNKNOWN', label: 'Não definido' }], help: 'Origem ou escopo comercial; não confirma parceria direta.' },
    { name: 'direct_talents4_partnership', label: 'Parceria direta Talents 4', type: 'select', options: [{ value: 'UNKNOWN', label: 'Não confirmada' }, { value: 'CONFIRMADA', label: 'Confirmada manualmente' }, { value: 'REJEITADA', label: 'Não é parceira direta' }], help: 'Só “Confirmada manualmente” exibe Parceira Talents 4.' },
    { name: 'partnership_status', label: 'Situação da parceria', type: 'select', options: [{ value: 'ACTIVE', label: 'Ativa' }, { value: 'PROSPECT', label: 'Em prospecção' }, { value: 'FORMER', label: 'Anterior' }, { value: 'PAUSED', label: 'Pausada' }, { value: 'UNKNOWN', label: 'Não definida' }] },
    { name: 'classification_notes', label: 'Justificativa / observação da classificação', type: 'textarea', wide: true }
  ];
  const EMPLOYER_FIELDS = [
    { name: 'nome', label: 'Nome do empregador', required: true, wide: true },
    ...R.fields([['area_atuacao', 'Áreas-foco'], ['subsetor', 'Subsetor'], ['cidade', 'Cidade'], ['pais', 'País'], ['contato_principal', 'Contato principal'], ['email_principal', 'E-mail', 'email'], ['telefone', 'Telefone'], ['site', 'Site / referência', 'url'], ['responsavel_interno', 'Responsável interno'], ['nivel_alemao_minimo', 'Alemão mínimo', 'select', R.LEVELS], ['descricao_resumida', 'Descrição da empresa', 'textarea'], ['descricao_operacional', 'Contexto operacional', 'textarea'], ['perfis_buscados', 'Perfis buscados', 'textarea'], ['requisitos_principais', 'Requisitos', 'textarea'], ['diferenciais_desejaveis', 'Diferenciais desejáveis', 'textarea'], ['observacoes_internas', 'Observações internas', 'textarea']]),
    { name: 'ativo', label: 'Empregador ativo', type: 'checkbox' }
  ];
  function editEmployer(row) {
    if (!D.canEdit()) return employerDetail(row);
    const classificationReady = employerClassificationSchemaReady(row);
    const classificationFields = EMPLOYER_CLASSIFICATION_FIELDS.map((field) => field.name && !classificationReady ? { ...field, readonly: true, help: 'Campos de classificação ainda não existem no Supabase. Aplique a migração aditiva e atualize a tela para poder definir este dado.' } : field);
    const data = row || { ativo: true, ...(classificationReady ? { company_scope: 'UNKNOWN', direct_talents4_partnership: 'UNKNOWN', partnership_status: 'UNKNOWN' } : {}) };
    return W.recordForm({ title: row ? 'Editar empregador' : 'Novo empregador', table: D.TABLES.employers, row: data,
      fields: [...(row ? EMPLOYER_FIELDS.filter((f) => f.name in row) : EMPLOYER_FIELDS.filter((f) => !['subsetor', 'perfis_buscados', 'requisitos_principais', 'diferenciais_desejaveis', 'observacoes_internas'].includes(f.name))), ...classificationFields],
      notice: `${classificationReady ? 'Classifique a relação com cuidado: origem NectaNet e parceria direta são dimensões diferentes.' : 'A classificação aparece como pendente porque as colunas correspondentes ainda não foram encontradas no Supabase. Nenhuma tentativa de gravação será feita nesses campos.'} Apenas a confirmação manual pode marcar uma parceira.`,
      prepare(v, changes) { if (!row) Object.assign(v, { nome_normalizado: M.norm(v.nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), tipo: 'empregador', status: 'ativo', ...(classificationReady ? { source_channel: 'UNKNOWN' } : {}) }); if ('nome' in changes) changes.nome_normalizado = M.norm(v.nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }, after: load });
  }
  function editOpening(row, employerId) {
    if (!D.canEdit()) return openingDetail(row);
    return W.recordForm({ title: row ? 'Editar vaga' : 'Nova vaga', table: D.TABLES.openings, row: row || { employer_id: employerId || firstValue(state.employer), quantity: 1, status: 'Aberta' }, fields: [
      { name: 'employer_id', label: 'Empregador', type: 'select', options: R.choices(state.employers, 'nome'), required: true }, { name: 'title', label: 'Nome da oportunidade', required: true },
      { name: 'quantity', label: 'Quantidade de posições', type: 'number', min: 1, required: true }, { name: 'status', label: 'Situação', type: 'select', options: ['Aberta', 'Em andamento', 'Pausada', 'Fechada', 'Cancelada'], required: true, placeholder: null },
      ...R.fields([['location', 'Local'], ['area', 'Área'], ['language_requirement', 'Idioma requerido'], ['recognition_requirement', 'Reconhecimento exigido'], ['external_url', 'Página da oportunidade', 'url'], ['source', 'Origem'], ['verified_at', 'Verificada em', 'datetime-local'], ['description', 'Descrição e requisitos', 'textarea']])
    ].filter((f) => !row || f.name in row), prepare(v, changes) {
      const closed = /fechad|cancelad/i.test(M.norm(v.status));
      if (!row) Object.assign(v, { order_index: 0, deleted_at: null, is_active: !closed });
      if (row && Object.prototype.hasOwnProperty.call(row, 'is_active')) {
        const nextActive = !closed;
        const storedActive = typeof row.is_active === 'string' ? String(nextActive) : nextActive;
        if ('status' in changes || row.is_active !== storedActive) changes.is_active = storedActive;
      }
    }, after: load });
  }
  function openingDetail(row) {
    if (!row) return;
    const relationships = state.selections.rows.filter((r) => M.same(r.opening_id, row.id)), activeRelationships = relationships.filter((r) => M.selectionBucket(r) !== 'closed'), closedRelationships = relationships.filter((r) => M.selectionBucket(r) === 'closed');
    U.openDrawer({ title: row.title, subtitle: employerOf(row), actions: actions(row, 'opening') + (state.selections.modern && D.canEdit() ? W.button('Vincular talento', 'selection-for-opening', row.id, { className: 'primary sm', icon: 'plus' }) : ''), body: `<div class="t4-detail-grid">${['quantity', 'status', 'location', 'area', 'language_requirement', 'recognition_requirement', 'source', 'verified_at'].map((key) => U.field({ quantity: 'Posições', status: 'Situação', location: 'Local', area: 'Área', language_requirement: 'Idioma requerido', recognition_requirement: 'Reconhecimento', source: 'Origem', verified_at: 'Última verificação' }[key], row[key])).join('')}</div><p class="t4-preserve">${e(row.description || 'Descrição não informada')}</p>${W.external('Abrir referência', row.external_url)}${W.section('Talentos em andamento', R.selectionTable(state, activeRelationships, 'opening-selections'))}${closedRelationships.length ? W.section('Histórico encerrado', R.selectionTable(state, closedRelationships, 'opening-closed-selections'), U.badge(`${closedRelationships.length} preservada(s)`, 'info')) : ''}` });
  }
  function employerFields() { return [{ name: 'employer_id', label: 'Empregador (opcional para assuntos internos)', type: 'select', options: R.choices(state.employers, 'nome') }]; }
  function snapshotEmployer(v, changes, row) {
    if (!row || 'employer_id' in changes) {
      const name = W.find(state.employers, v.employer_id)?.nome || null;
      v.employer_name_snapshot = name; if (row) changes.employer_name_snapshot = name;
    }
  }
  const PLAN_STATUS = ['A fazer', 'Em andamento', 'Concluído', 'Bloqueado', 'Cancelado'];
  function readonlyDetail(row, title) { U.openDrawer({ title, body: R.storedFields(row || {}) }); }
  function editPlan(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Atividade mensal');
    return W.recordForm({ title: row ? 'Editar atividade mensal' : 'Nova atividade mensal', table: D.TABLES.plans, row: row || { month_ref: state.planningMonth || M.today().slice(0, 7), employer_id: firstValue(state.employer), status: 'A fazer', responsavel: D.profile.nome }, fields: [
      ...employerFields(), { name: 'month_ref', label: 'Mês', type: 'month', required: true }, { name: 'activity_label', label: 'Atividade', required: true, wide: true }, { name: 'responsavel', label: 'Responsável' }, { name: 'status', label: 'Situação', type: 'select', options: PLAN_STATUS, required: true, placeholder: null }, { name: 'start_date', label: 'Início', type: 'date' }, { name: 'end_date', label: 'Fim', type: 'date' }, { name: 'obs', label: 'Observação / próxima ação', type: 'textarea', wide: true }
    ], prepare(v, c) {
      if (v.start_date && v.end_date && v.end_date < v.start_date) throw new Error('A data final precisa ser igual ou posterior à inicial.');
      snapshotEmployer(v, c, row);
      if (!row) Object.assign(v, { activity_type: 'custom', activity_key: `manual_${D.uuid().slice(0, 8)}`, order_index: 0, deleted_at: null });
    }, after: load });
  }
  function editMeeting(row) {
    if (!D.canEdit()) return meetingDetail(row);
    return W.recordForm({ title: row ? 'Editar reunião' : 'Nova reunião', table: D.TABLES.meetings, row: row || { employer_id: firstValue(state.employer), month_ref: state.meetingsMonth || M.today().slice(0, 7), status: 'A fazer', owner_name: D.profile.nome }, fields: [
      { name: 'title', label: 'Título da reunião', required: true, wide: true }, ...employerFields(), { name: 'scheduled_at', label: 'Data e hora', type: 'datetime-local' }, { name: 'month_ref', label: 'Mês de referência', type: 'month' }, { name: 'week_label', label: 'Semana' }, { name: 'owner_name', label: 'Responsável' }, { name: 'status', label: 'Situação', type: 'select', options: PLAN_STATUS, required: true, placeholder: null },
      ...R.fields([['topic', 'Pauta', 'textarea'], ['decision_summary', 'O que foi decidido', 'textarea'], ['resolved_items', 'Itens resolvidos', 'textarea'], ['pending_items', 'Pendências', 'textarea'], ['next_action', 'Próxima ação', 'textarea'], ['notes', 'Observações', 'textarea']])
    ], prepare(v, c) { snapshotEmployer(v, c, row); if (!row || 'employer_id' in c) { v.meeting_scope = v.employer_id ? 'employer' : 'internal'; v.group_name = v.employer_id ? null : 'Talents 4'; if (row) Object.assign(c, { meeting_scope: v.meeting_scope, group_name: v.group_name }); } if (!row) v.deleted_at = null; }, after: load });
  }
  async function syncTaskResponsibles(taskId, usernames, primaryUsername, currentRows = taskResponsiblesFor(taskId)) {
    const primary = String(primaryUsername || '').trim();
    const desired = [...new Set((Array.isArray(usernames) ? usernames : []).map((value) => String(value || '').trim()).filter((value) => value && M.norm(value) !== M.norm(primary)))];
    const current = [...currentRows];
    const removed = current.filter((item) => !desired.some((username) => M.norm(username) === M.norm(item.username)));
    const added = desired.filter((username) => !current.some((item) => M.norm(username) === M.norm(item.username)));
    if ((removed.length || added.length) && !available('taskResponsibles')) throw new Error('A tabela de responsáveis das tarefas ainda não está disponível. Aplique a migração 52 no Supabase antes de compartilhar uma tarefa.');
    await Promise.all(removed.map((item) => D.update(D.TABLES.taskResponsibles, item.id, { deleted_at: new Date().toISOString() }, { select: false })));
    const addedRows = [];
    for (const username of added) {
      const draft = { id: D.uuid(), task_id: String(taskId), username, deleted_at: null };
      const result = await D.upsert(D.TABLES.taskResponsibles, draft, { onConflict: 'task_id,username' });
      const saved = Array.isArray(result) ? result[0] : result;
      addedRows.push({ ...draft, ...(saved || {}), task_id: String(taskId), username, deleted_at: null });
    }
    return [...current.filter((item) => !removed.includes(item)), ...addedRows];
  }
  function editTask(row, context = {}) {
    if (!D.canEdit()) return readonlyDetail(row, 'Tarefa operacional');
    const users = activeUsers();
    const contextOwner = users.find((item) => [item.username, item.nome].some((value) => M.norm(value) === M.norm(context.owner_user_key)))?.username || context.owner_user_key;
    const primary = row?.owner_user_key || row?.assigned_user_key || contextOwner || currentUsername() || D.profile.nome;
    const initialAdditional = row ? taskResponsiblesFor(row).map((item) => item.username) : [];
    let selectedAdditional = initialAdditional;
    let requestedPrimary = primary;
    let stagedRows = row ? taskResponsiblesFor(row) : [];
    const taskRow = row ? { ...row, responsible_usernames: initialAdditional } : { ...context, employer_id: context.employer_id || firstValue(state.employer), month_ref: state.operationsMonth || M.today().slice(0, 7), status: 'A fazer', priority: 'Média', team_scope: 'private', owner_user_key: primary, assigned_user_key: primary, responsible_usernames: [] };
    const ownerField = { name: 'owner_user_key', label: 'Responsável principal', type: 'select', options: users.map((item) => ({ value: item.username, label: userLabel(item.username) })), required: true, searchable: true };
    const responsibleField = { name: 'responsible_usernames', label: 'Outros responsáveis', type: 'multi-select', options: taskResponsibleOptions(primary), wide: true, help: 'A tarefa fica visível para o responsável principal e para todos os usuários marcados aqui.' };
    return W.recordForm({ title: row ? 'Editar tarefa' : 'Nova tarefa operacional', subtitle: 'P.O. é a fila de tarefas. Cada tarefa é privada por padrão e pode ser compartilhada com outros responsáveis.', table: D.TABLES.tasks, row: taskRow, fields: [
      { name: 'title', label: 'Tarefa', required: true, wide: true }, { name: 'description', label: 'Descrição', type: 'textarea', wide: true }, ...employerFields(), { name: 'month_ref', label: 'Mês' , type: 'month' }, ownerField, responsibleField, { name: 'team_scope', label: 'Escopo da equipe', default: 'private' }, { name: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Crítica'], required: true, placeholder: null }, { name: 'status', label: 'Situação', type: 'select', options: ['A fazer', 'Em andamento', 'Bloqueado', 'Pronto', 'Cancelado'], required: true, placeholder: null }, { name: 'start_date', label: 'Início', type: 'date' }, { name: 'due_date', label: 'Prazo', type: 'date' }, { name: 'notes', label: 'Observações / resultado', type: 'textarea', wide: true }
    ], async prepare(v, c) {
      if (v.start_date && v.due_date && v.due_date < v.start_date) throw new Error('O prazo não pode ser anterior ao início.');
      selectedAdditional = Array.isArray(v.responsible_usernames) ? v.responsible_usernames : [];
      if (selectedAdditional.length && !available('taskResponsibles')) throw new Error('A tabela de responsáveis das tarefas ainda não está disponível. Aplique a migração 52 no Supabase antes de compartilhar uma tarefa.');
      delete v.responsible_usernames;
      delete c.responsible_usernames;
      requestedPrimary = v.owner_user_key || currentUsername();
      if (!row) {
        // O primeiro INSERT precisa ser visível para quem abriu a tarefa para
        // que o segundo passo possa gravar os responsáveis. Se a tarefa foi
        // criada para outra pessoa, ela começa temporariamente com o criador;
        // o after() troca o responsável principal depois de criar os vínculos.
        const creator = currentUsername();
        if (M.norm(requestedPrimary) !== M.norm(creator)) Object.assign(v, { owner_user_key: creator, assigned_user_key: creator });
        else v.assigned_user_key = v.owner_user_key;
        Object.assign(v, { context_type: context.meeting_id ? 'meeting' : v.employer_id ? 'employer' : 'internal', completed_at: v.status === 'Pronto' ? new Date().toISOString() : null, sort_index: 0, is_recurring: false, deleted_at: null, meeting_id: context.meeting_id || null });
      } else if (taskOwnerMatches(row) && M.norm(requestedPrimary) !== M.norm(currentUsername()) && !stagedRows.some((item) => M.norm(item.username) === M.norm(currentUsername()))) {
        if (!available('taskResponsibles')) throw new Error('A tabela de responsáveis das tarefas ainda não está disponível. Aplique a migração 52 no Supabase antes de transferir uma tarefa.');
        const id = D.uuid();
        const result = await D.upsert(D.TABLES.taskResponsibles, { id, task_id: String(row.id), username: currentUsername(), deleted_at: null }, { onConflict: 'task_id,username' });
        const saved = Array.isArray(result) ? result[0] : result;
        stagedRows = [...stagedRows, { id, task_id: String(row.id), username: currentUsername(), deleted_at: null, ...(saved || {}) }];
      }
      if (row && 'employer_id' in c) c.context_type = row.meeting_id ? 'meeting' : v.employer_id ? 'employer' : 'internal';
      if ('owner_user_key' in c) c.assigned_user_key = v.owner_user_key;
      if ('status' in c && (!row || Object.prototype.hasOwnProperty.call(row, 'completed_at'))) c.completed_at = v.status === 'Pronto' ? new Date().toISOString() : null;
    }, after: async (saved) => {
      const taskId = saved?.id || row?.id || taskRow.id;
      const creator = currentUsername();
      if (!row && M.norm(requestedPrimary) !== M.norm(creator)) {
        let activeRows = await syncTaskResponsibles(taskId, [...selectedAdditional, requestedPrimary, creator], '', stagedRows);
        activeRows = await syncTaskResponsibles(taskId, [...selectedAdditional, creator], '', activeRows);
        await D.update(D.TABLES.tasks, taskId, { owner_user_key: requestedPrimary, assigned_user_key: requestedPrimary }, { select: false });
        await syncTaskResponsibles(taskId, selectedAdditional, requestedPrimary, activeRows);
      } else {
        await syncTaskResponsibles(taskId, selectedAdditional, requestedPrimary || saved?.owner_user_key || taskRow.owner_user_key || creator, stagedRows);
      }
      await load();
    } });
  }
  async function finishTask(row) {
    if (!row || !D.canEdit() || !M.isOpen(row.status)) return;
    const payload = { status: 'Pronto' };
    if (Object.prototype.hasOwnProperty.call(row, 'completed_at')) payload.completed_at = new Date().toISOString();
    await D.update(D.TABLES.tasks, row.id, payload, row.updated_at ? { expectedUpdatedAt: row.updated_at } : {});
    U.toast('Tarefa concluída. A entrega continua registrada no histórico.', 'success');
    await load();
  }
  function editMetric(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Métrica');
    return W.recordForm({ title: row ? 'Editar métrica' : 'Nova métrica', table: D.TABLES.metrics, row: row || { month_ref: state.month || M.today().slice(0, 7), team_scope: 'team', target_value: 0, actual_value: 0 }, fields: [
      { name: 'metric_label', label: 'Métrica', required: true, wide: true }, { name: 'month_ref', label: 'Mês', type: 'month', required: true }, { name: 'owner_user_key', label: 'Responsável' }, { name: 'target_value', label: 'Meta', type: 'number', step: 'any', required: true }, { name: 'actual_value', label: 'Realizado', type: 'number', step: 'any', required: true }, { name: 'team_scope', label: 'Escopo' }, { name: 'notes', label: 'Leitura / contexto', type: 'textarea', wide: true }
    ], prepare(v) { if (!row) { v.metric_key = `metric_${D.uuid()}`; v.deleted_at = null; } }, after: load });
  }
  function editSummary(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Resumo');
    return W.recordForm({ title: row ? 'Editar resumo manual' : 'Novo resumo manual', table: D.TABLES.summaries, row: row || { employer_id: firstValue(state.employer), month_ref: firstValue(state.month) || M.today().slice(0, 7), status: 'Em andamento', owner_name: D.profile.nome }, fields: [
      ...employerFields(), { name: 'month_ref', label: 'Mês', type: 'month', required: true }, { name: 'week_label', label: 'Semana' }, { name: 'owner_name', label: 'Responsável' }, { name: 'period_start', label: 'Início do período', type: 'date' }, { name: 'period_end', label: 'Fim do período', type: 'date' }, { name: 'status', label: 'Situação', type: 'select', options: PLAN_STATUS, required: true, placeholder: null }, ...R.fields([['what_was_done', 'O que foi feito', 'textarea'], ['result_summary', 'Resultado', 'textarea'], ['next_action', 'Próxima ação', 'textarea'], ['notes', 'Observações', 'textarea']])
    ], prepare(v, c) { snapshotEmployer(v, c, row); if (v.period_start && v.period_end && v.period_end < v.period_start) throw new Error('Revise as datas do período.'); if (!row) Object.assign(v, { summary_scope: v.employer_id ? 'employer' : 'team', order_index: 0, deleted_at: null }); if ('employer_id' in c) c.summary_scope = v.employer_id ? 'employer' : 'team'; }, after: load });
  }
  function editReplacement(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Reposição');
    let meta = {};
    try { meta = JSON.parse(row?.notes || '{}'); } catch (_) { meta = { obs: row?.notes || '' }; }
    if (!meta || typeof meta !== 'object') meta = { obs: row?.notes || '' };
    const draft = { ...row, ...meta, employer_id: row?.employer_id || firstValue(state.employer), priority: row?.priority || 'Alta', search_status: row?.search_status || 'Aguardando', qtd: meta.qtd || 1 };
    const id = row?.id || D.uuid();
    return W.form({ title: row ? 'Editar reposição' : 'Nova reposição', row: draft, fields: [
      ...employerFields(), { name: 'profile_needed', label: 'Perfil necessário', required: true }, { name: 'replaces_candidate_name_snapshot', label: 'Talento substituído' }, { name: 'qtd', label: 'Quantidade', type: 'number', min: 1, required: true }, { name: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Crítica'], required: true, placeholder: null }, { name: 'search_status', label: 'Situação', type: 'select', options: ['Aguardando', 'Em busca', 'Enviado', 'Concluído', 'Cancelado'], required: true, placeholder: null }, { name: 'dataSolicitacao', label: 'Data da solicitação', type: 'date' }, { name: 'dataNovoEnvio', label: 'Data do novo envio', type: 'date' }, { name: 'gatilho', label: 'Motivo da reposição', wide: true }, { name: 'obs', label: 'Observações', type: 'textarea', wide: true }
    ], onSubmit: async (v, c) => {
      const db = Object.fromEntries(['employer_id', 'profile_needed', 'replaces_candidate_name_snapshot', 'priority', 'search_status'].filter((key) => !row || key in c).map((key) => [key, v[key]]));
      if (!row || 'employer_id' in c) db.employer_name_snapshot = W.find(state.employers, v.employer_id)?.nome || row?.employer_name_snapshot || null;
      if (!row || ['qtd', 'dataSolicitacao', 'dataNovoEnvio', 'gatilho', 'obs'].some((key) => key in c)) db.notes = JSON.stringify({ ...meta, __t4_replacement_v1: true, qtd: v.qtd, dataSolicitacao: v.dataSolicitacao, data: v.dataSolicitacao, dataNovoEnvio: v.dataNovoEnvio, gatilho: v.gatilho, obs: v.obs });
      await W.saveRecord(D.TABLES.replacements, row, { ...db, deleted_at: null }, db, id);
      U.toast('Reposição salva.', 'success'); await load();
    } });
  }
  function historyView() {
    const intro = W.note('Consulta somente leitura do acervo do Organizacional armazenado no Supabase. Não importa planilhas, não restaura backups e não substitui registros atuais. Informações existentes apenas no navegador antigo não podem ser recuperadas por esta consulta.');
    if (!state.archive) return intro + W.button('Consultar acervo anterior', 'load-archive', '', { className: 'primary', icon: 'history' });
    const data = M.snapshotEntries(state.archive.payload);
    return intro + `<p class="t4-muted">Última gravação do acervo: ${e(U.formatDate(state.archive.updated_at, true))}</p>` + (Object.keys(data).length ? Object.entries(data).map(([key, value]) => `<details class="t4-disclosure"><summary>${e({ employers: 'Empregadores', planEntries: 'Planejamento', meetings: 'Reuniões', weeklySummaries: 'Resumos', dossiers: 'Dossiês, removidos e reposições', operationalTasks: 'Tarefas', operationalMetrics: 'Métricas' }[key] || key)} · ${Array.isArray(value) ? value.length : Object.keys(value || {}).length} registros</summary>${Array.isArray(value) ? value.filter(matchQuery).map((r) => `<details class="t4-disclosure"><summary>${e(r.name || r.title || r.tema || r.activity || r.done || r.id || 'Registro')}</summary><div class="t4-detail-grid">${Object.entries(r).map(([k, v]) => U.field(k, typeof v === 'object' ? JSON.stringify(v, null, 2) : v)).join('')}</div></details>`).join('') : `<pre class="t4-raw">${e(JSON.stringify(value, null, 2))}</pre>`}</details>`).join('') : W.note('Nenhum acervo encontrado para esta aplicação. Isso não significa que os registros das tabelas atuais foram excluídos.', 'warning'));
  }
  W.bind(app, { change(key, value) { state[key] = value; render(); }, async action(name, id) {
    if (name === 'reload') return D.session ? load() : location.reload();
    if (name === 'go') { U.closeDrawer(); state.status = []; app.route(id); return; }
    if (name === 'v24-view') { U.closeDrawer(); state.status = []; state.employer = []; app.route(id); return; }
    if (name === 'display') { state.employerDisplay = id; render(); return; }
    if (name === 'employer-display') { state.employerDisplay = ['cards', 'list'].includes(id) ? id : 'list'; render(); return; }
    if (name === 'planning-focus') { state.planningFocus = ['all', 'overdue', 'next', 'scheduled', 'no-date'].includes(id) ? id : 'all'; render(); return; }
    if (name === 'operations-display') { state.operationsDisplay = ['activities', 'all'].includes(id) ? id : 'activities'; render(); return; }
    if (name === 'operations-focus') { state.operationsFocus = ['all', 'overdue', 'today', 'high', 'unassigned'].includes(id) ? id : 'all'; render(); return; }
    if (name === 'multi-filter-clear') { if (id in state) state[id] = []; render(); return; }
    if (name === 'active-filter-remove') { const [key, value] = JSON.parse(id); if (Array.isArray(state[key])) state[key] = state[key].filter((v) => v !== value); render(); return; }
    if (name === 'employer-scope') { state.employerScope = ['active', 'all', 'archived'].includes(id) ? id : 'active'; state.employer = []; state.status = []; render(); return; }
    if (name === 'employer-classification') { state.employerClassification = ['all', 'partner', 'nectanet', 'general', 'pending'].includes(id) ? id : 'all'; render(); return; }
    if (name === 'opportunity-scope') { state.opportunityScope = ['open', 'all', 'closed'].includes(id) ? id : 'open'; state.status = []; render(); return; }
    if (name === 'selection-display') { state.selectionDisplay = id === 'cards' ? 'cards' : 'list'; render(); return; }
    if (name === 'selection-scope') { state.selectionScope = ['active', 'all', 'closed'].includes(id) ? id : 'active'; state.status = []; render(); return; }
    if (name === 'selection-archive') { state.selectionShowClosed = !state.selectionShowClosed; render(); return; }
    if (name === 'go-employer') { state.employer = id === 'internal' ? '' : id; app.route('employers'); return; }
    if (name === 'clear') { state.employer = []; state.month = []; state.status = []; state.query = ''; state.planningFocus = 'all'; state.planningMonth = M.today().slice(0, 7); state.operationsFocus = 'all'; state.operationsMonth = M.today().slice(0, 7); state.operationsDisplay = 'activities'; state.meetingsMonth = M.today().slice(0, 7); state.selectionScope = 'active'; state.selectionShowClosed = false; app.resetSearch(); render(); return; }
    if (name === 'planning-month-prev' || name === 'planning-month-next' || name === 'planning-month-today' || name === 'operations-month-prev' || name === 'operations-month-next' || name === 'operations-month-today' || name === 'meetings-month-prev' || name === 'meetings-month-next' || name === 'meetings-month-today') {
      const key = name.startsWith('planning-') ? 'planningMonth' : name.startsWith('operations-') ? 'operationsMonth' : 'meetingsMonth', current = M.today().slice(0, 7);
      state[key] = name.endsWith('-today') ? current : shiftMonth(state[key] || current, name.endsWith('-prev') ? -1 : 1);
      render(); return;
    }
    if (name.startsWith('month-')) { const date = new Date(`${state.calendar}-01T12:00:00`); date.setMonth(date.getMonth() + (name === 'month-prev' ? -1 : 1)); state.calendar = name === 'month-today' ? M.today().slice(0, 7) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; render(); return; }
    if (name === 'employer-detail') return employerDetail(W.find(state.employers, id));
    if (name === 'edit-employer') return editEmployer(W.find(state.employers, id));
    if (name === 'opening-detail') return openingDetail(W.find(state.openings, id));
    if (name === 'edit-opening') return editOpening(W.find(state.openings, id));
    if (name === 'new-opening-for') return editOpening(null, id);
    if (name === 'selection-for-opening') return R.editSelection(state, null, { opening_id: id }, load);
    if (name === 'selection-detail') return R.selectionDrawer(state, state.selections.rows.find((r) => r.key === id));
    if (name === 'edit-selection') return R.editSelection(state, state.selections.rows.find((r) => r.key === id), {}, load);
    if (name === 'edit-plan') return editPlan(W.find(state.plans, id));
    if (name === 'new-plan') return editPlan();
    if (name === 'meeting-detail') return meetingDetail(W.find(state.meetings, id));
    if (name === 'edit-meeting') return editMeeting(W.find(state.meetings, id));
    if (name === 'new-meeting') return editMeeting();
    if (name === 'meeting-task') { const m = W.find(state.meetings, id); return editTask(null, { title: m.next_action || m.pending_items || m.title, description: m.decision_summary, meeting_id: m.id, employer_id: m.employer_id, owner_user_key: m.owner_name }); }
    if (name === 'edit-task') return editTask(W.find(state.tasks, id));
    if (name === 'finish-task') return finishTask(W.find(state.tasks, id));
    if (name === 'new-task') return editTask();
    if (name === 'edit-metric' || name === 'new-metric') return editMetric(W.find(state.metrics, id));
    if (name === 'edit-summary') return editSummary(W.find(state.summaries, id));
    if (name === 'edit-replacement' || name === 'new-replacement') return editReplacement(W.find(state.replacements, id));
    if (name === 'edit-activity') return R.editActivity(state, W.find(state.activities, id), {}, load);
    if (name === 'finish-activity') return R.finishActivity(W.find(state.activities, id), load);
    if (name === 'load-archive') {
      const result = await D.optionalSelect(D.TABLES.archive, 'payload,updated_at', (q) => q.eq('app_key', 'talents4_crm_v5').limit(1));
      if (!result.available) throw new Error('Acervo indisponível. Nenhuma restauração foi executada.');
      state.archive = result.data[0] || { payload: {} }; render();
    }
  } });
  app.onRoute(() => { state.status = []; render(); });
  W.start(app, async () => {
    await load();
    const id = new URLSearchParams(location.search).get('employer');
    if (id && !state.openedInitial) { state.openedInitial = true; employerDetail(W.find(state.employers, id)); }
  }, [...Object.keys(sources).flatMap((key) => key === 'selections' ? [D.TABLES.matches, D.TABLES.legacyMatches, D.TABLES.legacyLinks] : [D.TABLES[key] || (key === 'talents' ? D.TABLES.candidates : '')]), D.TABLES.contacts, D.TABLES.taskResponsibles]);
})();
