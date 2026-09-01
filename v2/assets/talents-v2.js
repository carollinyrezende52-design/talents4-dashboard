(function () {
  'use strict';

  const U = window.T4V2;
  const D = window.T4Data;
  const VIEWS = [
    { id: 'overview', label: 'Visão de trabalho', title: 'Visão de trabalho', subtitle: 'Prioridades, gargalos e próximos passos dos Talentos.', icon: 'dashboard' },
    { id: 'talents', label: 'Talentos', title: 'Talentos', subtitle: 'Lista única, filtros rápidos e ficha 360.', icon: 'users' },
    { id: 'opportunities', label: 'Oportunidades', title: 'Oportunidades para Talentos', subtitle: 'Compatibilidade por vaga, viabilidade e barreiras.', icon: 'target' },
    { id: 'processes', label: 'Processos', title: 'Processos seletivos', subtitle: 'Movimentação dos Talentos pelas etapas atuais.', icon: 'columns' },
    { id: 'agenda', label: 'Agenda', title: 'Agenda integrada', subtitle: 'Próximas ações vinculadas aos registros.', icon: 'calendar' },
    { id: 'archived', label: 'Arquivados', title: 'Talentos arquivados', subtitle: 'Histórico preservado, fora da operação ativa.', icon: 'archive' }
  ];

  const app = U.mount({
    module: 'talents',
    moduleLabel: 'Talentos',
    defaultView: 'overview',
    views: VIEWS,
    searchPlaceholder: 'Buscar Talento, profissão ou cidade…'
  });

  const state = {
    candidates: [], employers: [], openings: [], matches: [], activities: [],
    matchesModern: false, activitiesAvailable: false, query: '', stage: '', german: '', quick: 'all', loading: true
  };

  const STAGES = ['Novo candidato', 'Triagem', 'Pré-seleção', 'Entrevista', 'Análise', 'Curso de Alemão', 'Documentação', 'Pronto para employer', 'Enviado ao employer', 'Contratado'];
  const LEVELS = ['Pré-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const candidateName = (row) => row?.nome_completo || 'Talento sem nome';
  const candidateActive = (row) => D.activeValue(row?.ativo) && !row?.data_inativacao;
  const candidateStage = (row) => row?.status_pipeline || row?.substatus || 'Sem etapa';
  const employerById = (id) => state.employers.find((row) => String(row.id) === String(id));
  const openingById = (id) => state.openings.find((row) => String(row.id) === String(id));
  const candidateById = (id) => state.candidates.find((row) => String(row.id) === String(id));
  const normalizedMatches = () => state.matches.map((row) => D.mapMatch(row));

  function generateTalentId() {
    const suffix = D.uuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `T4-${new Date().getFullYear()}-${suffix}`;
  }

  function activityOpen(row) { return !['Concluída', 'Cancelada'].includes(row?.status); }
  function activityOverdue(row) { return activityOpen(row) && row?.due_at && new Date(row.due_at).getTime() < Date.now(); }
  function highPriority(row) {
    return /alta|critica|crítica|urgente/i.test(row?.prioridade_comercial || '')
      || !!row?.pendencia_documental_critica
      || /alto|crítico/i.test(row?.risco_desistencia || '');
  }

  async function loadAll(options = {}) {
    app.setSync('loading', options.background ? 'Atualizando' : 'Carregando dados');
    try {
      const [candidates, employers, openings, matches, activities] = await Promise.all([
        D.loadCandidates({ activeOnly: false }),
        D.loadEmployers({ activeOnly: false }),
        D.loadOpenings(),
        D.loadMatches(),
        D.loadActivities({ openOnly: false })
      ]);
      state.candidates = candidates;
      state.employers = employers.filter((row) => D.activeValue(row.ativo) && !row.deleted_at);
      state.openings = openings.filter((row) => row.is_active !== false && !row.deleted_at);
      state.matches = matches.rows;
      state.matchesModern = matches.modern;
      state.activities = activities.data;
      state.activitiesAvailable = activities.available;
      state.loading = false;
      updateCounts();
      render();
      app.setSync('ok', `Atualizado ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`);
    } catch (error) {
      state.loading = false;
      app.setSync('error', 'Falha ao carregar');
      app.pageRoot.innerHTML = errorPanel(error);
    }
  }

  function errorPanel(error) {
    return `${U.pageHead('Não foi possível carregar Talentos', 'A V2 não alterou nenhum registro. Verifique a sessão e tente novamente.')}
      <div class="t4-alert error">${U.icon('warning')}<div><strong>Erro de leitura do Supabase</strong>${U.esc(error?.message || error)}</div></div>
      <button type="button" class="t4-btn primary" data-action="reload">${U.icon('refresh')}Tentar novamente</button>`;
  }

  function updateCounts() {
    const active = state.candidates.filter(candidateActive);
    app.setCounts({
      talents: active.length,
      opportunities: normalizedMatches().filter((row) => !/encerrado|cancelado|reprovado/i.test(row.status || row.stage || '')).length,
      agenda: state.activities.filter(activityOpen).length,
      archived: state.candidates.length - active.length
    });
  }

  function filteredCandidates(activeOnly = true) {
    const query = U.normalize(state.query);
    return state.candidates.filter((row) => {
      if (activeOnly !== candidateActive(row)) return false;
      if (state.stage && candidateStage(row) !== state.stage) return false;
      if (state.german && String(row.nivel_alemao || '') !== state.german) return false;
      if (state.quick === 'priority' && !highPriority(row)) return false;
      if (state.quick === 'documents' && !(row.pendencia_documental_critica || row.documentacao_completa === false)) return false;
      if (state.quick === 'ready' && !(row.pronto_para_employer || /pronto/i.test(candidateStage(row)))) return false;
      if (!query) return true;
      return U.normalize([
        row.nome_completo, row.email, row.telefone, row.profissao_principal, row.area_profissional,
        row.cidade_atual, row.pais_de_origem, row.responsavel_interno, candidateStage(row)
      ].filter(Boolean).join(' ')).includes(query);
    });
  }

  function render() {
    if (state.loading) return;
    const handlers = {
      overview: renderOverview,
      talents: () => renderTalentList(true),
      opportunities: renderOpportunities,
      processes: renderProcesses,
      agenda: renderAgenda,
      archived: () => renderTalentList(false)
    };
    (handlers[app.view] || renderOverview)();
  }

  function renderOverview() {
    app.setPrimaryAction(D.canEdit() ? 'Novo Talento' : '', D.canEdit() ? () => openTalentForm() : null);
    app.setSearchHandler((value) => { state.query = value; if (value) app.route('talents'); }, 'Buscar em Talentos…');
    const active = state.candidates.filter(candidateActive);
    const priority = active.filter(highPriority);
    const ready = active.filter((row) => row.pronto_para_employer || /pronto/i.test(candidateStage(row)));
    const overdue = state.activities.filter(activityOverdue);
    const stageCounts = new Map();
    active.forEach((row) => stageCounts.set(candidateStage(row), (stageCounts.get(candidateStage(row)) || 0) + 1));
    const topPriority = [...priority].sort((a, b) => String(b.ultima_atualizacao || '').localeCompare(String(a.ultima_atualizacao || ''))).slice(0, 7);
    const urgentActions = [...state.activities].filter(activityOpen).sort((a, b) => String(a.due_at || '9999').localeCompare(String(b.due_at || '9999'))).slice(0, 7);

    app.pageRoot.innerHTML = `${U.pageHead('Hoje em Talentos', 'Uma visão curta do que precisa de decisão ou acompanhamento, sem repetir cadastros.')}
      <section class="t4-kpi-grid">
        ${U.kpi('Talentos ativos', active.length, `${state.candidates.length - active.length} arquivados`)}
        ${U.kpi('Prioridade alta', priority.length, 'Risco, documentação ou prioridade comercial', priority.length ? 'risk' : 'good')}
        ${U.kpi('Prontos para oportunidade', ready.length, 'Com indicação operacional de prontidão', 'good')}
        ${U.kpi('Atividades vencidas', overdue.length, state.activitiesAvailable ? 'Agenda integrada' : 'Migration V2 pendente', overdue.length ? 'risk' : 'good')}
      </section>
      ${!state.activitiesAvailable ? migrationAlert('A agenda central ainda não existe. A V2 está lendo o CRM atual; aplique a migration somente depois da homologação.') : ''}
      <div class="t4-grid two-wide">
        <section class="t4-panel">
          <div class="t4-panel-head"><div class="t4-panel-head-copy"><div class="t4-panel-title">Talentos que pedem atenção</div><div class="t4-panel-subtitle">Prioridade, risco ou pendência documental</div></div><button class="t4-btn sm" data-go="talents" data-quick="priority">Ver lista</button></div>
          <div class="t4-panel-body">${topPriority.length ? `<div class="t4-list">${topPriority.map((row) => talentListItem(row)).join('')}</div>` : U.emptyState('Nenhuma prioridade alta', 'Os registros ativos não possuem alerta de prioridade neste momento.')}</div>
        </section>
        <section class="t4-panel">
          <div class="t4-panel-head"><div class="t4-panel-head-copy"><div class="t4-panel-title">Próximas ações</div><div class="t4-panel-subtitle">Ordenadas por vencimento</div></div><button class="t4-btn sm" data-go="agenda">Abrir agenda</button></div>
          <div class="t4-panel-body">${urgentActions.length ? `<div class="t4-list">${urgentActions.map(activityListItem).join('')}</div>` : U.emptyState('Agenda livre', state.activitiesAvailable ? 'Nenhuma atividade pendente.' : 'A agenda integrada será ativada pela migration V2.')}</div>
        </section>
      </div>
      <section class="t4-panel" style="margin-top:16px">
        <div class="t4-panel-head"><div class="t4-panel-head-copy"><div class="t4-panel-title">Distribuição por etapa</div><div class="t4-panel-subtitle">Clique em uma etapa para abrir a lista filtrada</div></div></div>
        <div class="t4-panel-body">${[...stageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => `<button type="button" class="t4-metric-bar" data-stage="${U.attr(label)}" style="width:100%;border:0;background:transparent;cursor:pointer"><span class="t4-metric-label">${U.esc(U.term(label))}</span><span class="t4-progress"><span style="width:${U.clamp(count / Math.max(active.length, 1) * 100)}%"></span></span><span class="t4-metric-value">${count}</span></button>`).join('') || U.emptyState('Sem Talentos ativos', 'Cadastre ou reative um Talento para iniciar o acompanhamento.')}</div>
      </section>`;
  }

  function talentListItem(row) {
    return `<button type="button" class="t4-list-item" data-open-talent="${U.attr(row.id)}" style="width:100%;border:0;background:transparent;text-align:left;cursor:pointer">
      <span class="t4-avatar-sm">${U.esc(U.initials(candidateName(row)))}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(candidateName(row))}</span><span class="t4-list-meta">${U.esc([row.profissao_principal || row.area_profissional, row.cidade_atual, row.nivel_alemao].filter(Boolean).join(' · ') || 'Informações profissionais pendentes')}</span></span>${U.badge(candidateStage(row), U.toneForStatus(candidateStage(row)))}</button>`;
  }

  function activityListItem(row) {
    const talent = candidateById(row.talent_id);
    return `<div class="t4-list-item"><span class="t4-timeline-dot">${U.icon(row.activity_type === 'Reunião' ? 'calendar' : 'check')}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(row.title || 'Atividade')}</span><span class="t4-list-meta">${U.esc(talent ? candidateName(talent) : row.owner_username || 'Sem vínculo')} · ${U.esc(U.formatRelative(row.due_at))}</span></span>${U.badge(row.priority || row.status || 'Pendente', activityOverdue(row) ? 'danger' : U.toneForStatus(row.priority || row.status))}</div>`;
  }

  function listToolbar(activeOnly) {
    const rows = filteredCandidates(activeOnly);
    const stageOptions = [...new Set(state.candidates.map(candidateStage))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return `<div class="t4-toolbar">
      <label class="t4-toolbar-search">${U.icon('search')}<input type="search" data-list-search value="${U.attr(state.query)}" placeholder="Nome, profissão, cidade, e-mail…"></label>
      <select data-filter-stage aria-label="Filtrar por etapa"><option value="">Todas as etapas</option>${stageOptions.map((item) => `<option value="${U.attr(item)}" ${state.stage === item ? 'selected' : ''}>${U.esc(U.term(item))}</option>`).join('')}</select>
      <select data-filter-german aria-label="Filtrar por alemão"><option value="">Todo alemão</option>${LEVELS.map((item) => `<option ${state.german === item ? 'selected' : ''}>${item}</option>`).join('')}</select>
      <span class="t4-toolbar-separator"></span><span class="t4-badge dark">${rows.length} resultado${rows.length === 1 ? '' : 's'}</span>
    </div>
    ${activeOnly ? `<div class="t4-chip-row" style="margin-bottom:13px">${[
      ['all', 'Todos'], ['priority', 'Prioridade alta'], ['documents', 'Documentação pendente'], ['ready', 'Prontos para oportunidade']
    ].map(([id, label]) => `<button type="button" class="t4-chip ${state.quick === id ? 'active' : ''}" data-quick-filter="${id}">${U.esc(label)}</button>`).join('')}</div>` : ''}`;
  }

  function renderTalentList(activeOnly) {
    app.setPrimaryAction(activeOnly && D.canEdit() ? 'Novo Talento' : '', activeOnly && D.canEdit() ? () => openTalentForm() : null);
    app.setSearchHandler((value) => { state.query = value; renderTalentList(activeOnly); }, 'Buscar Talento…');
    const rows = filteredCandidates(activeOnly);
    const title = activeOnly ? 'Lista operacional de Talentos' : 'Histórico de Talentos arquivados';
    const copy = activeOnly ? 'Use filtros para chegar ao registro certo; clique em uma linha para abrir a ficha 360.' : 'Os dados continuam preservados e podem ser reativados com permissão de edição.';
    app.pageRoot.innerHTML = `${U.pageHead(title, copy, `<button class="t4-btn" data-action="reload">${U.icon('refresh')}Atualizar</button>`)}
      ${listToolbar(activeOnly)}
      ${rows.length ? `<div class="t4-table-wrap"><table class="t4-table"><thead><tr><th>Talento</th><th>Etapa</th><th>Profissão / área</th><th>Alemão</th><th>Cidade</th><th>Responsável</th><th>Atualização</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr data-open-talent="${U.attr(row.id)}"><td><div class="t4-inline-person"><span class="t4-avatar-sm">${U.esc(U.initials(candidateName(row)))}</span><span class="t4-inline-person-copy"><span class="t4-inline-person-name">${U.esc(candidateName(row))}</span><span class="t4-inline-person-meta">${U.esc(row.email || row.telefone || row.id)}</span></span></div></td><td>${U.badge(candidateStage(row), U.toneForStatus(candidateStage(row)))}</td><td><span class="t4-cell-primary">${U.esc(row.profissao_principal || '—')}</span><div class="t4-cell-secondary">${U.esc(row.area_profissional || '')}</div></td><td>${U.badge(row.nivel_alemao || 'Não informado', row.nivel_alemao ? 'info' : '')}</td><td>${U.esc(row.cidade_atual || '—')}</td><td>${U.esc(row.responsavel_interno || 'Sem responsável')}</td><td>${U.esc(U.formatRelative(row.ultima_atualizacao))}</td><td><div class="t4-cell-actions"><button class="t4-icon-btn" data-edit-talent="${U.attr(row.id)}" aria-label="Editar">${U.icon('edit')}</button></div></td></tr>`).join('')}</tbody></table></div>` : U.emptyState(activeOnly ? 'Nenhum Talento encontrado' : 'Nenhum registro arquivado', activeOnly ? 'Remova filtros ou cadastre um novo Talento.' : 'Os Talentos inativados aparecerão aqui.', activeOnly && D.canEdit() ? 'Novo Talento' : '', 'new-talent')}`;
  }

  function renderOpportunities() {
    app.setPrimaryAction(
      state.matchesModern && D.canEdit() ? 'Vincular oportunidade' : 'Abrir Organizacional',
      state.matchesModern && D.canEdit() ? () => openMatchForm() : () => { location.href = './organizacional.html?view=opportunities'; }
    );
    app.setSearchHandler((value) => { state.query = value; renderOpportunities(); }, 'Buscar Talento ou empregador…');
    const query = U.normalize(state.query);
    const rows = normalizedMatches().filter((row) => {
      const talent = candidateById(row.talent_id);
      const employer = employerById(row.employer_id);
      const opening = openingById(row.opening_id);
      return !query || U.normalize([candidateName(talent), employer?.nome, opening?.title, row.stage, row.viability].join(' ')).includes(query);
    });
    app.pageRoot.innerHTML = `${U.pageHead('Talento × oportunidade', 'Uma relação por vaga evita o mesmo Talento aparecer como “compatível” sem contexto do cargo.')}
      ${!state.matchesModern ? migrationAlert('A tabela de compatibilidade por vaga ainda não foi aplicada. A V2 exibe os vínculos atuais por empregador, em modo compatível.') : ''}
      <div class="t4-toolbar"><label class="t4-toolbar-search">${U.icon('search')}<input data-opportunity-search type="search" value="${U.attr(state.query)}" placeholder="Talento, empregador, vaga ou etapa…"></label><span class="t4-badge dark">${rows.length} vínculos</span></div>
      ${rows.length ? `<div class="t4-table-wrap"><table class="t4-table"><thead><tr><th>Talento</th><th>Empregador / vaga</th><th>Compatibilidade</th><th>Viabilidade</th><th>Etapa</th><th>Próxima ação</th></tr></thead><tbody>${rows.map((row) => {
        const talent = candidateById(row.talent_id);
        const employer = employerById(row.employer_id);
        const opening = openingById(row.opening_id);
        const score = U.clamp(row.overall_score || 0);
        return `<tr data-open-talent="${U.attr(row.talent_id)}"><td><span class="t4-cell-primary">${U.esc(candidateName(talent))}</span><div class="t4-cell-secondary">${U.esc(talent?.profissao_principal || '')}</div></td><td><span class="t4-cell-primary">${U.esc(employer?.nome || 'Empregador não localizado')}</span><div class="t4-cell-secondary">${U.esc(opening?.title || 'Vínculo geral')}</div></td><td><div class="t4-score"><div class="t4-score-line"><span>Fit</span><strong>${score ? `${score}%` : 'A validar'}</strong></div><div class="t4-progress"><span style="width:${score}%"></span></div></div></td><td>${U.badge(row.viability || 'A validar', U.toneForStatus(row.viability))}</td><td>${U.badge(row.stage || row.status || 'Mapeado', U.toneForStatus(row.stage || row.status))}</td><td>${U.esc(row.next_action || '—')}</td></tr>`;
      }).join('')}</tbody></table></div>` : U.emptyState('Nenhuma compatibilidade registrada', 'Oportunidades vinculadas a Talentos aparecerão aqui. Cadastre vagas no Organizacional.')}`;
  }

  function renderProcesses() {
    app.setPrimaryAction(D.canEdit() ? 'Novo Talento' : '', D.canEdit() ? () => openTalentForm() : null);
    app.setSearchHandler((value) => { state.query = value; renderProcesses(); }, 'Filtrar quadro…');
    const rows = filteredCandidates(true);
    const ordered = [...new Set([...STAGES, ...rows.map(candidateStage)])];
    app.pageRoot.innerHTML = `${U.pageHead('Fluxo dos Talentos', 'O quadro mostra a mesma base da lista. Alterar a etapa na ficha atualiza todas as visões pelo Supabase.')}
      <div class="t4-kanban">${ordered.map((stage) => {
        const cards = rows.filter((row) => candidateStage(row) === stage);
        if (!cards.length && !STAGES.includes(stage)) return '';
        return `<section class="t4-kanban-column"><div class="t4-kanban-head"><span class="t4-kanban-title">${U.esc(U.term(stage))}</span><span class="t4-kanban-count">${cards.length}</span></div><div class="t4-kanban-cards">${cards.slice(0, 50).map((row) => `<article class="t4-kanban-card" data-open-talent="${U.attr(row.id)}"><div class="t4-kanban-card-title">${U.esc(candidateName(row))}</div><div class="t4-kanban-card-meta">${U.esc(row.profissao_principal || row.area_profissional || 'Profissão pendente')}</div><div class="t4-kanban-card-foot">${row.nivel_alemao ? U.badge(row.nivel_alemao, 'info') : ''}${highPriority(row) ? U.badge('Prioridade', 'danger') : ''}</div></article>`).join('') || '<div class="t4-cell-secondary" style="padding:12px">Sem Talentos nesta etapa.</div>'}</div></section>`;
      }).join('')}</div>`;
  }

  function renderAgenda() {
    app.setPrimaryAction(D.canEdit() && state.activitiesAvailable ? 'Nova atividade' : '', D.canEdit() && state.activitiesAvailable ? () => openActivityForm() : null);
    app.setSearchHandler((value) => { state.query = value; renderAgenda(); }, 'Buscar atividade ou Talento…');
    const query = U.normalize(state.query);
    const rows = [...state.activities].filter((row) => {
      const talent = candidateById(row.talent_id);
      return !query || U.normalize([row.title, row.notes, row.owner_username, candidateName(talent)].join(' ')).includes(query);
    }).sort((a, b) => String(a.due_at || '9999').localeCompare(String(b.due_at || '9999')));
    app.pageRoot.innerHTML = `${U.pageHead('Agenda integrada', 'Atividades compartilhadas pelos quatro switches; cada item continua vinculado ao registro de origem.')}
      ${!state.activitiesAvailable ? migrationAlert('A agenda integrada faz parte da migration V2 e ainda não existe no Supabase. Nenhuma agenda antiga será apagada ou migrada automaticamente.') : ''}
      ${state.activitiesAvailable ? `<div class="t4-toolbar"><label class="t4-toolbar-search">${U.icon('search')}<input data-agenda-search type="search" value="${U.attr(state.query)}" placeholder="Atividade, Talento ou responsável…"></label><span class="t4-badge dark">${rows.filter(activityOpen).length} pendentes</span></div>
      <section class="t4-panel"><div class="t4-panel-body">${rows.length ? `<div class="t4-timeline">${rows.map((row) => {
        const talent = candidateById(row.talent_id);
        return `<div class="t4-timeline-item"><span class="t4-timeline-dot">${U.icon(activityOpen(row) ? 'clock' : 'check')}</span><div><div class="t4-timeline-title">${U.esc(row.title || 'Atividade')} ${activityOverdue(row) ? U.badge('Vencida', 'danger') : U.badge(row.status || 'Pendente', U.toneForStatus(row.status))}</div><div class="t4-timeline-meta">${U.esc(U.formatDate(row.due_at, true))} · ${U.esc(talent ? candidateName(talent) : row.owner_username || 'Sem vínculo')}</div><div class="t4-timeline-copy">${U.esc(row.notes || '')}</div></div></div>`;
      }).join('')}</div>` : U.emptyState('Nenhuma atividade', 'Crie uma atividade vinculada a um Talento para iniciar a agenda.', D.canEdit() ? 'Nova atividade' : '', 'new-activity')}</div></section>` : U.emptyState('Agenda aguardando ativação', 'Aplique a migration V2 somente na etapa de homologação autorizada.')}`;
  }

  function migrationAlert(message) {
    return `<div class="t4-alert">${U.icon('warning')}<div><strong>Modo compatível</strong>${U.esc(message)}</div></div>`;
  }

  function openTalentDrawer(id) {
    const row = candidateById(id);
    if (!row) return;
    const matches = normalizedMatches().filter((item) => String(item.talent_id) === String(id));
    const activities = state.activities.filter((item) => String(item.talent_id) === String(id)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const actions = `${D.canEdit() ? `<button class="t4-btn primary" data-drawer-edit="${U.attr(id)}">${U.icon('edit')}Editar</button>` : ''}<a class="t4-btn" href="./contatos.html?view=all&source=candidatos&id=${encodeURIComponent(id)}">${U.icon('contact')}Ver em Contatos</a>${state.activitiesAvailable && D.canEdit() ? `<button class="t4-btn" data-drawer-activity="${U.attr(id)}">${U.icon('calendar')}Nova atividade</button>` : ''}`;
    const drawer = U.openDrawer({
      title: candidateName(row),
      subtitle: `${row.id} · ${U.term(candidateStage(row))}`,
      actions,
      body: `<section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Visão essencial</h3>${U.badge(candidateStage(row), U.toneForStatus(candidateStage(row)))}</div><div class="t4-detail-grid">${U.field('Profissão', row.profissao_principal)}${U.field('Área', row.area_profissional)}${U.field('Alemão', row.nivel_alemao)}${U.field('Cidade atual', row.cidade_atual)}${U.field('Responsável', row.responsavel_interno)}${U.field('Prioridade', row.prioridade_comercial)}</div></section>
      <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Contato</h3></div><div class="t4-detail-grid">${U.field('E-mail', row.email)}${U.field('Telefone', row.telefone)}${U.field('País de origem', row.pais_de_origem)}${U.field('Disponibilidade', row.disponibilidade_mudanca)}</div></section>
      <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Resumo profissional</h3></div><div class="t4-timeline-copy">${U.esc(row.resumo_rh_curto || 'Resumo ainda não preenchido.')}</div></section>
      <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Oportunidades relacionadas</h3><span class="t4-badge">${matches.length}</span></div>${matches.length ? `<div class="t4-list">${matches.map((item) => { const emp = employerById(item.employer_id); const opening = openingById(item.opening_id); return `<div class="t4-list-item"><span class="t4-avatar-sm">${U.icon('building')}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(emp?.nome || 'Empregador')}</span><span class="t4-list-meta">${U.esc(opening?.title || item.stage || 'Vínculo geral')}</span></span>${item.overall_score ? U.badge(`${item.overall_score}%`, 'info') : ''}</div>`; }).join('')}</div>` : '<div class="t4-cell-secondary">Nenhuma oportunidade vinculada.</div>'}</section>
      <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Atividades</h3><span class="t4-badge">${activities.length}</span></div>${activities.length ? `<div class="t4-timeline">${activities.slice(0, 8).map((item) => `<div class="t4-timeline-item"><span class="t4-timeline-dot">${U.icon('activity')}</span><div><div class="t4-timeline-title">${U.esc(item.title)}</div><div class="t4-timeline-meta">${U.esc(U.formatDate(item.due_at, true))} · ${U.esc(item.status)}</div></div></div>`).join('')}</div>` : '<div class="t4-cell-secondary">Sem atividades na agenda V2.</div>'}</section>`
    });
    drawer.querySelector('[data-drawer-edit]')?.addEventListener('click', () => { U.closeDrawer(); openTalentForm(row); });
    drawer.querySelector('[data-drawer-activity]')?.addEventListener('click', () => { U.closeDrawer(); openActivityForm(row.id); });
  }

  function openTalentForm(row = null) {
    if (!D.canEdit()) return U.toast('Seu perfil possui acesso somente para leitura.', 'warning');
    const editing = !!row;
    const modal = U.openModal({
      title: editing ? 'Editar Talento' : 'Novo Talento',
      subtitle: 'Os campos essenciais alimentam lista, processos, contatos e alemão pelo Supabase.',
      wide: true,
      body: `<form id="talent-form"><div class="t4-form-section"><h3 class="t4-form-section-title">Identificação e contato</h3><div class="t4-form-grid three">
        <label class="t4-field t4-span-2"><span class="t4-field-label">Nome completo *</span><input name="nome_completo" required maxlength="180" value="${U.attr(row?.nome_completo || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Etapa *</span><select name="status_pipeline">${STAGES.map((stage) => `<option value="${U.attr(stage)}" ${candidateStage(row || {}) === stage ? 'selected' : ''}>${U.esc(U.term(stage))}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">E-mail</span><input name="email" type="email" value="${U.attr(row?.email || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Telefone</span><input name="telefone" value="${U.attr(row?.telefone || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Cidade atual</span><input name="cidade_atual" value="${U.attr(row?.cidade_atual || '')}"></label>
      </div></div><div class="t4-form-section"><h3 class="t4-form-section-title">Perfil profissional</h3><div class="t4-form-grid three">
        <label class="t4-field"><span class="t4-field-label">Profissão principal</span><input name="profissao_principal" value="${U.attr(row?.profissao_principal || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Área profissional</span><input name="area_profissional" value="${U.attr(row?.area_profissional || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Nível de alemão</span><select name="nivel_alemao"><option value="">Não informado</option>${LEVELS.map((level) => `<option ${row?.nivel_alemao === level ? 'selected' : ''}>${level}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">Responsável interno</span><input name="responsavel_interno" value="${U.attr(row?.responsavel_interno || D.profile?.nome || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Prioridade</span><select name="prioridade_comercial">${['Normal', 'Alta', 'Crítica', 'Baixa'].map((item) => `<option ${row?.prioridade_comercial === item ? 'selected' : ''}>${item}</option>`).join('')}</select></label>
        <label class="t4-field t4-span-3"><span class="t4-field-label">Resumo profissional</span><textarea name="resumo_rh_curto">${U.esc(row?.resumo_rh_curto || '')}</textarea></label>
      </div></div></form>`,
      footer: `<button class="t4-btn" data-cancel>Cancelar</button><button class="t4-btn primary" data-save>${U.icon('check')}${editing ? 'Salvar alterações' : 'Criar Talento'}</button>`
    });
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    modal.querySelector('[data-save]').addEventListener('click', async () => {
      const form = modal.querySelector('#talent-form');
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      Object.keys(data).forEach((key) => { data[key] = String(data[key]).trim() || null; });
      const duplicate = state.candidates.find((item) => item.id !== row?.id && data.email && U.normalize(item.email) === U.normalize(data.email));
      if (duplicate) return U.toast(`O e-mail já pertence a ${candidateName(duplicate)}. Revise para evitar duplicidade.`, 'warning', 5200);
      const save = modal.querySelector('[data-save]');
      save.disabled = true;
      try {
        const payload = { ...data, ultima_atualizacao: new Date().toISOString(), atualizado_por: D.profile?.nome || 'V2' };
        if (editing) await D.update(D.TABLES.candidates, row.id, payload, { select: false });
        else await D.insert(D.TABLES.candidates, { id: generateTalentId(), ativo: true, criado_em: new Date().toISOString(), ...payload }, { select: false });
        U.closeModal();
        U.toast(editing ? 'Talento atualizado no Supabase.' : 'Talento criado no Supabase.', 'success');
        await loadAll({ background: true });
      } catch (error) {
        U.toast(error.message || String(error), 'error', 6000);
        save.disabled = false;
      }
    });
  }

  function openActivityForm(talentId = '') {
    if (!state.activitiesAvailable) return U.toast('A agenda integrada ainda não foi ativada no Supabase.', 'warning');
    if (!D.canEdit()) return U.toast('Seu perfil possui acesso somente para leitura.', 'warning');
    const modal = U.openModal({
      title: 'Nova atividade',
      subtitle: 'A atividade ficará visível nos switches relacionados.',
      body: `<form id="activity-form"><div class="t4-form-grid">
        <label class="t4-field t4-span-2"><span class="t4-field-label">Título *</span><input name="title" required maxlength="180"></label>
        <label class="t4-field"><span class="t4-field-label">Talento</span><select name="talent_id"><option value="">Sem vínculo</option>${state.candidates.filter(candidateActive).map((row) => `<option value="${U.attr(row.id)}" ${String(row.id) === String(talentId) ? 'selected' : ''}>${U.esc(candidateName(row))}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">Tipo</span><select name="activity_type">${['Tarefa', 'Ligação', 'E-mail', 'Reunião', 'WhatsApp', 'Documento', 'Acompanhamento'].map((item) => `<option>${item}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">Vencimento *</span><input name="due_at" type="datetime-local" required></label>
        <label class="t4-field"><span class="t4-field-label">Prioridade</span><select name="priority">${['Normal', 'Alta', 'Crítica', 'Baixa'].map((item) => `<option>${item}</option>`).join('')}</select></label>
        <label class="t4-field t4-span-2"><span class="t4-field-label">Observações</span><textarea name="notes"></textarea></label>
      </div></form>`,
      footer: '<button class="t4-btn" data-cancel>Cancelar</button><button class="t4-btn primary" data-save>Criar atividade</button>'
    });
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    modal.querySelector('[data-save]').addEventListener('click', async () => {
      const form = modal.querySelector('#activity-form');
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      Object.keys(data).forEach((key) => { data[key] = String(data[key]).trim() || null; });
      const button = modal.querySelector('[data-save]'); button.disabled = true;
      try {
        await D.insert(D.TABLES.activities, { ...data, status: 'Pendente', owner_username: D.profile?.username || null }, { select: false });
        U.closeModal(); U.toast('Atividade criada na agenda integrada.', 'success'); await loadAll({ background: true });
      } catch (error) { U.toast(error.message || String(error), 'error', 6000); button.disabled = false; }
    });
  }

  function openMatchForm(initialOpeningId = '', initialTalentId = '') {
    if (!state.matchesModern) return U.toast('A compatibilidade por oportunidade ainda não foi ativada no Supabase.', 'warning');
    if (!D.canEdit()) return U.toast('Seu perfil possui acesso somente para leitura.', 'warning');
    const activeTalents = state.candidates.filter(candidateActive);
    const activeOpenings = state.openings.filter((row) => row.is_active !== false && !row.deleted_at && !/fechada|cancelada/i.test(row.status || ''));
    const modal = U.openModal({
      title: 'Vincular Talento à oportunidade',
      subtitle: 'O vínculo será o mesmo no switch Talentos e no Organizacional.',
      wide: true,
      body: `<form id="match-form"><div class="t4-form-grid three">
        <label class="t4-field t4-span-2"><span class="t4-field-label">Talento *</span><select name="talent_id" required><option value="">Selecione</option>${activeTalents.map((row) => `<option value="${U.attr(row.id)}" ${String(row.id) === String(initialTalentId) ? 'selected' : ''}>${U.esc(candidateName(row))}</option>`).join('')}</select></label>
        <label class="t4-field t4-span-3"><span class="t4-field-label">Oportunidade *</span><select name="opening_id" required><option value="">Selecione</option>${activeOpenings.map((row) => `<option value="${U.attr(row.id)}" ${String(row.id) === String(initialOpeningId) ? 'selected' : ''}>${U.esc(employerById(row.employer_id)?.nome || 'Empregador')} · ${U.esc(row.title || 'Vaga')}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">Etapa</span><select name="stage">${['Mapeado','Em análise','Apresentado','Entrevista','Proposta','Contratado','Encerrado'].map((item) => `<option>${item}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">Viabilidade</span><select name="viability">${['A validar','Baixa','Média','Alta'].map((item) => `<option>${item}</option>`).join('')}</select></label>
        <label class="t4-field"><span class="t4-field-label">Compatibilidade geral (%)</span><input name="overall_score" type="number" min="0" max="100" step="1"></label>
        <label class="t4-field t4-span-3"><span class="t4-field-label">Motivos do encaixe</span><textarea name="reasons"></textarea></label>
        <label class="t4-field t4-span-3"><span class="t4-field-label">Barreiras / ressalvas</span><textarea name="barriers"></textarea></label>
        <label class="t4-field t4-span-2"><span class="t4-field-label">Próxima ação</span><input name="next_action"></label>
        <label class="t4-field"><span class="t4-field-label">Prazo</span><input name="next_action_at" type="datetime-local"></label>
      </div></form>`,
      footer: '<button class="t4-btn" data-cancel>Cancelar</button><button class="t4-btn primary" data-save>Criar vínculo</button>'
    });
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    modal.querySelector('[data-save]').addEventListener('click', async () => {
      const form = modal.querySelector('#match-form');
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      if (state.matches.some((row) => String(row.talent_id) === String(data.talent_id) && String(row.opening_id) === String(data.opening_id))) return U.toast('Este Talento já está vinculado à oportunidade.', 'warning');
      Object.keys(data).forEach((key) => { data[key] = String(data[key]).trim() || null; });
      if (data.overall_score != null) data.overall_score = Number(data.overall_score);
      const button = modal.querySelector('[data-save]'); button.disabled = true;
      try {
        await D.insert(D.TABLES.matches, { ...data, status: 'Ativo', priority: 100, owner_username: D.profile?.username || null }, { select: false });
        U.closeModal(); U.toast('Talento vinculado à oportunidade.', 'success'); await loadAll({ background: true });
      } catch (error) { U.toast(error.message || String(error), 'error', 6000); button.disabled = false; }
    });
  }

  app.onRoute(() => render());
  const refreshTypedList = U.debounce(() => {
    if (app.view === 'talents' || app.view === 'archived') renderTalentList(app.view === 'talents');
    else render();
    requestAnimationFrame(() => {
      const input = app.pageRoot.querySelector('[data-list-search], [data-opportunity-search], [data-agenda-search]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }, 170);
  app.pageRoot.addEventListener('input', (event) => {
    if (event.target.matches('[data-list-search], [data-opportunity-search], [data-agenda-search]')) {
      state.query = event.target.value;
      refreshTypedList();
    }
  });
  app.pageRoot.addEventListener('change', (event) => {
    if (event.target.matches('[data-filter-stage]')) { state.stage = event.target.value; renderTalentList(app.view === 'talents'); }
    if (event.target.matches('[data-filter-german]')) { state.german = event.target.value; renderTalentList(app.view === 'talents'); }
  });
  app.pageRoot.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-talent]');
    if (edit) { event.stopPropagation(); return openTalentForm(candidateById(edit.dataset.editTalent)); }
    const talent = event.target.closest('[data-open-talent]');
    if (talent) return openTalentDrawer(talent.dataset.openTalent);
    const quick = event.target.closest('[data-quick-filter]');
    if (quick) { state.quick = quick.dataset.quickFilter; return renderTalentList(true); }
    const stage = event.target.closest('[data-stage]');
    if (stage) { state.stage = stage.dataset.stage; return app.route('talents'); }
    const go = event.target.closest('[data-go]');
    if (go) { if (go.dataset.quick) state.quick = go.dataset.quick; return app.route(go.dataset.go); }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'reload') return loadAll();
    if (action === 'new-talent') return openTalentForm();
    if (action === 'new-activity') return openActivityForm();
  });

  async function bootstrap() {
    try {
      await D.init(app);
      await loadAll();
      const query = new URLSearchParams(location.search);
      const focusId = query.get('focus');
      if (focusId) openTalentDrawer(focusId);
      if (query.get('action') === 'link' && query.get('opening')) openMatchForm(query.get('opening'), query.get('talent') || '');
      D.subscribe([D.TABLES.candidates, D.TABLES.employers, D.TABLES.openings, D.TABLES.matches, D.TABLES.legacyMatches, D.TABLES.activities], U.debounce(() => loadAll({ background: true }), 650), { name: 'talents' });
    } catch (error) {
      app.setSync('error', 'Sessão indisponível');
      app.pageRoot.innerHTML = errorPanel(error);
    }
  }

  bootstrap();
})();
