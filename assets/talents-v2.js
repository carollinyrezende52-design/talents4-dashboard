(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data, R = window.T4Records, T = window.T4TalentMapping;
  const e = U.esc, a = U.attr;
  const app = U.mount({ module: 'talents', moduleLabel: 'Talentos', defaultView: 'talents', views: [
    { id: 'overview', label: 'Meu dia', title: 'Meu dia', subtitle: 'Prioridades e próximos passos para uma operação mais próxima dos talentos.', icon: 'dashboard', hidden: true },
    { id: 'talents', label: 'Talentos', title: 'Base de talentos', subtitle: 'Uma ficha por pessoa, com filtros de trabalho e próximo passo visível.', icon: 'users' },
    { id: 'processes', label: 'Seleções', title: 'Seleções', subtitle: 'Cada linha representa Talento + empregador + vaga + etapa.', icon: 'columns' },
    { id: 'presentation', label: 'Apresentações', title: 'Apresentações', subtitle: 'Fila de perfis liberados por decisão humana, antes do envio a uma empresa.', icon: 'check' },
    { id: 'agenda', label: 'Agenda integrada', title: 'Agenda integrada', subtitle: 'Ações vinculadas a Talentos, empresas, contatos e aulas.', icon: 'calendar' },
    { id: 'opportunities', label: 'Mercado', title: 'Mercado e oportunidades', subtitle: 'Vagas cadastradas e Radar NectaNet, sem misturar etapa com oportunidade.', icon: 'briefcase', primary: false },
    { id: 'mapping', label: 'Acompanhamento por Talento', title: 'Acompanhamento por Talento', subtitle: 'Empresa por empresa: aderência, viabilidade e próximos alvos de cada Talento.', icon: 'list', primary: false },
    { id: 'mapping-summary', label: 'Resumo do mapeamento', title: 'Resumo do mapeamento', subtitle: 'Leitura consolidada do acompanhamento, com critérios explícitos.', icon: 'dashboard', primary: false },
    { id: 'mapping-radar', label: 'Radar NectaNet', title: 'Radar NectaNet', subtitle: 'Alvos NectaNet e avaliações individuais; não é etapa nem liberação.', icon: 'briefcase', primary: false },
    { id: 'manual', label: 'Manual de uso', title: 'Manual de uso', subtitle: 'Como decidir, acompanhar e apresentar sem duplicar informações.', icon: 'note', primary: false },
    { id: 'archived', label: 'Arquivo de Talentos', title: 'Arquivo de Talentos', subtitle: 'Histórico de inativos, excluídos e arquivados, sem mistura com a fila ativa.', icon: 'archive', primary: false }
  ] });
  const state = { talents: [], employers: [], openings: [], selections: { rows: [], modern: false }, activities: [], enrollments: [], classes: [], plans: [], meetings: [], tasks: [], biDayFilter: null, biStageFilter: null, biPeriod: 'week7', mappingProfiles: [], mappingItems: [], mappingPartners: [], replacements: [], presentationDetails: [], filters: {}, query: '', stage: '', german: '', employer: '', owner: '', status: '', month: '', quick: [], talentScope: 'talento', selectedTalents: new Set(), board: 'list', selectionDisplay: 'list', selectionScope: 'active', selectionShowClosed: false, opportunityScope: 'open', display: 'list', loaded: false, detail: null, detailTab: 'profile', detailVersion: 0 };
  const sources = {
    talents: { label: 'Talentos', load: () => D.loadCandidates({ activeOnly: false }) },
    employers: { label: 'Empregadores', load: () => D.loadEmployers({ activeOnly: false }) },
    openings: { label: 'Oportunidades', load: () => D.loadOpenings() },
    selections: { label: 'Seleções e vínculos anteriores', load: () => D.loadMatches() },
    activities: { label: 'Agenda integrada', load: () => D.loadActivities() },
    enrollments: { label: 'Matrículas de alemão', load: () => D.optionalAll(D.TABLES.enrollments) },
    classes: { label: 'Turmas de alemão', load: () => D.optionalAll(D.TABLES.classes) },
    plans: { label: 'Planejamento mensal', load: () => D.optionalAll(D.TABLES.plans, '*', (q) => q.is('deleted_at', null)) },
    meetings: { label: 'Reuniões', load: () => D.optionalAll(D.TABLES.meetings, '*', (q) => q.is('deleted_at', null)) },
    tasks: { label: 'Tarefas', load: () => D.optionalAll(D.TABLES.tasks, '*', (q) => q.is('deleted_at', null)) },
    mappingProfiles: { label: 'Contexto e apresentação do mapeamento', load: () => D.optionalAll(T.TABLES.profiles) },
    mappingItems: { label: 'Linhas do acompanhamento', load: () => D.optionalAll(T.TABLES.items) },
    mappingPartners: { label: 'Complementos Nectanet Partner', load: () => D.optionalAll(T.TABLES.partners) },
    replacements: { label: 'Reposições', load: () => D.optionalAll(D.TABLES.replacements, '*', (q) => q.is('deleted_at', null)) },
    presentationDetails: { label: 'Campos profissionais da apresentação', load: loadPresentationFields }
  };
  const load = W.loader(app, state, sources, render);
  const workspace = window.T4TalentMappingUI.create({ state, app, load, render, talentDetail });
  const active = T.active, yes = T.yes;
  const inCourse = (id) => T.courseFor(state, id);
  const selectionsFor = (id) => state.selections.rows.filter((r) => M.same(r.talent_id, id));
  const attention = (r) => T.attentionReasons(state, r).length > 0;
  const match = (values) => !state.query || M.norm(values.filter(M.present).join(' ')).includes(M.norm(state.query));
  function filtered(archived = false) {
    return workspace.filtered({ archived, scope: archived ? 'talento' : state.talentScope });
  }
  function talentViews(archived = false) {
    const talentsCount = state.talents.filter((row) => active(row) && M.isTalent(row)).length;
    const bucketCount = state.talents.filter((row) => active(row) && !M.isTalent(row)).length;
    const readyCount = state.talents.filter((row) => active(row) && M.isTalent(row) && T.yes(row.pronto_para_employer)).length;
    const archivedCount = state.talents.filter((row) => !active(row) && M.isTalent(row)).length;
    if (archived) return `<div class="v25-scope-strip"><div><span class="mx-eyebrow">ARQUIVO PRESERVADO</span><strong>${archivedCount} registro${archivedCount === 1 ? '' : 's'} fora da fila ativa</strong><span>Inativos, excluídos, cancelados e arquivados aparecem somente aqui.</span></div><div class="v25-scope-actions">${W.button('Voltar à fila ativa', 'talent-scope', 'talento', { className: 'ghost sm', icon: 'users' })}</div></div>`;
    // v25-talent-scopes é um par de botões (Talentos/Balde), não um
    // widget de abas de verdade (sem navegação por seta, sem
    // aria-selected, sem tabpanel associado) — role="tablist" sem os
    // filhos role="tab" que ele exige quebrava o axe-core (aria-
    // required-children). O agrupamento com aria-label já basta, é o
    // mesmo padrão usado em W.chips() para os outros trocadores de
    // escopo do app.
    return `<div class="v25-scope-strip"><div><span class="mx-eyebrow">FILA OPERACIONAL</span><strong>${state.talentScope === 'balde' ? `${bucketCount} registro${bucketCount === 1 ? '' : 's'} no Balde` : `${talentsCount} Talento${talentsCount === 1 ? '' : 's'}`}</strong><span>${state.talentScope === 'balde' ? 'Cadastros gerais e contatos sem interesse operacional; ficam fora das filas de Talentos.' : 'Somente pessoas marcadas como Talento entram nas filas, seleções e apresentações.'}</span></div><div class="v25-scope-actions"><div class="v25-talent-scopes" aria-label="Classificação da base">${W.button(`Talentos · ${talentsCount}`, 'talent-scope', 'talento', { className: state.talentScope === 'talento' ? 'primary sm' : 'ghost sm', icon: 'users' })}${W.button(`Balde · ${bucketCount}`, 'talent-scope', 'balde', { className: state.talentScope === 'balde' ? 'primary sm' : 'ghost sm', icon: 'archive' })}</div>${W.button(`Abrir apresentações · ${readyCount}`, 'v24-view', 'ready', { className: 'ghost sm', icon: 'check' })}</div></div>`;
  }
  function selectionBar(rows) {
    const selected = state.selectedTalents instanceof Set ? state.selectedTalents.size : 0;
    const visibleIds = rows.map((row) => String(row.id));
    const allVisible = visibleIds.length > 0 && visibleIds.every((id) => state.selectedTalents.has(id));
    const selectionText = selected ? `${selected} Talento${selected === 1 ? '' : 's'} selecionado${selected === 1 ? '' : 's'}` : 'Marque Talentos para exportar.';
    const exportAction = selected ? W.button('Exportar seleção', 'data-center', '', { className: 'primary sm', icon: 'download' }) : '<span class="t4-selection-hint">A exportação aparece após a seleção.</span>';
    return `<div class="t4-bulk-bar ${selected ? 'has-selection' : ''}" role="region" aria-label="Seleção para exportação"><div><span class="t4-bulk-icon">${U.icon(selected ? 'check' : 'list')}</span><strong>${e(selectionText)}</strong><small>${selected ? 'A seleção fica preservada ao trocar de visão ou aplicar filtros.' : 'Selecionar não muda a etapa nem libera apresentação.'}</small></div><div class="t4-bulk-actions">${W.button(allVisible ? 'Desmarcar recorte' : 'Marcar recorte', allVisible ? 'deselect-visible' : 'select-visible', '', { className: 'ghost sm', icon: allVisible ? 'close' : 'check' })}${selected ? W.button('Limpar seleção', 'clear-selection', '', { className: 'ghost sm' }) : ''}${exportAction}</div></div>`;
  }
  async function loadPresentationFields() {
    let columns = ['id', 'experiencia_profissional_tempo', 'perfil_profissional_para_apresentacao', 'lingua_estrangeira', 'nivel_lingua_estrangeira'];
    const absent = [];
    while (columns.length) {
      try {
        const data = await D.all(D.TABLES.candidates, columns.join(','));
        return { data, available: true, warnings: absent.length ? [`Apresentação: campos ausentes (${absent.join(', ')}). Confira a pré-checagem; nenhum campo foi substituído ou apagado.`] : [] };
      } catch (error) {
        const message = String(error?.message || '');
        const missing = message.match(/column\s+(?:\w+\.)?["']?(\w+)["']?\s+does not exist/i)?.[1] || message.match(/could not find the ['"](\w+)['"] column/i)?.[1];
        if (!D.missingColumn(error) || !missing || !columns.includes(missing) || missing === 'id') throw error;
        absent.push(missing); columns = columns.filter((key) => key !== missing);
      }
    }
  }
  function render() {
    if (!state.loaded) return;
    app.setSearchHandler((q) => { state.query = q; render(); }, app.view === 'agenda' ? 'Buscar atividade ou contexto…' : 'Buscar talento, profissão, cidade ou e-mail…');
    const selectionView = app.view === 'processes' || app.view === 'opportunities';
    const mappingView = app.view === 'mapping';
    app.setPrimaryAction(selectionView ? 'Nova seleção' : app.view === 'agenda' ? 'Nova atividade' : mappingView ? 'Nova linha' : 'Novo talento', D.canEdit() && (!selectionView || state.selections.modern) && (!mappingView || workspace.available('mappingItems') && filtered().length) ? () => selectionView ? R.editSelection(state, null, {}, load) : app.view === 'agenda' ? R.editActivity(state, null, {}, load) : mappingView ? workspace.action('mapping-new', state.mappingTalent || filtered()[0]?.id) : editTalent() : null);
    app.setCounts({ talents: state.talents.filter((r) => active(r) && M.isTalent(r)).length, archived: state.talents.filter((r) => !active(r) && M.isTalent(r)).length, processes: state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed').length, agenda: state.activities.filter((r) => M.isOpen(r.status)).length });
    const html = ({ overview, talents: () => directory(false), archived: () => directory(true), mapping: workspace.tracking, presentation: workspace.presentation, 'mapping-summary': workspace.summary, 'mapping-radar': workspace.radar, processes: selectionsView, opportunities: opportunitiesView, agenda: agendaView, manual: () => window.T4Modern?.manual() || W.note('Manual indisponível.') }[app.view] || overview)();
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html;
    W.bindSearchableSelects?.(app.pageRoot);
    U.animateCounters(app.pageRoot);
    if (app.view === 'overview') mountBiCharts(); else disposeBiCharts();
  }
  const PIPELINE_STAGES = [
    { value: 'Novo candidato', label: 'Novo Talento' }, { value: 'Triagem', label: 'Triagem' }, { value: 'Pré-seleção', label: 'Pré-seleção' }, { value: 'Análise', label: 'Análise' },
    { value: 'Curso de Alemão', label: 'Curso de Alemão', tone: 'info' }, { value: 'Entrevista', label: 'Entrevista', tone: 'info' }, { value: 'Documentação', label: 'Documentação', tone: 'warning' },
    { value: 'Pronto para employer', label: 'Pronto para apresentação', tone: 'success' }, { value: 'Enviado ao employer', label: 'Apresentado ao empregador', tone: 'success' }, { value: 'Contratado', label: 'Contratado', tone: 'success' }
  ];
  function pipelineDistribution(list) {
    const buckets = PIPELINE_STAGES.map(({ value, label, tone }) => ({ label, tone, count: list.filter((r) => M.norm(r.status_pipeline) === M.norm(value)).length }));
    const outros = list.length - buckets.reduce((sum, b) => sum + b.count, 0);
    if (outros > 0) buckets.push({ label: 'Outra etapa / sem etapa', count: outros });
    return W.funnelChart('Onde cada Talento está agora', 'LEITURA RÁPIDA', `${list.length} ativo${list.length === 1 ? '' : 's'}`, buckets);
  }
  function biCard(rank, icon, label, value, note, href, attn = 0) {
    return `<a class="t4-bi-card" href="${a(href)}"><div class="t4-bi-card-head"><span class="t4-bi-icon">${U.icon(icon)}</span><span class="t4-bi-card-head-end">${attn ? `<span class="t4-bi-attn" title="${a(`${attn} atrasado${attn === 1 ? '' : 's'}`)}">${attn}</span>` : ''}<span class="t4-bi-rank">${rank}</span></span></div><div class="t4-bi-value">${e(value)}</div><div class="t4-bi-label">${e(label)}</div><div class="t4-bi-note">${e(note)}</div></a>`;
  }
  function biDashboard() {
    const workload = workloadData();
    const overdueOf = (id) => workload.series.find((s) => s.id === id)?.overdue || 0;
    const agendaCount = workload.series.find((s) => s.id === 'agenda').data.reduce((a2, b) => a2 + b, 0);
    const planningCount = state.plans.filter((r) => M.isOpen(r.status)).length;
    const meetingsCount = workload.series.find((s) => s.id === 'meetings').data.reduce((a2, b) => a2 + b, 0);
    const tasksCount = workload.series.find((s) => s.id === 'tasks').data.reduce((a2, b) => a2 + b, 0);
    const opportunitiesCount = state.openings.filter((r) => M.isOpen(r.status)).reduce((n, r) => n + (Number(r.quantity) || 1), 0);
    const germanCount = new Set(state.enrollments.filter((r) => ['Matriculado', 'Ativo', 'Pausado'].includes(r.status)).map((r) => r.candidate_id)).size;
    const employersCount = state.employers.filter((r) => M.activeRecord(r)).length;
    const talentsCount = state.talents.filter((row) => active(row) && M.isTalent(row)).length;
    const presentationCount = state.talents.filter((r) => yes(r.pronto_para_employer)).length;
    return `<section class="t4-bi-grid">
      ${biCard(1, 'calendar', 'Agenda', agendaCount, `${overdueOf('agenda') ? overdueOf('agenda') + ' atrasada(s) · ' : ''}no período`, './index.html?view=agenda', overdueOf('agenda'))}
      ${biCard(2, 'list', 'Planejamento mensal', planningCount, 'Atividades em aberto no mês', './organizacional.html?view=planning')}
      ${biCard(3, 'people', 'Reuniões', meetingsCount, `${overdueOf('meetings') ? overdueOf('meetings') + ' atrasada(s) · ' : ''}no período`, './organizacional.html?view=meetings', overdueOf('meetings'))}
      ${biCard(4, 'activity', 'Tarefas', tasksCount, `${overdueOf('tasks') ? overdueOf('tasks') + ' atrasada(s) · ' : ''}no período`, './organizacional.html?view=operations', overdueOf('tasks'))}
      ${biCard(5, 'briefcase', 'Oportunidades', opportunitiesCount, 'Posições em vagas abertas', './index.html?view=opportunities')}
      ${biCard(6, 'graduation', 'Alemão', germanCount, 'Matrículas em acompanhamento', './alemao.html')}
      ${biCard(7, 'building', 'Empregadores', employersCount, 'Empregadores ativos', './organizacional.html?view=employers')}
      ${biCard(8, 'users', 'Talentos', talentsCount, 'Uma ficha por pessoa', './index.html?view=talents')}
      ${biCard(9, 'check', 'Apresentações', presentationCount, 'Liberadas por decisão humana', './index.html?view=presentation')}
    </section>`;
  }
  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }
  function addDays(base, n) {
    const [y, m, d] = base.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  function dayLabel(dateStr, offset) {
    if (offset === 0) return 'Hoje';
    if (offset === 1) return 'Amanhã';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const PERIODS = [
    { id: 'today', label: 'Hoje', days: 1 },
    { id: 'week', label: 'Esta semana', days: (now = new Date()) => Math.max(1, 7 - now.getDay()) },
    { id: 'week7', label: 'Próximos 7 dias', days: 7 },
    { id: 'month', label: 'Este mês', days: (now = new Date()) => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1 }
  ];
  function periodDays() {
    const period = PERIODS.find((p) => p.id === state.biPeriod) || PERIODS[2];
    return typeof period.days === 'function' ? period.days() : period.days;
  }
  function workloadData() {
    const today = M.today();
    const dayKeys = [...Array(periodDays())].map((_, i) => addDays(today, i));
    const series = [
      { id: 'agenda', name: 'Agenda', color: cssVar('--t4-info', '#1677ff'), rows: state.activities, dateOf: (r) => M.dateOnly(r.due_at) },
      { id: 'meetings', name: 'Reuniões', color: cssVar('--t4-color-purple', '#1e1349'), rows: state.meetings, dateOf: (r) => M.dateOnly(r.scheduled_at) },
      { id: 'tasks', name: 'Tarefas', color: cssVar('--t4-warning', '#a3610a'), rows: state.tasks, dateOf: (r) => M.dateOnly(r.due_date) },
      { id: 'plans', name: 'Planejamento mensal', color: cssVar('--t4-accent', '#002a4a'), rows: state.plans, dateOf: (r) => M.dateOnly(r.end_date || r.start_date) }
    ].map((s) => {
      const byDay = Object.fromEntries(dayKeys.map((k) => [k, []]));
      let overdue = 0;
      s.rows.forEach((r) => {
        if (!M.isOpen(r.status)) return;
        const key = s.dateOf(r);
        if (!key) return;
        if (key < dayKeys[0]) { overdue++; return; }
        if (byDay[key]) byDay[key].push(r);
      });
      return { ...s, data: dayKeys.map((k) => byDay[k].length), byDay, overdue };
    });
    const overdueTotal = series.reduce((sum, s) => sum + s.overdue, 0);
    return { dayKeys, labels: dayKeys.map((k, i) => dayLabel(k, i)), series, overdueTotal };
  }
  function funnelData() {
    const active = state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed');
    const toneColor = { neutral: cssVar('--t4-ink-soft', '#4a5e73'), info: cssVar('--t4-info', '#1677ff'), purple: cssVar('--t4-color-purple', '#1e1349'), warning: cssVar('--t4-warning', '#a3610a'), success: cssVar('--t4-success', '#097858') };
    return M.SELECTION_COLUMNS.map((col) => ({ id: col.id, name: col.name, color: toneColor[col.tone] || toneColor.neutral, rows: active.filter((r) => M.selectionBucket(r) === col.id) }));
  }
  function priorityListHtml() {
    const workload = workloadData();
    const dayFilter = state.biDayFilter;
    const stageFilter = state.biStageFilter;
    if (stageFilter) {
      const bucket = funnelData().find((b) => b.id === stageFilter);
      const rows = bucket?.rows || [];
      const items = rows.slice(0, 12).map((r) => `<li><button type="button" class="t4-bi-priority-item" data-action="selection-detail" data-id="${a(r.key)}"><strong>${e(R.talentName(state, r.talent_id))}</strong><span>${e(W.find(state.employers, r.employer_id)?.nome || r.employer_name_snapshot || 'Empregador não informado')}</span></button></li>`).join('');
      return `<div class="t4-bi-priority-head"><h3>${e(bucket?.name || 'Etapa')} · ${rows.length} vínculo${rows.length === 1 ? '' : 's'}</h3>${W.button('Limpar filtro', 'bi-clear-stage', '', { className: 'ghost sm' })}</div><ul class="t4-bi-priority-list">${items || '<li class="t4-bi-priority-empty">Nenhum vínculo nesta etapa.</li>'}</ul>`;
    }
    const dayIndex = dayFilter != null ? workload.dayKeys.indexOf(dayFilter) : -1;
    const rowsForDay = (s) => dayIndex >= 0 ? s.byDay[workload.dayKeys[dayIndex]] : [];
    const combined = dayIndex >= 0
      ? workload.series.flatMap((s) => rowsForDay(s).map((r) => ({ source: s.name, href: s.id === 'agenda' ? './index.html?view=agenda' : s.id === 'meetings' ? './organizacional.html?view=meetings' : s.id === 'tasks' ? './organizacional.html?view=operations' : './organizacional.html?view=planning', label: r.title || r.topic || r.activity_label || r.description || 'Sem título' })))
      : [];
    if (dayIndex >= 0) {
      const items = combined.slice(0, 12).map((r) => `<li><a class="t4-bi-priority-item" href="${a(r.href)}"><strong>${e(r.label)}</strong><span>${e(r.source)}</span></a></li>`).join('');
      return `<div class="t4-bi-priority-head"><h3>${e(workload.labels[dayIndex])} · ${combined.length} pendência${combined.length === 1 ? '' : 's'}</h3>${W.button('Limpar filtro', 'bi-clear-day', '', { className: 'ghost sm' })}</div><ul class="t4-bi-priority-list">${items || '<li class="t4-bi-priority-empty">Nada pendente neste dia.</li>'}</ul>`;
    }
    return todayPriorityHtml();
  }
  function responsibleOf(r) {
    return r.owner_name || r.owner_username || r.responsavel || r.responsible_name || 'Equipe';
  }
  function todayPriorityHtml() {
    const today = M.today();
    const domains = [
      { type: 'Agenda', href: './index.html?view=agenda', rows: state.activities, dateOf: (r) => M.dateOnly(r.due_at), titleOf: (r) => r.title || 'Atividade' },
      { type: 'Reunião', href: './organizacional.html?view=meetings', rows: state.meetings, dateOf: (r) => M.dateOnly(r.scheduled_at), titleOf: (r) => r.topic || r.title || 'Reunião' },
      { type: 'Tarefa', href: './organizacional.html?view=operations', rows: state.tasks, dateOf: (r) => M.dateOnly(r.due_date), titleOf: (r) => r.title || r.description || 'Tarefa' },
      { type: 'Planejamento', href: './organizacional.html?view=planning', rows: state.plans, dateOf: (r) => M.dateOnly(r.end_date || r.start_date), titleOf: (r) => r.activity_label || 'Atividade mensal' }
    ];
    const items = domains.flatMap((d) => d.rows.filter((r) => M.isOpen(r.status)).map((r) => {
      const due = d.dateOf(r);
      if (!due || due > addDays(today, 6)) return null;
      return { type: d.type, href: d.href, title: d.titleOf(r), responsible: responsibleOf(r), due, overdue: due < today, priority: due < today ? 'Alta' : due === today ? 'Média' : 'Normal' };
    }).filter(Boolean));
    const talentItems = state.talents.filter((row) => active(row) && M.isTalent(row) && attention(row)).slice(0, 6).map((r) => ({ type: 'Talento', href: './index.html?view=talents', title: r.nome_completo || 'Talento', responsible: r.responsavel_interno || 'Equipe', due: '', overdue: false, priority: 'Alta' }));
    const presentationItems = state.talents.filter((r) => M.norm(r.status_pipeline) === M.norm('Enviado ao employer') && !yes(r.pronto_para_employer)).slice(0, 4).map((r) => ({ type: 'Apresentação', href: './index.html?view=presentation', title: r.nome_completo || 'Talento', responsible: r.responsavel_interno || 'Equipe', due: '', overdue: false, priority: 'Média' }));
    const all = [...items, ...talentItems, ...presentationItems].sort((x, y) => (y.overdue - x.overdue) || String(x.due || '9999').localeCompare(String(y.due || '9999')));
    const rows = all.slice(0, 10).map((it) => `<li><a class="t4-bi-priority-item ${it.overdue ? 'is-overdue' : ''}" href="${a(it.href)}"><span class="t4-bi-priority-type">${e(it.type)}</span><strong>${e(it.title)}</strong><span class="t4-bi-priority-meta">${e(it.responsible)}${it.due ? ` · ${e(U.formatDate(it.due))}` : ''} · <em class="t4-bi-priority-${it.priority === 'Alta' ? 'high' : it.priority === 'Média' ? 'mid' : 'low'}">${e(it.priority)}</em></span></a></li>`).join('');
    return `<div class="t4-bi-priority-head"><h3>Prioridades de hoje · ${all.length}</h3><p class="t4-bi-priority-hint">Atrasados, itens de hoje e talentos com pendência. Clique numa barra ou etapa dos gráficos para outros recortes.</p></div><ul class="t4-bi-priority-list">${rows || '<li class="t4-bi-priority-empty">Nada pendente no período.</li>'}</ul>`;
  }
  const biCharts = {};
  function disposeBiCharts() {
    Object.values(biCharts).forEach((entry) => { entry.observer?.disconnect(); entry.instance?.dispose(); });
    Object.keys(biCharts).forEach((key) => delete biCharts[key]);
  }
  let echartsLoad = null;
  function loadECharts() {
    if (window.echarts) return Promise.resolve(window.echarts);
    if (!echartsLoad) {
      echartsLoad = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js';
        script.async = true;
        script.onload = () => resolve(window.echarts);
        script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca de gráficos.'));
        document.head.appendChild(script);
      });
    }
    return echartsLoad;
  }
  function chartErrorHtml(message) {
    return `<div class="t4-bi-chart-error">${U.icon('warning')}<span>${e(message)}</span></div>`;
  }
  function mountWorkloadChart(echarts) {
    const el = app.pageRoot.querySelector('[data-chart="workload"]');
    if (!el) return;
    const workload = workloadData();
    const instance = echarts.init(el);
    instance.setOption({
      animationDuration: 200, animationDurationUpdate: 200,
      aria: { show: true },
      color: workload.series.map((s) => s.color),
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => `<strong>${e(params[0]?.name || '')}</strong><br>${params.filter((p) => p.value).map((p) => `${p.marker} ${e(p.seriesName)}: ${p.value}`).join('<br>') || 'Nada pendente'}` },
      xAxis: { type: 'category', data: workload.labels, axisTick: { show: false }, axisLabel: workload.labels.length > 10 ? { interval: Math.ceil(workload.labels.length / 10) - 1, rotate: 45, fontSize: 10 } : { fontSize: 11 } },
      yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eef2f6' } } },
      series: workload.series.map((s) => ({ name: s.name, type: 'bar', stack: 'total', barMaxWidth: 34, data: s.data }))
    });
    instance.on('click', (params) => {
      state.biDayFilter = workload.dayKeys[params.dataIndex];
      state.biStageFilter = null;
      updatePriorityList();
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    biCharts.workload = { instance, observer };
  }
  function mountFunnelChart(echarts) {
    const el = app.pageRoot.querySelector('[data-chart="funnel"]');
    if (!el) return;
    const buckets = funnelData();
    const instance = echarts.init(el);
    instance.setOption({
      animationDuration: 200, animationDurationUpdate: 200,
      aria: { show: true },
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: 'item', formatter: (p) => `<strong>${e(p.name)}</strong>: ${p.value} vínculo${p.value === 1 ? '' : 's'}` },
      xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eef2f6' } } },
      yAxis: { type: 'category', data: buckets.map((b) => b.name).reverse(), axisTick: { show: false } },
      series: [{ type: 'bar', data: buckets.map((b) => ({ value: b.rows.length, itemStyle: { color: b.color } })).reverse(), barMaxWidth: 22, label: { show: true, position: 'right', fontSize: 11, fontWeight: 700 } }]
    });
    instance.on('click', (params) => {
      const bucket = buckets[buckets.length - 1 - params.dataIndex];
      state.biStageFilter = bucket.id;
      state.biDayFilter = null;
      updatePriorityList();
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    biCharts.funnel = { instance, observer };
  }
  function updatePriorityList() {
    const target = app.pageRoot.querySelector('[data-bi-priority]');
    if (target) target.innerHTML = priorityListHtml();
  }
  function mountBiCharts() {
    disposeBiCharts();
    Promise.allSettled([
      loadECharts().then((echarts) => mountWorkloadChart(echarts)).catch((err) => { const el = app.pageRoot.querySelector('[data-chart="workload"]'); if (el) el.innerHTML = chartErrorHtml(err.message); }),
      loadECharts().then((echarts) => mountFunnelChart(echarts)).catch((err) => { const el = app.pageRoot.querySelector('[data-chart="funnel"]'); if (el) el.innerHTML = chartErrorHtml(err.message); })
    ]);
  }
  function workloadTableHtml() {
    const w = workloadData();
    const rows = w.labels.map((label, i) => `<tr><th scope="row">${e(label)}</th>${w.series.map((s) => `<td>${s.data[i]}</td>`).join('')}</tr>`).join('');
    return `<table><caption class="t4-sr-only">Carga operacional dos próximos 7 dias, por área</caption><thead><tr><th scope="col">Dia</th>${w.series.map((s) => `<th scope="col">${e(s.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  function funnelTableHtml() {
    const buckets = funnelData();
    const rows = buckets.map((b) => `<tr><th scope="row">${e(b.name)}</th><td>${b.rows.length}</td></tr>`).join('');
    return `<table><caption class="t4-sr-only">Distribuição do funil operacional</caption><thead><tr><th scope="col">Etapa</th><th scope="col">Vínculos</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function overview() {
    const workload = workloadData();
    const hasFilter = state.biPeriod !== 'week7' || state.biDayFilter || state.biStageFilter;
    return `<header class="t4-bi-header">
        <div class="t4-bi-header-title"><h2>Meu dia</h2><span class="t4-bi-header-date">${e(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}</span></div>
        <div class="t4-bi-header-actions">${W.button('Atualizar', 'reload', '', { className: 'ghost sm', icon: 'refresh' })}</div>
      </header>
      <div class="t4-bi-slicers" role="group" aria-label="Período">
        ${PERIODS.map((p) => `<button type="button" class="t4-bi-chip ${state.biPeriod === p.id ? 'active' : ''}" data-action="bi-period" data-id="${a(p.id)}">${e(p.label)}</button>`).join('')}
        ${hasFilter ? W.button('Limpar filtros', 'bi-clear-filters', '', { className: 'ghost sm' }) : ''}
      </div>
      ${biDashboard()}
      <section class="t4-bi-charts">
        <article class="t4-bi-chart-card">
          <header><h3>Carga operacional</h3><p>Agenda, reuniões, tarefas e planejamento mensal com data definida.${workload.overdueTotal ? ` <strong class="t4-bi-chart-flag">${workload.overdueTotal} atrasado${workload.overdueTotal === 1 ? '' : 's'}</strong>` : ''}</p></header>
          <div class="t4-bi-chart-canvas" data-chart="workload" role="img" aria-label="Gráfico de barras empilhadas da carga operacional no período"></div>
          <details class="t4-bi-chart-table"><summary>Ver como tabela</summary>${workloadTableHtml()}</details>
        </article>
        <article class="t4-bi-chart-card">
          <header><h3>Pipeline operacional</h3><p>Vínculos ativos de Talento com empregador, por etapa real do sistema.</p></header>
          <div class="t4-bi-chart-canvas" data-chart="funnel" role="img" aria-label="Gráfico de barras horizontais do pipeline operacional"></div>
          <details class="t4-bi-chart-table"><summary>Ver como tabela</summary>${funnelTableHtml()}</details>
        </article>
      </section>
      <section class="t4-bi-priority" data-bi-priority>${priorityListHtml()}</section>
      <div class="t4-shortcuts">${W.button('Consultar oportunidades', 'go', 'opportunities', { icon: 'briefcase' })}${W.link('Planejamento dos empregadores', './organizacional.html?view=planning', 'building')}${W.link('Acompanhamento de alemão', './alemao.html?view=attention', 'graduation')}${W.link('Agenda de contatos', './contatos.html', 'contact')}</div>`;
  }
  function archivedSearchNotice() {
    if (!String(state.query || '').trim() || app.view === 'archived') return '';
    const matches = workspace.filtered({ archived: true });
    if (!matches.length) return '';
    const shown = matches.slice(0, 3).map((r) => {
      const activeRelations = selectionsFor(r.id).filter((item) => M.selectionBucket(item) !== 'closed').length;
      const relationCopy = activeRelations ? ` · ${activeRelations} seleção${activeRelations === 1 ? '' : 'ões'} em andamento` : '';
      return `<div class="v25-archive-result"><div><strong>${e(r.nome_completo || r.id)}</strong><small>Arquivado${e(relationCopy)}</small></div>${W.button('Abrir ficha', 'talent-detail', r.id, { className: 'ghost sm', icon: 'chevron' })}</div>`;
    }).join('');
    const more = matches.length > 3 ? `<small class="v25-archive-more">+ ${matches.length - 3} resultado${matches.length - 3 === 1 ? '' : 's'} no arquivo</small>` : '';
    return `<aside class="v25-archive-search" role="status"><div class="v25-archive-search-head"><strong>${matches.length} resultado${matches.length === 1 ? '' : 's'} também no arquivo</strong><span>A ficha arquivada fica fora da fila ativa, mas continua disponível.</span></div><div class="v25-archive-results">${shown}${more}</div>${W.button('Abrir arquivo', 'v24-view', 'archived', { className: 'ghost sm', icon: 'archive' })}</aside>`;
  }
  function directory(archived) {
    // O atalho "Prontos para apresentar" sempre mostra o recorte de liberação
    // humana (pronto_para_employer), não o último recorte que a pessoa tinha
    // aberto nas Apresentações (Nectanet/Liberado/Parcial).
    if (!archived && state.quick.includes('ready')) { state.presentationView = 'released'; return workspace.presentation(); }
    const rows = filtered(archived);
    const mode = `<div class="mx-toolbar"><div><span class="mx-eyebrow">${archived ? 'HISTÓRICO PRESERVADO' : 'FICHA ÚNICA DE CADA TALENTO'}</span><p class="t4-muted">${rows.length} registro(s) neste recorte</p></div><div class="mx-segment" role="group" aria-label="Visualização da base"><button type="button" data-action="talent-display" data-id="cards" data-selected="${state.display === 'cards'}">Cartões</button><button type="button" data-action="talent-display" data-id="list" data-selected="${state.display === 'list'}">Lista</button><button type="button" data-action="talent-display" data-id="table" data-selected="${state.display === 'table'}">Tabela completa</button></div></div>`;
    return `${talentViews(archived)}${archived || state.talentScope === 'balde' ? '' : workspace.quickFilters()}${workspace.toolbar({archived})}${archived ? '' : archivedSearchNotice()}${selectionBar(rows)}${mode}${state.display === 'cards' ? talentCards(rows) : state.display === 'table' ? talentTable(rows, 'talents-complete') : talentListTable(rows)}`;
  }
  function talentCards(list) {
    return `<div class="mx-cards">${list.map((r) => {
      const p = T.profileFor(state, r.id), links = [...new Set(T.mappingRows(state).filter((x) => M.same(x.talent_id, r.id) && x._employer).map((x) => x._employer))];
      const actions = window.T4Modern?.nextActions(state, r.id) || [], first = actions[0];
      const ready = T.yes(r.pronto_para_employer), radar = T.mappingRows(state).some((x) => M.same(x.talent_id, r.id) && T.yes(x.nectanet));
      const talentActions = M.isTalent(r) ? `${W.button('Acompanhar','mapping-for',r.id,{className:'sm',icon:'list'})}${D.canEdit() ? W.button(ready ? 'Revisar liberação' : 'Preparar apresentação','readiness',r.id,{className:'sm ghost'}) : ''}` : '';
      const scopeAction = D.canEdit() ? W.button(M.isTalent(r) ? 'Mover para Balde' : 'Marcar como Talento','set-talent-scope',`${r.id}|${M.isTalent(r) ? 'balde' : 'talento'}`,{className:'sm ghost'}) : '';
      return `<article class="mx-card ${state.selectedTalents.has(String(r.id)) ? 'is-selected' : ''}"><div class="mx-person-header" style="padding:0;border:0;margin:0;background:transparent"><div><label class="t4-card-select"><input type="checkbox" data-talent-select data-id="${a(r.id)}" ${state.selectedTalents.has(String(r.id)) ? 'checked' : ''}><span>Selecionar</span></label><span class="mx-eyebrow">${e(r.status_pipeline || 'Sem etapa')}</span><h3>${e(r.nome_completo || 'Sem nome')}</h3><p class="mx-meta">${e([r.profissao_principal || r.area_profissional, r.cidade_atual, r.responsavel_interno].filter(Boolean).join(' · ') || 'Dados principais não informados')}</p></div>${W.button('Abrir ficha','talent-detail',r.id,{className:'sm ghost',icon:'chevron'})}</div><div class="t4-chip-row">${U.badge(M.scopeLabel(r), M.isTalent(r) ? 'success' : '')}${U.badge(r.nivel_alemao || 'Alemão não informado','info')}${ready ? U.badge('Liberado para apresentação','success') : U.badge('Em preparação')}${radar ? U.badge('Radar NectaNet','info') : ''}</div><div class="mx-fact"><h3>Próximo passo</h3><p class="mx-next">${e(first?.text || 'Definir uma próxima ação')}</p><small class="mx-meta">${e([first?.source, first?.due ? U.formatDate(first.due) : '', first?.owner].filter(Boolean).join(' · ') || 'Sem prazo ou responsável')}</small></div>${links.length ? `<div class="t4-chip-row">${links.slice(0,4).map(window.T4Modern?.employer || ((x)=>e(x.nome))).join('')}</div>` : '<p class="mx-meta">Sem empregador ou vaga vinculada.</p>'}<footer>${talentActions}${scopeAction}</footer></article>`;
    }).join('') || U.emptyState('Nenhum Talento neste filtro','Ajuste a busca ou limpe os filtros para continuar.')}</div>`;
  }
  function talentTable(list, id = 'talents') {
    return W.table({ id, rows: list, columns: [
      { key: 'selected', label: '', ariaLabel: 'Selecionar', required: true, sort: false, className: 't4-selection-cell', render: (r) => `<input type="checkbox" data-talent-select data-id="${a(r.id)}" aria-label="Selecionar ${a(r.nome_completo || 'Talento')}" ${state.selectedTalents.has(String(r.id)) ? 'checked' : ''}>` },
      { key: 'nome_completo', label: 'Talento', required: true, render: (r) => W.person(r.nome_completo || 'Sem nome', r.cidade_atual || r.id, '', 'talent-detail', r.id) },
      { key: 'profissao_principal', label: 'Profissão / área', render: (r) => W.stack(r.profissao_principal || r.area_profissional, r.profissao_principal ? r.area_profissional : '') },
      { key: 'status_pipeline', label: 'Acompanhamento', render: (r) => `<div class="t4-chip-row">${U.badge(M.scopeLabel(r), M.isTalent(r) ? 'success' : '')}${W.status(U.term(r.status_pipeline || 'Sem etapa'))}</div>` },
      { key: 'nivel_alemao', label: 'Alemão', render: (r) => { const course = inCourse(r.id); return `<div class="t4-chip-row">${U.badge(course[0]?.current_level || r.nivel_alemao || 'Não informado', 'info')}</div><small class="t4-cell-secondary">${course.length ? `${course.length} matrícula(s) · dados do curso` : 'Informado no perfil'}</small>`; } },
      { key: 'documentacao_completa', label: 'Documentação', render: (r) => U.badge(yes(r.documentacao_completa) ? 'Completa' : M.present(r.documentacao_completa) ? 'Em preparação' : 'Não avaliada', yes(r.documentacao_completa) ? 'success' : '') },
      { key: 'employer', label: 'Empregadores', render: (r) => { const names = [...new Set(selectionsFor(r.id).filter((s) => M.selectionBucket(s) !== 'closed').map((s) => R.employerName(state, s.employer_id)))]; return names.length ? `<span class="t4-clamp-3">${e(names.join(' · '))}</span>` : '<span class="t4-muted">Sem seleção vinculada</span>'; } },
      { key: 'responsavel_interno', label: 'Responsável' },
      { key: 'pronto_para_employer', label: 'Apresentação', render: (r) => `<div class="t4-chip-row">${U.badge(yes(r.pronto_para_employer) ? 'Liberado' : M.present(r.pronto_para_employer) ? 'Em preparação' : 'Não revisado', yes(r.pronto_para_employer) ? 'success' : '')}${M.isTalent(r) && D.canEdit() ? W.button('Revisar', 'readiness', r.id, {className:'ghost sm'}) : ''}</div>` },
      { key: 'attention', label: 'Atenção', render: (r) => `<span class="t4-cell-secondary">${e(T.attentionReasons(state,r).join(' · ') || 'Sem alertas neste recorte')}</span>` },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => `<div class="t4-chip-row">${M.isTalent(r) ? W.button('Acompanhar', 'mapping-for', r.id, { className: 'sm', icon: 'list' }) : ''}${W.button(M.isTalent(r) ? 'Balde' : 'Talento', 'set-talent-scope', `${r.id}|${M.isTalent(r) ? 'balde' : 'talento'}`, { className: 'sm ghost' })}${W.button('Ficha', 'talent-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</div>` }
    ] });
  }
  function talentListTable(list, id = 'talents-list') {
    return W.table({ id, rows: list, empty: 'Ajuste a busca ou os filtros para continuar.', columns: [
      { key: 'selected', label: '', ariaLabel: 'Selecionar', required: true, sort: false, className: 't4-selection-cell', render: (r) => `<input type="checkbox" data-talent-select data-id="${a(r.id)}" aria-label="Selecionar ${a(r.nome_completo || 'Talento')}" ${state.selectedTalents.has(String(r.id)) ? 'checked' : ''}>` },
      { key: 'nome_completo', label: 'Talento', required: true, render: (r) => W.person(r.nome_completo || 'Sem nome', [r.profissao_principal || r.area_profissional, r.cidade_atual].filter(Boolean).join(' · ') || 'Perfil ainda incompleto', '', 'talent-detail', r.id) },
      { key: 'status_pipeline', label: 'Etapa do perfil', render: (r) => `<div class="t4-chip-row">${U.badge(M.scopeLabel(r), M.isTalent(r) ? 'success' : '')}${W.status(U.term(r.status_pipeline || 'Sem etapa'))}</div>` },
      { key: 'next_action', label: 'Próximo passo', value: (r) => window.T4Modern?.nextActions(state, r.id)?.[0]?.text || '', render: (r) => { const next = window.T4Modern?.nextActions(state, r.id)?.[0]; return W.stack(next?.text || 'Definir ação', next ? [next.source, next.due ? U.formatDate(next.due) : '', next.owner].filter(Boolean).join(' · ') : 'Nenhuma ação registrada'); } },
      { key: 'nivel_alemao', label: 'Alemão', render: (r) => { const course = inCourse(r.id); return W.stack(course[0]?.current_level || r.nivel_alemao || 'Não informado', course.length ? `${course.length} matrícula(s) em acompanhamento` : 'Somente perfil'); } },
      { key: 'pronto_para_employer', label: 'Apresentação', render: (r) => `<div class="t4-chip-row">${U.badge(yes(r.pronto_para_employer) ? 'Liberado' : M.present(r.pronto_para_employer) ? 'Em preparação' : 'Não revisado', yes(r.pronto_para_employer) ? 'success' : '')}${M.isTalent(r) && D.canEdit() ? W.button('Revisar', 'readiness', r.id, {className:'ghost sm'}) : ''}</div>` },
      { key: 'attention', label: 'Atenção', value: (r) => T.attentionReasons(state, r).length, render: (r) => { const reasons = T.attentionReasons(state, r); return reasons.length ? `<span class="v25-attention-copy">${e(reasons.join(' · '))}</span>` : '<span class="t4-muted">Nenhum alerta</span>'; } },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => `<div class="t4-chip-row">${M.isTalent(r) ? W.button('Acompanhar', 'mapping-for', r.id, { className: 'sm', icon: 'list' }) : ''}${W.button(M.isTalent(r) ? 'Balde' : 'Talento', 'set-talent-scope', `${r.id}|${M.isTalent(r) ? 'balde' : 'talento'}`, { className: 'sm ghost' })}${W.button('Ficha', 'talent-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</div>` }
    ] });
  }
  const employerOf = (r) => W.find(state.employers, r.employer_id)?.nome || r.employer_name_snapshot || r.group_name || 'Talents 4 · interno';
  const values = (value) => Array.isArray(value) ? value.filter(M.present).map(String) : M.present(value) ? [String(value)] : [];
  const firstValue = (value) => values(value)[0] || '';
  const matches = (value, selected) => { const wanted = values(selected); return !wanted.length || wanted.some((item) => M.same(item, value) || M.norm(item) === M.norm(value)); };
  const scoped = (r) => matches(r.employer_id, state.employer) || (!r.employer_id && values(state.employer).some((id) => M.norm(r.employer_name_snapshot) === M.norm(W.find(state.employers, id)?.nome)));
  const matchQuery = (r) => !state.query || M.norm(Object.values(r).filter((v) => typeof v !== 'object').join(' ')).includes(M.norm(state.query));


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


  const actions = (row, kind) => D.canEdit() ? W.button('Editar', `edit-${kind}`, row.id, { className: 'sm ghost', icon: 'edit' }) : '';


  function replacementTable(rows) {
    return W.table({ id: 'replacements', rows, columns: [
      { key: 'profile_needed', label: 'Perfil procurado', required: true }, { key: 'employer', label: 'Empregador', value: employerOf, render: (r) => e(employerOf(r)) }, { key: 'replaces_candidate_name_snapshot', label: 'Substitui' }, { key: 'priority', label: 'Prioridade' }, { key: 'search_status', label: 'Situação', render: (r) => W.status(r.search_status) }, { key: 'edit', label: '', ariaLabel: 'Ações', sort: false, render: (r) => actions(r, 'replacement') }
    ] });
  }

  const selectionFilterLabels = { employer: 'Empregador', status: 'Situação' };
  const selectionFilterValueLabel = (key, value) => key === 'employer' ? R.employerName(state, value) : value;
  const selectionToolbar = (rows = []) => {
    const keys = ['employer', 'status'];
    return `<div class="t4-toolbar">${W.multiFilter('employer', 'Empregadores', R.choices(state.employers, 'nome'), state.employer)}${W.multiFilter('status', 'Situações', W.unique(rows, 'status'), state.status)}<span class="t4-toolbar-spacer"></span>${W.button('Limpar', 'clear', '', { className: 'ghost sm' })}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div>${W.activeFiltersBar(state, keys, selectionFilterLabels, selectionFilterValueLabel)}`;
  };

  function selectionsView() {
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
      historyRows.length ? R.selectionTable(state, historyRows, 'talent-selection-history') : U.emptyState('Nenhum registro excluído ou removido', 'Os registros retirados do acompanhamento aparecerão aqui.'),
      U.badge(historyRows.length, historyRows.length ? 'info' : 'neutral'),
      'Fora do acompanhamento ativo; preservado somente para consulta.');
    const sortedVisibleRows = [...visibleRows].sort(byRecency);
    const current = display === 'cards' && scope !== 'closed'
      ? R.selectionBoard(state, sortedVisibleRows)
      : R.selectionAnalytics(state, visibleRows, { scope, idPrefix: 'talent-selection' });
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
    return '' + `<div class="v25-page-intro"><div><span class="mx-eyebrow">CENTRO DE SELEÇÕES</span><h2>Acompanhe cada vínculo por etapa.</h2><p>Seleção = Talento + empregador + vaga + etapa. O cadastro do Talento e o dossiê do empregador continuam sendo únicos.</p></div><span class="v25-result-count">${activeRows.length} ativa${activeRows.length === 1 ? '' : 's'}</span></div>` + scopeBar + displayBar + selectionToolbar(rows.map((r) => ({ status: r.stage })), { noMonth: true }) + current +
      W.section('Reposições', replacementTable(state.replacements.filter(scoped)), D.canEdit() && workspace.available('replacements') ? W.button('Nova reposição', 'new-replacement', '', { className: 'sm', icon: 'plus' }) : '');
  }

  function opportunitiesView() {
    const closed = (r) => /fechad|cancel|arquiv|removid|encerr/i.test(M.norm(r.status || '')) || !!r.deleted_at;
    const scope = state.opportunityScope || 'open';
    const list = state.openings.filter((r) => (scope === 'open' ? !closed(r) : scope === 'closed' ? closed(r) : true) && T.matches(state.workFilters.selectionEmployer,r.employer_id) && match([r.title, r.area, r.location, R.employerName(state, r.employer_id)]));
    const count = (id) => state.openings.filter((r) => id === 'open' ? !closed(r) : id === 'closed' ? closed(r) : true).length;
    const marketNav = `<div class="mx-toolbar"><div><span class="mx-eyebrow">MERCADO</span><p class="t4-muted">Vagas cadastradas e oportunidades NectaNet</p></div><div class="mx-segment" role="group" aria-label="Visões do mercado"><button type="button" data-action="go" data-id="opportunities" data-selected="${app.view === 'opportunities'}">Vagas cadastradas</button><button type="button" data-action="go" data-id="mapping-radar" data-selected="${app.view === 'mapping-radar'}">Radar NectaNet</button></div></div>`;
    return marketNav + W.chips([{ id: 'open', label: 'Abertas', count: count('open'), icon: 'briefcase' }, { id: 'all', label: 'Todas', count: count('all'), icon: 'list' }, { id: 'closed', label: 'Encerradas', count: count('closed'), icon: 'archive' }], scope, 'opportunity-scope') + workspace.workToolbar('openings') + W.table({ id: 'talent-openings', rows: list, columns: [
      { key: 'title', label: 'Oportunidade', required: true, render: (r) => W.stack(r.title, R.employerName(state, r.employer_id)) }, { key: 'location', label: 'Localização' }, { key: 'language_requirement', label: 'Idioma requerido' }, { key: 'quantity', label: 'Posições' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => `<div class="t4-chip-row">${W.link('Ver empregador', `./organizacional.html?employer=${encodeURIComponent(r.employer_id)}`)}${D.canEdit() && state.selections.modern ? W.button('Vincular talento', 'select-opening', r.id, { className: 'sm', icon: 'plus' }) : ''}</div>` }
    ] });
  }
  function agendaView() {
    const list = state.activities.filter((r) => T.matches(state.workFilters.activityOwner,r.owner_username) && match([r.title, r.notes, r.outcome, R.talentName(state, r.talent_id), R.employerName(state, r.employer_id)]));
    const academic = state.enrollments.filter((r) => r.next_action && ['Matriculado', 'Ativo', 'Pausado'].includes(r.status) && match([r.next_action, R.talentName(state, r.candidate_id)]));
    return `${workspace.workToolbar('activities')}${R.activityTable(state, list)}${W.section('Acompanhamentos do curso de alemão', W.table({ id: 'academic-agenda', rows: academic, columns: [
      { key: 'candidate_id', label: 'Talento', required: true, render: (r) => e(R.talentName(state, r.candidate_id)) }, { key: 'next_action', label: 'Próxima ação' }, { key: 'next_action_due', label: 'Prazo', render: (r) => e(U.formatDate(r.next_action_due)) }, { key: 'owner_name', label: 'Responsável' }, { key: 'link', label: '', ariaLabel: 'Ações', sort: false, render: (r) => W.link('Abrir matrícula', `./alemao.html?enrollment=${encodeURIComponent(r.id)}`, 'graduation') }
    ] }), W.link('Calendário organizacional', './organizacional.html?view=calendar', 'calendar'))}`;
  }
  async function talentDetail(id) {
    const version = ++state.detailVersion;
    const brief = W.find(state.talents, id);
    const drawer = U.openDrawer({ title: brief?.nome_completo || 'Ficha do talento', subtitle: 'Carregando o cadastro completo…', body: '<div class="t4-skeleton"></div>' });
    try {
      const full = await D.one(D.TABLES.candidates, id);
      if (version !== state.detailVersion || !drawer.isConnected) return;
      state.detail = full; state.detailTab = 'profile'; renderDetail();
    } catch (err) { if (drawer.isConnected) drawer.querySelector('.t4-drawer-body').innerHTML = W.note(W.formatError(err), 'error') + W.button('Tentar novamente', 'talent-detail', id, { className: 'primary sm' }); }
  }
  const DETAIL_TABS = [{ id: 'profile', label: 'Perfil' }, { id: 'selections', label: 'Seleções' }, { id: 'course', label: 'Alemão' }, { id: 'documents', label: 'Documentos' }, { id: 'history', label: 'Histórico' }, { id: 'all', label: 'Todos os dados' }];
  // Todo campo já mostrado com rótulo próprio em alguma aba acima — "Todos
  // os dados" existe para o que sobra sem apresentação dedicada, não para
  // repetir o que já está organizado. Sem esta lista, R.storedFields()
  // mostrava de novo (com o nome bruto da coluna) todo campo já visível em
  // Perfil/Alemão/Documentos/Histórico — a própria causa da ficha parecer
  // uma planilha crua nessa aba.
  const DETAIL_SHOWN_FIELDS = [
    'id', 'nome_completo', 'ativo', 'crm_scope', 'profissao_principal', 'area_profissional', 'cidade_atual', 'pais_de_origem', 'status_pipeline',
    'email', 'telefone', 'idade', 'responsavel_interno', 'prioridade_comercial', 'disponibilidade_mudanca', 'pronto_para_employer',
    'perfil_profissional_para_apresentacao', 'resumo_profissional', 'resumo_rh_curto', 'relato_sobre_a_experiencia_profissional',
    'curso_de_graduacao', 'universidade', 'posgraduacao', 'experiencia_profissional_tempo',
    'observacoes_internas', 'observacao',
    'nivel_alemao', 'instituicao_ensino', 'nivel_alvo', 'previsao_termino_alemao', 'bolsa_concedida', 'bolsa_percentual',
    'documentacao_completa', 'pendencia_documental_critica', 'passaporte_status', 'passaporte_validade', 'validade_do_passaporte',
    'diploma_status', 'diploma', 'historico_status', 'historico', 'registro_status', 'anabin',
    'cv_drive_web_link', 'passaporte_arquivo', 'diploma_arquivo', 'historico_arquivo', 'registro_arquivo',
    'data_da_candidatura', 'ultima_atualizacao', 'atualizado_por', 'motivo_inativacao', 'data_inativacao', 'reativavel', 'historico_operacional'
  ];
  function renderDetail() {
    const r = state.detail;
    if (!r) return;
    const activeRelationships = selectionsFor(r.id).filter((item) => M.selectionBucket(item) !== 'closed');
    const lifecycle = active(r) ? 'Talento ativo' : activeRelationships.length ? `Arquivado · ${activeRelationships.length} seleção${activeRelationships.length === 1 ? '' : 'ões'} em andamento` : 'Arquivado';
    const lifecycleNotice = !active(r) && activeRelationships.length ? W.note(`Este cadastro está arquivado, mas mantém ${activeRelationships.length} seleção${activeRelationships.length === 1 ? '' : 'ões'} em andamento. A ficha fica fora da fila ativa de Talentos; o vínculo continua em Seleções.`, 'warning') : '';
    const operationalActions = M.isTalent(r) ? W.button('Acompanhamento', 'mapping-for', r.id, {className:'sm',icon:'list'}) + W.button('Preparar Nectanet', 'presentation-profile', r.id, {className:'sm',disabled:!workspace.available('mappingProfiles')}) + W.button('Revisar liberação', 'readiness', r.id, {className:'sm'}) : '';
    const detailActions = `${D.canEdit() ? W.button('Editar ficha', 'edit-talent', r.id, { className: 'primary sm', icon: 'edit' }) + W.button('Nova atividade', 'activity-for', r.id, { className: 'sm', icon: 'plus' }) + operationalActions + W.button(M.isTalent(r) ? 'Mover para Balde' : 'Marcar como Talento', 'set-talent-scope', `${r.id}|${M.isTalent(r) ? 'balde' : 'talento'}`, {className:'sm'}) : ''}${!D.canEdit() ? operationalActions : ''}${W.button('Preparar PDF', 'pdf', r.id, { className: 'sm', icon: 'download' })}${W.link('Contato', `./contatos.html?talent=${encodeURIComponent(r.id)}`, 'contact')}`;
    let html = '';
    if (state.detailTab === 'profile') html = `${lifecycleNotice}<div class="t4-profile-lead"><span class="t4-avatar large">${e(U.initials(r.nome_completo))}</span><div><h3>${e(r.profissao_principal || r.area_profissional || 'Profissão não informada')}</h3><p>${e([r.cidade_atual, r.pais_de_origem].filter(Boolean).join(' · '))}</p><div class="t4-chip-row">${U.badge(M.scopeLabel(r), M.isTalent(r) ? 'success' : '')}${W.status(U.term(r.status_pipeline))}</div></div></div><div class="t4-detail-grid">${U.field('E-mail', r.email)}${U.field('Telefone', r.telefone)}${U.field('Idade', r.idade)}${U.field('Responsável', r.responsavel_interno)}${U.field('Prioridade', r.prioridade_comercial)}${U.field('Área profissional', r.area_profissional)}${U.field('Disponibilidade de mudança', r.disponibilidade_mudanca)}${U.field('Pronto para o empregador', r.pronto_para_employer)}</div>${W.section('Perfil profissional', `<p class="t4-preserve">${e(r.perfil_profissional_para_apresentacao || r.resumo_profissional || r.resumo_rh_curto || 'Não informado')}</p><div class="t4-detail-grid">${U.field('Formação', r.curso_de_graduacao)}${U.field('Instituição', r.universidade)}${U.field('Pós-graduação', r.posgraduacao)}${U.field('Experiência', r.experiencia_profissional_tempo)}</div><p class="t4-preserve">${e(r.relato_sobre_a_experiencia_profissional || '')}</p>`)}${W.section('Contexto interno', `<p class="t4-preserve">${e(r.observacoes_internas || r.observacao || 'Sem observações internas.')}</p>`)}${D.canEdit() ? W.button(active(r) ? 'Arquivar registro' : 'Reativar registro', 'archive-talent', r.id, { className: 'sm', icon: 'archive' }) : ''}`;
    else if (state.detailTab === 'selections') {
      const relationships = selectionsFor(r.id), activeRelationships = relationships.filter((item) => M.selectionBucket(item) !== 'closed'), archivedRelationships = relationships.filter((item) => M.selectionBucket(item) === 'closed');
      html = `<div class="v25-inline-help">A fila mostra relações em andamento. Encerradas permanecem preservadas no histórico e só aparecem abaixo, em uma seção separada.</div>${R.selectionTable(state, activeRelationships, 'talent-selections')}${archivedRelationships.length ? W.section('Histórico de seleções encerradas', R.selectionTable(state, archivedRelationships, 'talent-closed-selections'), U.badge(`${archivedRelationships.length} preservada(s)`, 'info')) : ''}${D.canEdit() && state.selections.modern ? W.button('Nova seleção', 'selection-for-talent', r.id, { className: 'primary', icon: 'plus' }) : ''}`;
    }
    else if (state.detailTab === 'course') html = `<div class="t4-detail-grid">${U.field('Nível informado no perfil', r.nivel_alemao)}${U.field('Instituição (cadastro anterior)', r.instituicao_ensino)}${U.field('Nível-alvo (perfil)', r.nivel_alvo)}${U.field('Previsão de término', U.formatDate(r.previsao_termino_alemao))}${U.field('Bolsa concedida', r.bolsa_concedida)}${U.field('Bolsa percentual', r.bolsa_percentual)}</div>` + state.enrollments.filter((en) => M.same(en.candidate_id, r.id)).map((en) => W.section(W.find(state.classes, en.class_id)?.name || 'Matrícula', `<div class="t4-detail-grid">${U.field('Situação', en.status)}${U.field('Nível no curso', en.current_level)}${U.field('Meta', en.target_level)}${U.field('Presença', M.finite(en.attendance_percent) ? `${en.attendance_percent}%` : 'Sem registro')}${U.field('Prova', en.exam_status)}${U.field('Responsável', en.owner_name)}</div><p>${e(en.next_action || '')}</p><small>${e(U.formatDate(en.next_action_due))}</small>`, W.link('Abrir acompanhamento', `./alemao.html?enrollment=${encodeURIComponent(en.id)}`, 'graduation'))).join('') + W.link('Ir para Alemão', `./alemao.html?talent=${encodeURIComponent(r.id)}`, 'graduation');
    else if (state.detailTab === 'documents') html = W.note('Consulta dos dados e links já cadastrados. Não há upload nem sincronização com Google nesta versão.') + `<div class="t4-detail-grid">${[['Documentação completa', r.documentacao_completa], ['Pendência crítica', r.pendencia_documental_critica], ['Passaporte', r.passaporte_status], ['Validade', r.passaporte_validade || r.validade_do_passaporte], ['Diploma', r.diploma_status || r.diploma], ['Histórico', r.historico_status || r.historico], ['Registro profissional', r.registro_status], ['Reconhecimento', r.anabin]].map(([k, v]) => U.field(k, v)).join('')}</div><div class="t4-resource-links">${[['Currículo', r.cv_drive_web_link], ['Passaporte', r.passaporte_arquivo], ['Diploma', r.diploma_arquivo], ['Histórico', r.historico_arquivo], ['Registro profissional', r.registro_arquivo]].map(([label, url]) => W.external(label, url)).join('')}</div>`;
    else if (state.detailTab === 'history') html = R.activityTable(state, state.activities.filter((ac) => M.same(ac.talent_id, r.id)), 'talent-activities') + `<div class="t4-detail-grid">${U.field('Entrada na base', U.formatDate(r.data_da_candidatura))}${U.field('Última atualização', U.formatDate(r.ultima_atualizacao, true))}${U.field('Atualizado por', r.atualizado_por)}${U.field('Motivo de saída', r.motivo_inativacao)}${U.field('Data de inativação', U.formatDate(r.data_inativacao))}${U.field('Reativável', r.reativavel)}</div><details class="t4-disclosure"><summary>Histórico operacional anterior</summary><pre class="t4-raw">${e(typeof r.historico_operacional === 'object' ? JSON.stringify(r.historico_operacional, null, 2) : r.historico_operacional || 'Sem histórico neste campo.')}</pre></details>`;
    else html = W.note('Leitura completa dos campos presentes no cadastro. Campos sem apresentação dedicada continuam preservados, inclusive estruturas antigas. Valores não editados não são enviados ao salvar.') + R.storedFields(r, DETAIL_SHOWN_FIELDS);
    U.openDrawer({ title: r.nome_completo, subtitle: `${r.id} · ${lifecycle}`, actions: detailActions, body: `<nav class="t4-detail-tabs" aria-label="Seções da ficha">${DETAIL_TABS.map((tab) => `<button type="button" data-action="detail-tab" data-id="${a(tab.id)}" aria-pressed="${tab.id === state.detailTab}" class="${tab.id === state.detailTab ? 'active' : ''}">${e(tab.label)}</button>`).join('')}</nav>${html}` });
  }
  const BASIC_FIELDS = [
    { section: 'Identificação e contato' }, { name: 'nome_completo', label: 'Nome completo', required: true, wide: true },
    ...R.fields([['email', 'E-mail', 'email'], ['telefone', 'Telefone'], ['cidade_atual', 'Cidade atual'], ['pais_de_origem', 'País de origem'], ['idade', 'Idade']]),
    { section: 'Perfil profissional' },
    ...R.fields([['profissao_principal', 'Profissão principal'], ['area_profissional', 'Área profissional'], ['universidade', 'Instituição de formação'], ['curso_de_graduacao', 'Curso de graduação'], ['posgraduacao', 'Pós-graduação'], ['experiencia_profissional_tempo', 'Tempo de experiência'], ['anabin', 'Reconhecimento / Anabin'], ['perfil_profissional_para_apresentacao', 'Perfil para apresentação', 'textarea'], ['resumo_profissional', 'Resumo profissional', 'textarea'], ['resumo_rh_curto', 'Resumo executivo de RH', 'textarea'], ['relato_sobre_a_experiencia_profissional', 'Experiência profissional', 'textarea']]),
    { section: 'Idioma informado no perfil' },
    { name: 'nivel_alemao', label: 'Nível de alemão (perfil)', type: 'select', options: R.LEVELS },
    ...R.fields([['lingua_estrangeira', 'Outro idioma'], ['nivel_lingua_estrangeira', 'Nível do outro idioma'], ['instituicao_ensino', 'Instituição anterior'], ['nivel_alvo', 'Nível-alvo do perfil', 'select', R.LEVELS], ['previsao_termino_alemao', 'Previsão de término', 'date'], ['resultado_da_prova', 'Resultado de prova registrado no perfil'], ['bolsa_concedida', 'Bolsa concedida'], ['bolsa_percentual', 'Bolsa (%)', 'number']]),
    { section: 'Acompanhamento interno' },
    { name: 'crm_scope', label: 'Classificação na base', type: 'select', options: [{ value: 'talento', label: 'Talento · entra nas filas operacionais' }, { value: 'balde', label: 'Balde · cadastro geral' }], required: true, placeholder: null },
    { name: 'status_pipeline', label: 'Etapa de acompanhamento', type: 'select', options: ['Novo candidato', 'Triagem', 'Pré-seleção', 'Entrevista', 'Análise', 'Curso de Alemão', 'Documentação', 'Pronto para employer', 'Enviado ao employer', 'Contratado'], required: true, placeholder: null },
    { name: 'responsavel_interno', label: 'Responsável interno' }, { name: 'prioridade_comercial', label: 'Prioridade', type: 'select', options: R.PRIORITIES },
    ...R.fields([['disponibilidade_mudanca', 'Disponibilidade de mudança'], ['data_prevista_mudanca', 'Previsão de mudança', 'date'], ['observacoes_internas', 'Observações internas', 'textarea'], ['observacao', 'Outras observações', 'textarea']]),
    { section: 'Documentação · situação informada' },
    ...R.fields([['passaporte_status', 'Situação do passaporte'], ['passaporte_numero', 'Número do passaporte'], ['passaporte_validade', 'Validade', 'date'], ['diploma_status', 'Situação do diploma'], ['historico_status', 'Situação do histórico'], ['registro_status', 'Situação do registro profissional'], ['registro_numero', 'Número do registro'], ['registro_validade', 'Validade do registro', 'date'], ['pendencia_documental_critica', 'Pendência documental crítica', 'textarea'],['cv_drive_web_link','Link do CV','url']])
  ];
  async function editTalent(row) {
    if (!D.canEdit()) return;
    const original = row?.id ? await D.one(D.TABLES.candidates, row.id) : null;
    const data = original || { crm_scope: 'balde', status_pipeline: 'Novo candidato', prioridade_comercial: 'Normal', responsavel_interno: D.profile.nome };
    const createNames = ['nome_completo', 'email', 'telefone', 'cidade_atual', 'pais_de_origem', 'profissao_principal', 'area_profissional', 'nivel_alemao', 'crm_scope', 'status_pipeline', 'responsavel_interno', 'prioridade_comercial', 'resumo_rh_curto'];
    const definitions = BASIC_FIELDS.filter((f) => f.section || (original ? f.name in original : createNames.includes(f.name)));
    // Retira títulos de seções que não têm campos disponíveis neste cadastro.
    const shown = definitions.filter((f, i) => !f.section || definitions[i + 1] && !definitions[i + 1].section);
    const newId = `T4-${new Date().getFullYear()}-${D.uuid().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    return W.form({ title: original ? 'Editar ficha do talento' : 'Novo talento', row: data, fields: shown,
      notice: 'Somente campos alterados serão gravados. A evolução das aulas e as seleções continuam ligadas a esta ficha; não são substituídas por uma mudança de etapa.',
      onSubmit: async (values, changes) => {
        if ('cv_drive_web_link' in changes && changes.cv_drive_web_link && !M.safeUrl(changes.cv_drive_web_link)) throw new Error('Informe um link HTTP ou HTTPS válido, sem credenciais embutidas.');
        if (original) {
          if (Object.keys(changes).length) {
            if ('status_pipeline' in changes && 'data_entrada_etapa_atual' in original) changes.data_entrada_etapa_atual = new Date().toISOString();
            changes.ultima_atualizacao = new Date().toISOString();
            if ('atualizado_por' in original) changes.atualizado_por = D.profile.nome;
            await D.update(D.TABLES.candidates, original.id, changes, original.ultima_atualizacao ? { expectedUpdatedAt: original.ultima_atualizacao, expectedColumn: 'ultima_atualizacao' } : {});
          }
        } else {
          const repeated = values.email && state.talents.find((r) => M.norm(r.email) === M.norm(values.email));
          if (repeated) throw new Error('Já existe um talento com este e-mail. Confira a ficha existente antes de criar outra.');
          await D.insert(D.TABLES.candidates, { ...values, crm_scope: values.crm_scope || 'balde', id: newId, ativo: true, data_da_candidatura: M.today(), ultima_atualizacao: new Date().toISOString() });
        }
        U.toast('Ficha salva no cadastro único de talentos.', 'success');
        await load();
        if (original && state.detail?.id === original.id) { state.detail = await D.one(D.TABLES.candidates, original.id); renderDetail(); }
      } });
  }
  async function setTalentScope(id, requestedScope) {
    if (!D.canEdit()) return;
    const row = await D.one(D.TABLES.candidates, id);
    const scope = requestedScope === 'talento' ? 'talento' : 'balde';
    if (M.talentScope(row) === scope) return;
    await D.update(D.TABLES.candidates, id, { crm_scope: scope, ultima_atualizacao: new Date().toISOString() }, row.ultima_atualizacao ? { expectedUpdatedAt: row.ultima_atualizacao, expectedColumn: 'ultima_atualizacao' } : {});
    U.toast(scope === 'talento' ? 'Registro marcado como Talento e incluído nas filas operacionais.' : 'Registro movido para o Balde; histórico e vínculos foram preservados.', 'success');
    U.closeDrawer();
    await load();
  }
  async function archiveTalent(row) {
    if (!D.canEdit()) return;
    const original = await D.one(D.TABLES.candidates, row.id), restoring = !active(original);
    return W.form({ title: restoring ? 'Reativar talento' : 'Arquivar talento', subtitle: original.nome_completo,
      notice: restoring ? 'A ficha, as matrículas e os vínculos seletivos serão preservados. A reativação devolve o Talento à fila ativa.' : (() => { const count = selectionsFor(original.id).filter((item) => M.selectionBucket(item) !== 'closed').length; return count ? `Este Talento mantém ${count} seleção${count === 1 ? '' : 'ões'} em andamento. O arquivamento o retira da fila ativa, mas não encerra esses vínculos; confirme somente se essa separação for intencional.` : 'A ficha, as matrículas e os vínculos seletivos serão preservados. O arquivamento apenas retira o Talento da fila ativa.'; })(),
      fields: [{ name: 'reason', label: restoring ? 'Motivo da reativação' : 'Motivo do arquivamento', type: 'textarea', required: true, wide: true }],
      submitLabel: restoring ? 'Reativar talento' : 'Arquivar talento', onSubmit: async (values) => {
        const patch = { ativo: restoring, data_inativacao: restoring ? null : M.today(), ultima_atualizacao: new Date().toISOString() };
        if (!restoring) { patch.motivo_inativacao = values.reason; if ('etapa_de_saida' in original) patch.etapa_de_saida = original.status_pipeline; }
        if ('observacao_final_de_saida' in original) patch.observacao_final_de_saida = [original.observacao_final_de_saida, `${M.today()} · ${restoring ? 'Reativação' : 'Arquivamento'}: ${values.reason}${restoring && original.data_inativacao ? ` (arquivado anteriormente em ${original.data_inativacao})` : ''}`].filter(Boolean).join('\n');
        await D.update(D.TABLES.candidates, original.id, patch, original.ultima_atualizacao ? { expectedUpdatedAt: original.ultima_atualizacao, expectedColumn: 'ultima_atualizacao' } : {});
        U.toast(restoring ? 'Talento reativado.' : 'Talento arquivado, com histórico preservado.', 'success');
        U.closeDrawer(); await load();
      } });
  }
  W.bind(app, { change(key, value) { if (app.view === 'processes' && (key === 'employer' || key === 'status')) { state[key] = value; render(); return; } if (workspace.change(key,value)) return; state[key] = value; render(); }, async action(action, id) {
    if (action === 'reload') return D.session ? load() : location.reload();
    if (action === 'go') return app.route(id);
    if (action === 'v24-view') {
      if (id === 'archived') { state.quick = []; app.route('archived'); return; }
      if (id === 'ready') { state.talentScope = 'talento'; state.quick = ['ready']; state.presentationView = 'released'; app.route('presentation'); return; }
      state.quick = id === 'all' ? [] : [id];
      app.route('talents');
      return;
    }
    if (action === 'talent-scope') { state.talentScope = id === 'balde' ? 'balde' : 'talento'; state.quick = []; if (app.view !== 'talents') app.route('talents'); else render(); return; }
    if (action === 'set-talent-scope') { const [talentId, scope] = String(id).split('|'); return setTalentScope(talentId, scope); }
    if (action === 'talent-display') { state.display = ['cards','list','table'].includes(id) ? id : 'list'; render(); return; }
    if (action === 'select-visible' || action === 'deselect-visible') {
      const rows = filtered(app.view === 'archived');
      rows.forEach((row) => action === 'select-visible' ? state.selectedTalents.add(String(row.id)) : state.selectedTalents.delete(String(row.id)));
      render(); return;
    }
    if (action === 'clear-selection') { state.selectedTalents.clear(); render(); return; }
    if (action === 'data-center') {
      if (!(state.selectedTalents instanceof Set) || !state.selectedTalents.size) return U.toast('Selecione ao menos um Talento antes de exportar.', 'warning');
      if (!window.T4ImportExport?.open) return U.toast('A exportação ainda está carregando. Atualize a página e tente novamente.', 'error');
      return window.T4ImportExport.open({ state, load });
    }
    if (action === 'clear') { state.stage = ''; state.german = ''; state.employer = []; state.owner = ''; state.status = []; state.month = ''; state.filters = {}; state.workFilters = {}; state.quick = []; state.talentScope = 'talento'; state.selectionScope = 'active'; state.selectionShowClosed = false; state.opportunityScope = 'open'; state.mappingStatus = []; state.multiSearch = {}; state.query = ''; app.resetSearch(); render(); return; }
    if (await workspace.action(action,id)) return;
    if (action === 'selection-display') { state.selectionDisplay = id === 'cards' ? 'cards' : 'list'; render(); return; }
    if (action === 'board') { state.board = id; state.selectionDisplay = id === 'board' ? 'cards' : 'list'; render(); return; }
    if (action === 'selection-scope') { state.selectionScope = ['active', 'all', 'closed'].includes(id) ? id : 'active'; render(); return; }
    if (action === 'opportunity-scope') { state.opportunityScope = ['open', 'all', 'closed'].includes(id) ? id : 'open'; render(); return; }
    if (action === 'talent-detail') return talentDetail(id);
    if (action === 'detail-tab') { state.detailTab = id; renderDetail(); return; }
    if (action === 'edit-talent') return editTalent({ id });
    if (action === 'archive-talent') return archiveTalent({ id });
    if (action === 'selection-detail') return R.selectionDrawer(state, state.selections.rows.find((r) => r.key === id));
    if (action === 'bi-clear-day' || action === 'bi-clear-stage') { state.biDayFilter = null; state.biStageFilter = null; updatePriorityList(); return; }
    if (action === 'bi-period') { state.biPeriod = id; state.biDayFilter = null; state.biStageFilter = null; render(); return; }
    if (action === 'bi-clear-filters') { state.biPeriod = 'week7'; state.biDayFilter = null; state.biStageFilter = null; render(); return; }
    if (action === 'edit-selection') return R.editSelection(state, state.selections.rows.find((r) => r.key === id), {}, load);
    if (action === 'selection-for-talent') return R.editSelection(state, null, { talent_id: id }, load);
    if (action === 'select-opening') return R.editSelection(state, null, { opening_id: id }, load);
    if (action === 'edit-activity') return R.editActivity(state, W.find(state.activities, id), {}, load);
    if (action === 'activity-for') return R.editActivity(state, null, { talent_id: id }, load);
    if (action === 'finish-activity') return R.finishActivity(W.find(state.activities, id), load);
    if (action === 'pdf') { const row = state.detail?.id === id ? state.detail : await D.one(D.TABLES.candidates, id); return window.T4PDF.open(row, state); }
  } });
  app.pageRoot.addEventListener('change', (event) => {
    const input = event.target.closest?.('[data-talent-select]');
    if (!input) return;
    const id = String(input.dataset.id || '');
    if (!id) return;
    if (input.checked) state.selectedTalents.add(id);
    else state.selectedTalents.delete(id);
    render();
  });
  app.onRoute(() => { state.multiOpen = ''; if (app.view === 'archived') { state.quick = []; state.talentScope = 'talento'; } if (app.view === 'presentation') state.talentScope = 'talento'; if (app.view === 'talents') state.quick = state.quick.filter((v) => v !== 'ready'); render(); });
  W.start(app, async () => {
    await load();
    const id = new URLSearchParams(location.search).get('talent');
    if (id && !state.openedInitial) { state.openedInitial = true; await talentDetail(id); }
  }, [D.TABLES.candidates, D.TABLES.employers, D.TABLES.openings, D.TABLES.matches, D.TABLES.legacyMatches, D.TABLES.legacyLinks, D.TABLES.activities, D.TABLES.contacts, D.TABLES.enrollments, D.TABLES.classes, ...Object.values(T.TABLES)]);
})();
