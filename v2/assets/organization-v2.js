(function () {
  'use strict';
  const U = window.T4V2;
  const D = window.T4Data;
  const VIEWS = [
    { id: 'overview', label: 'Visão de trabalho', title: 'Visão organizacional', subtitle: 'Empregadores, vagas, processos e pendências em uma única leitura.', icon: 'dashboard' },
    { id: 'employers', label: 'Empregadores', title: 'Empregadores', subtitle: 'Carteira organizada e visão 360 de cada relacionamento.', icon: 'building' },
    { id: 'opportunities', label: 'Oportunidades', title: 'Oportunidades', subtitle: 'Vagas ativas e perfis vinculados.', icon: 'briefcase' },
    { id: 'pipeline', label: 'Pipeline', title: 'Pipeline por empregador', subtitle: 'Talentos associados e estágio de cada processo.', icon: 'columns' },
    { id: 'planning', label: 'Planejamento', title: 'Planejamento integrado', subtitle: 'Atividades e reuniões ligadas aos empregadores.', icon: 'calendar' }
  ];
  const app = U.mount({ module: 'organization', moduleLabel: 'Organizacional', defaultView: 'overview', views: VIEWS, searchPlaceholder: 'Buscar empregador ou vaga…' });
  const state = { employers: [], openings: [], candidates: [], matches: [], activities: [], matchesModern: false, activitiesAvailable: false, openingExtended: false, openingExtendedChecked: false, query: '', status: '', loading: true };

  const employerById = (id) => state.employers.find((row) => String(row.id) === String(id));
  const candidateById = (id) => state.candidates.find((row) => String(row.id) === String(id));
  const openingById = (id) => state.openings.find((row) => String(row.id) === String(id));
  const openingsFor = (id) => state.openings.filter((row) => String(row.employer_id) === String(id) && row.is_active !== false && !row.deleted_at);
  const matchesFor = (id) => state.matches.map((row) => D.mapMatch(row)).filter((row) => String(row.employer_id) === String(id));
  const isOpen = (row) => !/fechada|cancelada|encerrada/i.test(row?.status || '') && row?.is_active !== false && !row?.deleted_at;
  const activityOpen = (row) => !['Concluída', 'Cancelada'].includes(row?.status);
  const activityOverdue = (row) => activityOpen(row) && row?.due_at && new Date(row.due_at).getTime() < Date.now();
  const slug = (value) => U.normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function loadAll(options = {}) {
    app.setSync('loading', options.background ? 'Atualizando' : 'Carregando dados');
    try {
      const [employers, openings, candidates, matches, activities] = await Promise.all([
        D.loadEmployers({ activeOnly: false }), D.loadOpenings(), D.loadCandidates({ activeOnly: false }), D.loadMatches(), D.loadActivities({ openOnly: false })
      ]);
      state.employers = employers;
      state.openings = openings;
      state.candidates = candidates;
      state.matches = matches.rows;
      state.matchesModern = matches.modern;
      state.activities = activities.data;
      state.activitiesAvailable = activities.available;
      if (!state.openingExtendedChecked) {
        state.openingExtended = openings.some((row) => Object.prototype.hasOwnProperty.call(row, 'location'));
        if (!openings.length) {
          const probe = await D.withTimeout(D.client.from(D.TABLES.openings).select('location').limit(1), 5_000, 'Verificação dos campos V2');
          state.openingExtended = !probe.error;
        }
        state.openingExtendedChecked = true;
      }
      state.loading = false;
      updateCounts(); render(); app.setSync('ok', 'Supabase sincronizado');
    } catch (error) {
      state.loading = false; app.setSync('error', 'Falha ao carregar'); app.pageRoot.innerHTML = errorPanel(error);
    }
  }

  function errorPanel(error) {
    return `${U.pageHead('Não foi possível carregar o Organizacional', 'Nenhum registro foi alterado.')}
      <div class="t4-alert error">${U.icon('warning')}<div><strong>Erro de leitura do Supabase</strong>${U.esc(error?.message || error)}</div></div><button class="t4-btn primary" data-action="reload">${U.icon('refresh')}Tentar novamente</button>`;
  }

  function activeEmployers() { return state.employers.filter((row) => D.activeValue(row.ativo) && !row.deleted_at && !/^inativo$/i.test(row.status || '')); }
  function filteredEmployers() {
    const q = U.normalize(state.query);
    return activeEmployers().filter((row) => (!state.status || row.status === state.status) && (!q || U.normalize([row.nome, row.area_atuacao, row.cidade, row.contato_principal, row.responsavel_interno].join(' ')).includes(q)));
  }
  function updateCounts() {
    app.setCounts({ employers: activeEmployers().length, opportunities: state.openings.filter(isOpen).length, pipeline: state.matches.length, planning: state.activities.filter((row) => row.employer_id && activityOpen(row)).length });
  }

  function render() {
    if (state.loading) return;
    ({ overview: renderOverview, employers: renderEmployers, opportunities: renderOpportunities, pipeline: renderPipeline, planning: renderPlanning }[app.view] || renderOverview)();
  }

  function migrationAlert(message) { return `<div class="t4-alert">${U.icon('warning')}<div><strong>Modo compatível</strong>${U.esc(message)}</div></div>`; }

  function renderOverview() {
    app.setPrimaryAction(D.canEdit() ? 'Novo empregador' : '', D.canEdit() ? () => openEmployerForm() : null);
    app.setSearchHandler((value) => { state.query = value; if (value) app.route('employers'); }, 'Buscar empregador…');
    const employers = activeEmployers();
    const openings = state.openings.filter(isOpen);
    const withoutContact = employers.filter((row) => !row.data_ultimo_contato || Date.now() - new Date(row.data_ultimo_contato).getTime() > 30 * 86_400_000);
    const overdue = state.activities.filter((row) => row.employer_id && activityOverdue(row));
    const priority = [...employers].sort((a, b) => openingsFor(b.id).length - openingsFor(a.id).length).slice(0, 7);
    const actions = [...state.activities].filter((row) => row.employer_id && activityOpen(row)).sort((a, b) => String(a.due_at || '9999').localeCompare(String(b.due_at || '9999'))).slice(0, 7);
    app.pageRoot.innerHTML = `${U.pageHead('Hoje no Organizacional', 'Foco em carteira, vagas abertas e relações que exigem ação.')}
      <section class="t4-kpi-grid">${U.kpi('Empregadores ativos', employers.length, 'Carteira atual')}${U.kpi('Oportunidades abertas', openings.length, `${new Set(openings.map((row) => row.employer_id)).size} empregadores`,'good')}${U.kpi('Sem contato recente', withoutContact.length, 'Mais de 30 dias ou sem data', withoutContact.length ? 'warn' : 'good')}${U.kpi('Atividades vencidas', overdue.length, state.activitiesAvailable ? 'Agenda integrada' : 'Migration V2 pendente', overdue.length ? 'risk' : 'good')}</section>
      ${!state.activitiesAvailable ? migrationAlert('O planejamento central será ativado pela migration V2; o planejamento legado continua intacto e não é duplicado aqui.') : ''}
      <div class="t4-grid two-wide"><section class="t4-panel"><div class="t4-panel-head"><div class="t4-panel-head-copy"><div class="t4-panel-title">Carteira com oportunidades</div><div class="t4-panel-subtitle">Empregadores ordenados por vagas ativas</div></div><button class="t4-btn sm" data-go="employers">Ver carteira</button></div><div class="t4-panel-body">${priority.length ? `<div class="t4-list">${priority.map(employerListItem).join('')}</div>` : U.emptyState('Carteira vazia', 'Cadastre um empregador para iniciar a organização.')}</div></section>
      <section class="t4-panel"><div class="t4-panel-head"><div class="t4-panel-head-copy"><div class="t4-panel-title">Próximas ações</div><div class="t4-panel-subtitle">Agenda ligada aos empregadores</div></div><button class="t4-btn sm" data-go="planning">Planejamento</button></div><div class="t4-panel-body">${actions.length ? `<div class="t4-list">${actions.map(activityItem).join('')}</div>` : U.emptyState('Sem ações pendentes', state.activitiesAvailable ? 'A agenda não possui ações de empregadores.' : 'A agenda central ainda não foi ativada.')}</div></section></div>`;
  }

  function employerListItem(row) {
    const count = openingsFor(row.id).filter(isOpen).length;
    return `<button type="button" class="t4-list-item" data-open-employer="${U.attr(row.id)}" style="width:100%;border:0;background:transparent;text-align:left;cursor:pointer"><span class="t4-avatar-sm">${U.esc(U.initials(row.nome))}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(row.nome || 'Sem nome')}</span><span class="t4-list-meta">${U.esc([row.area_atuacao, row.cidade, row.responsavel_interno].filter(Boolean).join(' · ') || 'Informações pendentes')}</span></span>${U.badge(`${count} vaga${count === 1 ? '' : 's'}`, count ? 'success' : '')}</button>`;
  }
  function activityItem(row) {
    const employer = employerById(row.employer_id);
    return `<div class="t4-list-item"><span class="t4-timeline-dot">${U.icon('calendar')}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(row.title || 'Atividade')}</span><span class="t4-list-meta">${U.esc(employer?.nome || 'Sem empregador')} · ${U.esc(U.formatRelative(row.due_at))}</span></span>${U.badge(activityOverdue(row) ? 'Vencida' : row.priority || 'Normal', activityOverdue(row) ? 'danger' : U.toneForStatus(row.priority))}</div>`;
  }

  function renderEmployers() {
    app.setPrimaryAction(D.canEdit() ? 'Novo empregador' : '', D.canEdit() ? () => openEmployerForm() : null);
    app.setSearchHandler((value) => { state.query = value; renderEmployers(); }, 'Buscar empregador…');
    const rows = filteredEmployers();
    const statuses = [...new Set(activeEmployers().map((row) => row.status).filter(Boolean))].sort();
    app.pageRoot.innerHTML = `${U.pageHead('Carteira de empregadores', 'Clique em uma linha para ver vagas, Talentos vinculados, contato e atividades.')}
      <div class="t4-toolbar"><label class="t4-toolbar-search">${U.icon('search')}<input data-list-search type="search" value="${U.attr(state.query)}" placeholder="Nome, área, cidade ou contato…"></label><select data-status><option value="">Todos os status</option>${statuses.map((item) => `<option ${state.status === item ? 'selected' : ''}>${U.esc(item)}</option>`).join('')}</select><span class="t4-badge dark">${rows.length} empregadores</span></div>
      ${rows.length ? `<div class="t4-table-wrap"><table class="t4-table"><thead><tr><th>Empregador</th><th>Status</th><th>Área</th><th>Oportunidades</th><th>Contato</th><th>Responsável</th><th>Último contato</th><th></th></tr></thead><tbody>${rows.map((row) => { const opens = openingsFor(row.id).filter(isOpen).length; return `<tr data-open-employer="${U.attr(row.id)}"><td><div class="t4-inline-person"><span class="t4-avatar-sm">${U.esc(U.initials(row.nome))}</span><span class="t4-inline-person-copy"><span class="t4-inline-person-name">${U.esc(row.nome)}</span><span class="t4-inline-person-meta">${U.esc(row.cidade || row.pais || row.id)}</span></span></div></td><td>${U.badge(row.status || 'Ativo', U.toneForStatus(row.status || 'Ativo'))}</td><td>${U.esc(row.area_atuacao || '—')}</td><td>${U.badge(`${opens} aberta${opens === 1 ? '' : 's'}`, opens ? 'success' : '')}</td><td><span class="t4-cell-primary">${U.esc(row.contato_principal || '—')}</span><div class="t4-cell-secondary">${U.esc(row.email_principal || '')}</div></td><td>${U.esc(row.responsavel_interno || '—')}</td><td>${U.esc(U.formatRelative(row.data_ultimo_contato))}</td><td><button class="t4-icon-btn" data-edit-employer="${U.attr(row.id)}" aria-label="Editar">${U.icon('edit')}</button></td></tr>`; }).join('')}</tbody></table></div>` : U.emptyState('Nenhum empregador encontrado', 'Remova filtros ou cadastre um novo empregador.', D.canEdit() ? 'Novo empregador' : '', 'new-employer')}`;
  }

  function renderOpportunities() {
    app.setPrimaryAction(D.canEdit() ? 'Nova oportunidade' : '', D.canEdit() ? () => openOpeningForm() : null);
    app.setSearchHandler((value) => { state.query = value; renderOpportunities(); }, 'Buscar vaga ou empregador…');
    const q = U.normalize(state.query);
    const rows = state.openings.filter((row) => !row.deleted_at && (!q || U.normalize([row.title, employerById(row.employer_id)?.nome, row.status, row.area, row.location].join(' ')).includes(q)));
    app.pageRoot.innerHTML = `${U.pageHead('Oportunidades por empregador', 'Vagas são o contexto correto para medir compatibilidade com Talentos.')}
      <div class="t4-toolbar"><label class="t4-toolbar-search">${U.icon('search')}<input data-opening-search type="search" value="${U.attr(state.query)}" placeholder="Vaga, empregador, área ou local…"></label><span class="t4-badge dark">${rows.filter(isOpen).length} abertas</span></div>
      ${rows.length ? `<div class="t4-table-wrap"><table class="t4-table"><thead><tr><th>Oportunidade</th><th>Empregador</th><th>Status</th><th>Quantidade</th><th>Local / área</th><th>Talentos vinculados</th><th></th></tr></thead><tbody>${rows.map((row) => { const employer = employerById(row.employer_id); const linked = state.matches.map((item) => D.mapMatch(item)).filter((item) => state.matchesModern ? String(item.opening_id) === String(row.id) : String(item.employer_id) === String(row.employer_id)).length; return `<tr><td><span class="t4-cell-primary">${U.esc(row.title || 'Vaga')}</span><div class="t4-cell-secondary">${U.esc(row.description || '')}</div></td><td><button class="t4-btn ghost sm" data-open-employer="${U.attr(row.employer_id)}">${U.esc(employer?.nome || 'Não localizado')}</button></td><td>${U.badge(row.status || 'Aberta', U.toneForStatus(row.status || 'Aberta'))}</td><td>${U.esc(row.quantity || 1)}</td><td><span class="t4-cell-primary">${U.esc(row.location || employer?.cidade || '—')}</span><div class="t4-cell-secondary">${U.esc(row.area || employer?.area_atuacao || '')}</div></td><td>${U.badge(`${linked} Talento${linked === 1 ? '' : 's'}`, linked ? 'info' : '')}</td><td><div class="t4-cell-actions">${state.matchesModern && D.canEdit() ? `<a class="t4-icon-btn" href="./index.html?view=opportunities&action=link&opening=${encodeURIComponent(row.id)}" title="Vincular Talento">${U.icon('link')}</a>` : ''}${D.canEdit() ? `<button class="t4-icon-btn" data-edit-opening="${U.attr(row.id)}">${U.icon('edit')}</button>` : ''}</div></td></tr>`; }).join('')}</tbody></table></div>` : U.emptyState('Nenhuma oportunidade', 'Cadastre uma vaga e vincule Talentos no fluxo de compatibilidade.', D.canEdit() ? 'Nova oportunidade' : '', 'new-opening')}`;
  }

  function renderPipeline() {
    app.setPrimaryAction('', null);
    app.setSearchHandler((value) => { state.query = value; renderPipeline(); }, 'Filtrar pipeline…');
    const q = U.normalize(state.query);
    const matches = state.matches.map((row) => D.mapMatch(row)).filter((row) => !q || U.normalize([candidateById(row.talent_id)?.nome_completo, employerById(row.employer_id)?.nome, openingById(row.opening_id)?.title, row.stage].join(' ')).includes(q));
    const stages = [...new Set(['Mapeado', 'Em análise', 'Apresentado', 'Entrevista', 'Proposta', 'Contratado', ...matches.map((row) => row.stage || row.status).filter(Boolean)])];
    app.pageRoot.innerHTML = `${U.pageHead('Pipeline dos empregadores', 'O quadro usa os mesmos vínculos da visão de Talentos; não existe uma segunda cópia.')}${!state.matchesModern ? migrationAlert('O pipeline está em modo compatível por empregador. A migration V2 adiciona o vínculo explícito com cada vaga.') : ''}
      <div class="t4-kanban">${stages.map((stage) => { const cards = matches.filter((row) => (row.stage || row.status || 'Mapeado') === stage); return `<section class="t4-kanban-column"><div class="t4-kanban-head"><span class="t4-kanban-title">${U.esc(U.term(stage))}</span><span class="t4-kanban-count">${cards.length}</span></div><div class="t4-kanban-cards">${cards.map((row) => { const talent = candidateById(row.talent_id); const employer = employerById(row.employer_id); const opening = openingById(row.opening_id); return `<article class="t4-kanban-card" data-open-employer="${U.attr(row.employer_id)}"><div class="t4-kanban-card-title">${U.esc(talent?.nome_completo || 'Talento não localizado')}</div><div class="t4-kanban-card-meta">${U.esc(employer?.nome || 'Empregador')} · ${U.esc(opening?.title || 'Vínculo geral')}</div><div class="t4-kanban-card-foot">${row.overall_score ? U.badge(`${row.overall_score}%`, 'info') : ''}${row.viability ? U.badge(row.viability, U.toneForStatus(row.viability)) : ''}</div></article>`; }).join('') || '<div class="t4-cell-secondary" style="padding:12px">Sem processos nesta etapa.</div>'}</div></section>`; }).join('')}</div>`;
  }

  function renderPlanning() {
    app.setPrimaryAction(D.canEdit() && state.activitiesAvailable ? 'Nova atividade' : '', D.canEdit() && state.activitiesAvailable ? () => openActivityForm() : null);
    app.setSearchHandler((value) => { state.query = value; renderPlanning(); }, 'Buscar atividade ou empregador…');
    const q = U.normalize(state.query);
    const rows = state.activities.filter((row) => row.employer_id && (!q || U.normalize([row.title, row.notes, employerById(row.employer_id)?.nome, row.owner_username].join(' ')).includes(q))).sort((a, b) => String(a.due_at || '9999').localeCompare(String(b.due_at || '9999')));
    app.pageRoot.innerHTML = `${U.pageHead('Planejamento operacional', 'Uma agenda compartilhada substitui planejamentos paralelos, sem apagar o legado nesta fase.')}${!state.activitiesAvailable ? migrationAlert('A tabela crm_activities ainda não está disponível. O planejamento antigo permanece somente na versão atual; a V2 não o copia nem o altera.') : ''}
      ${state.activitiesAvailable ? `<section class="t4-panel"><div class="t4-panel-body">${rows.length ? `<div class="t4-timeline">${rows.map((row) => { const emp = employerById(row.employer_id); return `<div class="t4-timeline-item"><span class="t4-timeline-dot">${U.icon(activityOpen(row) ? 'clock' : 'check')}</span><div><div class="t4-timeline-title">${U.esc(row.title)} ${activityOverdue(row) ? U.badge('Vencida','danger') : U.badge(row.status || 'Pendente', U.toneForStatus(row.status))}</div><div class="t4-timeline-meta">${U.esc(U.formatDate(row.due_at, true))} · ${U.esc(emp?.nome || 'Empregador')}</div><div class="t4-timeline-copy">${U.esc(row.notes || '')}</div></div></div>`; }).join('')}</div>` : U.emptyState('Nenhuma atividade planejada', 'Crie a primeira atividade ligada a um empregador.', D.canEdit() ? 'Nova atividade' : '', 'new-activity')}</div></section>` : U.emptyState('Planejamento aguardando ativação', 'A migration V2 será aplicada somente depois da homologação autorizada.')}`;
  }

  function openEmployerDrawer(id) {
    const row = employerById(id); if (!row) return;
    const openings = openingsFor(id); const matches = matchesFor(id); const activities = state.activities.filter((item) => String(item.employer_id) === String(id));
    const drawer = U.openDrawer({ title: row.nome, subtitle: `${row.status || 'Ativo'} · ${row.area_atuacao || 'Área não informada'}`, actions: `${D.canEdit() ? `<button class="t4-btn primary" data-edit="${U.attr(id)}">${U.icon('edit')}Editar</button>` : ''}<a class="t4-btn" href="./contatos.html?view=organizations&source=employers&id=${encodeURIComponent(id)}">${U.icon('contact')}Ver em Contatos</a>${D.canEdit() ? `<button class="t4-btn" data-opening="${U.attr(id)}">${U.icon('plus')}Nova vaga</button>` : ''}`, body:
      `<section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Visão essencial</h3>${U.badge(row.status || 'Ativo', U.toneForStatus(row.status || 'Ativo'))}</div><div class="t4-detail-grid">${U.field('Área de atuação', row.area_atuacao)}${U.field('Cidade', row.cidade)}${U.field('Responsável', row.responsavel_interno)}${U.field('Prioridade', row.prioridade_comercial)}${U.field('Contato principal', row.contato_principal)}${U.field('E-mail', row.email_principal)}</div></section>
       <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Contexto</h3></div><div class="t4-timeline-copy">${U.esc(row.descricao_resumida || 'Descrição ainda não preenchida.')}</div></section>
       <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Oportunidades</h3><span class="t4-badge">${openings.length}</span></div>${openings.length ? `<div class="t4-list">${openings.map((item) => `<div class="t4-list-item"><span class="t4-avatar-sm">${U.icon('briefcase')}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(item.title)}</span><span class="t4-list-meta">${U.esc(item.location || item.area || '')}</span></span>${U.badge(item.status || 'Aberta', U.toneForStatus(item.status || 'Aberta'))}</div>`).join('')}</div>` : '<div class="t4-cell-secondary">Nenhuma vaga cadastrada.</div>'}</section>
       <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Talentos vinculados</h3><span class="t4-badge">${matches.length}</span></div>${matches.length ? `<div class="t4-list">${matches.slice(0,10).map((item) => { const talent = candidateById(item.talent_id); return `<div class="t4-list-item"><span class="t4-avatar-sm">${U.esc(U.initials(talent?.nome_completo))}</span><span class="t4-list-main"><span class="t4-list-title">${U.esc(talent?.nome_completo || 'Talento')}</span><span class="t4-list-meta">${U.esc(talent?.profissao_principal || item.stage || '')}</span></span>${item.overall_score ? U.badge(`${item.overall_score}%`,'info') : ''}</div>`; }).join('')}</div>` : '<div class="t4-cell-secondary">Nenhum Talento vinculado.</div>'}</section>
       <section class="t4-detail-section"><div class="t4-detail-section-head"><h3>Atividades</h3><span class="t4-badge">${activities.length}</span></div>${activities.length ? `<div class="t4-list">${activities.slice(0,8).map(activityItem).join('')}</div>` : '<div class="t4-cell-secondary">Sem atividades na agenda V2.</div>'}</section>` });
    drawer.querySelector('[data-edit]')?.addEventListener('click', () => { U.closeDrawer(); openEmployerForm(row); });
    drawer.querySelector('[data-opening]')?.addEventListener('click', () => { U.closeDrawer(); openOpeningForm(null, row.id); });
  }

  function openEmployerForm(row = null) {
    if (!D.canEdit()) return U.toast('Seu perfil possui acesso somente para leitura.', 'warning');
    const modal = U.openModal({ title: row ? 'Editar empregador' : 'Novo empregador', subtitle: 'Dados centrais usados pelos quatro switches.', wide: true, body: `<form id="employer-form"><div class="t4-form-grid three">
      <label class="t4-field t4-span-2"><span class="t4-field-label">Nome do empregador *</span><input name="nome" required value="${U.attr(row?.nome || '')}"></label><label class="t4-field"><span class="t4-field-label">Status</span><select name="status">${['Ativo','Prospecção','Em negociação','Pausado','Inativo'].map((item) => `<option ${U.normalize(row?.status) === U.normalize(item) ? 'selected' : ''}>${item}</option>`).join('')}</select></label>
      <label class="t4-field"><span class="t4-field-label">Área de atuação</span><input name="area_atuacao" value="${U.attr(row?.area_atuacao || '')}"></label><label class="t4-field"><span class="t4-field-label">Cidade</span><input name="cidade" value="${U.attr(row?.cidade || '')}"></label><label class="t4-field"><span class="t4-field-label">Responsável interno</span><input name="responsavel_interno" value="${U.attr(row?.responsavel_interno || D.profile?.nome || '')}"></label>
      <label class="t4-field"><span class="t4-field-label">Contato principal</span><input name="contato_principal" value="${U.attr(row?.contato_principal || '')}"></label><label class="t4-field"><span class="t4-field-label">E-mail principal</span><input name="email_principal" type="email" value="${U.attr(row?.email_principal || '')}"></label><label class="t4-field"><span class="t4-field-label">Telefone</span><input name="telefone" value="${U.attr(row?.telefone || '')}"></label>
      <label class="t4-field"><span class="t4-field-label">Site</span><input name="site" type="url" value="${U.attr(row?.site || '')}"></label><label class="t4-field"><span class="t4-field-label">Prioridade comercial</span><select name="prioridade_comercial">${['Normal','Alta','Crítica','Baixa'].map((item) => `<option ${row?.prioridade_comercial === item ? 'selected' : ''}>${item}</option>`).join('')}</select></label><label class="t4-field t4-span-3"><span class="t4-field-label">Descrição resumida</span><textarea name="descricao_resumida">${U.esc(row?.descricao_resumida || '')}</textarea></label>
    </div></form>`, footer: `<button class="t4-btn" data-cancel>Cancelar</button><button class="t4-btn primary" data-save>${row ? 'Salvar alterações' : 'Criar empregador'}</button>` });
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    modal.querySelector('[data-save]').addEventListener('click', async () => { const form = modal.querySelector('#employer-form'); if (!form.reportValidity()) return; const payload = Object.fromEntries(new FormData(form)); Object.keys(payload).forEach((key) => payload[key] = String(payload[key]).trim() || null); payload.nome_normalizado = slug(payload.nome); payload.updated_at = new Date().toISOString(); const duplicate = state.employers.find((item) => item.id !== row?.id && slug(item.nome) === payload.nome_normalizado); if (duplicate) return U.toast(`Já existe o empregador ${duplicate.nome}.`, 'warning'); const button = modal.querySelector('[data-save]'); button.disabled = true; try { if (row) await D.update(D.TABLES.employers, row.id, payload, { select:false }); else await D.insert(D.TABLES.employers, { id:D.uuid(), ativo:true, tipo:'empregador', ...payload }, { select:false }); U.closeModal(); U.toast('Empregador salvo no Supabase.','success'); await loadAll({background:true}); } catch(error) { U.toast(error.message || String(error),'error',6000); button.disabled=false; } });
  }

  function openOpeningForm(row = null, employerId = '') {
    if (!D.canEdit()) return U.toast('Seu perfil possui acesso somente para leitura.', 'warning');
    const modal = U.openModal({ title: row ? 'Editar oportunidade' : 'Nova oportunidade', subtitle: 'A vaga será reutilizada no vínculo com Talentos.', body: `<form id="opening-form"><div class="t4-form-grid">
      <label class="t4-field t4-span-2"><span class="t4-field-label">Título da vaga *</span><input name="title" required value="${U.attr(row?.title || '')}"></label><label class="t4-field t4-span-2"><span class="t4-field-label">Empregador *</span><select name="employer_id" required><option value="">Selecione</option>${activeEmployers().map((item) => `<option value="${U.attr(item.id)}" ${String(item.id) === String(row?.employer_id || employerId) ? 'selected':''}>${U.esc(item.nome)}</option>`).join('')}</select></label>
      <label class="t4-field"><span class="t4-field-label">Status</span><select name="status">${['Aberta','Em busca','Pausada','Fechada'].map((item) => `<option ${row?.status === item ? 'selected':''}>${item}</option>`).join('')}</select></label><label class="t4-field"><span class="t4-field-label">Quantidade</span><input name="quantity" type="number" min="1" value="${U.attr(row?.quantity || 1)}"></label>
      ${state.openingExtended ? `<label class="t4-field"><span class="t4-field-label">Local</span><input name="location" value="${U.attr(row?.location || '')}"></label><label class="t4-field"><span class="t4-field-label">Área</span><input name="area" value="${U.attr(row?.area || '')}"></label><label class="t4-field"><span class="t4-field-label">Alemão exigido</span><input name="language_requirement" value="${U.attr(row?.language_requirement || '')}"></label><label class="t4-field"><span class="t4-field-label">Reconhecimento exigido</span><input name="recognition_requirement" value="${U.attr(row?.recognition_requirement || '')}"></label><label class="t4-field t4-span-2"><span class="t4-field-label">Descrição</span><textarea name="description">${U.esc(row?.description || '')}</textarea></label>`:''}
    </div></form>`, footer:`<button class="t4-btn" data-cancel>Cancelar</button><button class="t4-btn primary" data-save>${row ? 'Salvar alterações':'Criar oportunidade'}</button>` });
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    modal.querySelector('[data-save]').addEventListener('click', async () => { const form=modal.querySelector('#opening-form'); if(!form.reportValidity())return; const payload=Object.fromEntries(new FormData(form)); Object.keys(payload).forEach((key)=>payload[key]=String(payload[key]).trim()||null); payload.quantity=Number(payload.quantity)||1; payload.is_active=payload.status!=='Fechada'; const button=modal.querySelector('[data-save]');button.disabled=true;try{if(row)await D.update(D.TABLES.openings,row.id,payload,{select:false});else await D.insert(D.TABLES.openings,{id:D.uuid(),order_index:openingsFor(payload.employer_id).length,deleted_at:null,...payload},{select:false});U.closeModal();U.toast('Oportunidade salva no Supabase.','success');await loadAll({background:true});}catch(error){U.toast(error.message||String(error),'error',6000);button.disabled=false;} });
  }

  function openActivityForm(employerId='') {
    if (!state.activitiesAvailable) return U.toast('O planejamento V2 ainda não foi ativado.', 'warning');
    const modal=U.openModal({title:'Nova atividade do empregador',subtitle:'Visível também na agenda integrada de Talentos e Contatos.',body:`<form id="activity-form"><div class="t4-form-grid"><label class="t4-field t4-span-2"><span class="t4-field-label">Título *</span><input name="title" required></label><label class="t4-field t4-span-2"><span class="t4-field-label">Empregador *</span><select name="employer_id" required><option value="">Selecione</option>${activeEmployers().map((row)=>`<option value="${U.attr(row.id)}" ${String(row.id)===String(employerId)?'selected':''}>${U.esc(row.nome)}</option>`).join('')}</select></label><label class="t4-field"><span class="t4-field-label">Tipo</span><select name="activity_type">${['Tarefa','Ligação','E-mail','Reunião','Follow-up'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="t4-field"><span class="t4-field-label">Vencimento *</span><input name="due_at" type="datetime-local" required></label><label class="t4-field t4-span-2"><span class="t4-field-label">Observações</span><textarea name="notes"></textarea></label></div></form>`,footer:'<button class="t4-btn" data-cancel>Cancelar</button><button class="t4-btn primary" data-save>Criar atividade</button>'});
    modal.querySelector('[data-cancel]').addEventListener('click',U.closeModal);modal.querySelector('[data-save]').addEventListener('click',async()=>{const form=modal.querySelector('#activity-form');if(!form.reportValidity())return;const payload=Object.fromEntries(new FormData(form));Object.keys(payload).forEach((key)=>payload[key]=String(payload[key]).trim()||null);const button=modal.querySelector('[data-save]');button.disabled=true;try{await D.insert(D.TABLES.activities,{...payload,status:'Pendente',priority:'Normal',owner_username:D.profile?.username||null},{select:false});U.closeModal();U.toast('Atividade criada.','success');await loadAll({background:true});}catch(error){U.toast(error.message||String(error),'error',6000);button.disabled=false;}});
  }

  app.onRoute(() => render());
  const refreshTypedList=U.debounce(()=>{render();requestAnimationFrame(()=>{const input=app.pageRoot.querySelector('[data-list-search],[data-opening-search]');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}});},170);
  app.pageRoot.addEventListener('input',(event)=>{if(event.target.matches('[data-list-search],[data-opening-search]')){state.query=event.target.value;refreshTypedList();}});
  app.pageRoot.addEventListener('change',(event)=>{if(event.target.matches('[data-status]')){state.status=event.target.value;renderEmployers();}});
  app.pageRoot.addEventListener('click',(event)=>{const edit=event.target.closest('[data-edit-employer]');if(edit){event.stopPropagation();return openEmployerForm(employerById(edit.dataset.editEmployer));}const editOpening=event.target.closest('[data-edit-opening]');if(editOpening)return openOpeningForm(openingById(editOpening.dataset.editOpening));const employer=event.target.closest('[data-open-employer]');if(employer)return openEmployerDrawer(employer.dataset.openEmployer);const go=event.target.closest('[data-go]');if(go)return app.route(go.dataset.go);const action=event.target.closest('[data-action]')?.dataset.action;if(action==='reload')return loadAll();if(action==='new-employer')return openEmployerForm();if(action==='new-opening')return openOpeningForm();if(action==='new-activity')return openActivityForm();});

  async function bootstrap(){try{await D.init(app);await loadAll();const focusId=new URLSearchParams(location.search).get('focus');if(focusId)openEmployerDrawer(focusId);D.subscribe([D.TABLES.employers,D.TABLES.openings,D.TABLES.candidates,D.TABLES.matches,D.TABLES.legacyMatches,D.TABLES.activities],U.debounce(()=>loadAll({background:true}),650),{name:'organization'});}catch(error){app.setSync('error','Sessão indisponível');app.pageRoot.innerHTML=errorPanel(error);}}
  bootstrap();
})();
