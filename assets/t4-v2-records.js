(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data;
  const e = U.esc, a = U.attr;
  const LEVELS = ['Pré-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const PRIORITIES = ['Baixa', 'Normal', 'Alta', 'Crítica'];
  const STAGES = ['Mapeado', 'Em análise', 'Apresentado', 'Entrevista', 'Proposta', 'Contratado', 'Encerrado'];
  const choices = (rows, key) => rows.map((r) => ({ value: r.id, label: r[key] || r.id }));
  const talentName = (state, id) => W.find(state.talents, id)?.nome_completo || `Talento ${id || 'não vinculado'}`;
  const employerName = (state, id) => W.find(state.employers, id)?.nome || 'Empregador não vinculado';

  // Uma empresa pode ter mais de uma classificação ao mesmo tempo (ex.:
  // apresentada pela NectaNet E parceira direta) — nunca mutuamente
  // exclusivas. "Parceira Talents 4" só aparece com evidência explícita no
  // banco (direct_talents4_partnership === 'CONFIRMADA'); nunca inferida de
  // "NectaNet MATCH", nome de aba ou qualquer outro sinal indireto (regra
  // de negócio fixa — ver docs/mapeamento/CLASSIFICACAO_EMPRESAS.md).
  // Colunas ainda ausentes no Supabase (classificação nova, não aplicada)
  // fazem o empregador cair em "Classificação pendente", nunca em silêncio.
  const own = (row, key) => Object.prototype.hasOwnProperty.call(row || {}, key);
  const truthy = (value) => value === true || ['true', '1', 'sim', 'yes'].includes(M.norm(value));
  const classificationKeys = ['presented_by_nectanet', 'source_channel', 'direct_talents4_partnership', 'partnership_status', 'company_scope', 'classification_confidence', 'classification_source', 'classification_notes'];
  const hasClassification = (employer) => classificationKeys.some((key) => own(employer, key));
  const presentedByNectanet = (employer) => truthy(employer.presented_by_nectanet)
    || M.norm(employer.source_channel) === 'nectanet'
    || M.norm(employer.company_scope) === 'nectanet_presented';
  function employerClassificationMatches(employer = {}, selected = 'all') {
    const wanted = M.norm(selected);
    if (!wanted || wanted === 'all' || wanted === 'todos') return true;
    const tags = new Set(), direct = M.norm(employer.direct_talents4_partnership), scope = M.norm(employer.company_scope);
    if (!hasClassification(employer)) tags.add('pending');
    if (direct === 'confirmada') tags.add('partner');
    if (presentedByNectanet(employer)) tags.add('nectanet');
    if (scope === 'general') tags.add('general');
    if (scope === 'external_bw') tags.add('external');
    if (direct === 'rejeitada') tags.add('no-partner');
    if (hasClassification(employer) && !['confirmada', 'rejeitada'].includes(direct)) tags.add('pending');
    return tags.has(wanted);
  }
  function employerClassificationBadges(employer = {}) {
    const badges = [];
    const known = hasClassification(employer), direct = M.norm(employer.direct_talents4_partnership), scope = M.norm(employer.company_scope);
    if (!known) return [{ label: 'Classificação pendente', tone: '' }];
    if (direct === 'confirmada') badges.push({ label: 'Parceira Talents 4', tone: 'success' });
    if (presentedByNectanet(employer)) badges.push({ label: 'Apresentada pela NectaNet', tone: 'info' });
    if (scope === 'general') badges.push({ label: 'Empresa geral', tone: '' });
    if (scope === 'external_bw') badges.push({ label: 'Externa · BW', tone: '' });
    if (direct === 'rejeitada') badges.push({ label: 'Sem parceria direta', tone: '' });
    if (!['confirmada', 'rejeitada'].includes(direct)) badges.push({ label: 'Parceria direta não confirmada', tone: 'warning' });
    if (!badges.length) badges.push({ label: 'Classificação pendente', tone: '' });
    return badges;
  }
  function employerClassificationHtml(employer) {
    return `<div class="t4-chip-row t4-classification-badges" aria-label="Classificação do empregador">${employerClassificationBadges(employer).map((b) => U.badge(b.label, b.tone)).join('')}</div>`;
  }
  const fields = (pairs) => pairs.map(([name, label, type, options]) => ({ name, label, type: type || 'text', ...(type === 'textarea' ? { wide: true } : {}), ...(options ? { options } : {}) }));
  async function finishActivity(row, after) {
    if (!D.canEdit()) return;
    const source = row.contact_followup_id ? await D.one(D.TABLES.followups, row.contact_followup_id) : row;
    const table = row.contact_followup_id ? D.TABLES.followups : D.TABLES.activities;
    await D.update(table, source.id, { status: row.contact_followup_id ? 'Concluído' : 'Concluída', completed_at: new Date().toISOString() }, source.updated_at ? { expectedUpdatedAt: source.updated_at } : {});
    U.toast('Atividade concluída. Histórico preservado.', 'success');
    await after?.();
  }
  function editFollowup(row, contactId, after) {
    if (!D.canEdit()) return;
    const data = row || { status: 'Pendente', priority: 'Normal', assigned_username: D.profile.username };
    return W.recordForm({ title: row ? 'Editar acompanhamento' : 'Novo acompanhamento', subtitle: 'Agenda de relacionamentos · Contatos', table: D.TABLES.followups, row: data,
      fields: [
        { name: 'title', label: 'O que precisa ser feito?', required: true, wide: true },
        { name: 'due_at', label: 'Data e hora', type: 'datetime-local', required: true },
        { name: 'assigned_username', label: 'Responsável' },
        { name: 'status', label: 'Situação', type: 'select', options: ['Pendente', 'Concluído', 'Cancelado'], required: true, placeholder: null },
        { name: 'priority', label: 'Prioridade', type: 'select', options: PRIORITIES, required: true, placeholder: null },
        { name: 'notes', label: 'Contexto e próximos passos', type: 'textarea', wide: true }
      ], async prepare(values, changes) {
        values.contact_id = typeof contactId === 'function' ? await contactId() : contactId || row.contact_id;
        if (!row) values.completed_at = values.status === 'Concluído' ? new Date().toISOString() : null;
        if ('status' in changes) changes.completed_at = values.status === 'Concluído' ? new Date().toISOString() : null;
      }, after });
  }
  async function editActivity(state, row, context = {}, after) {
    if (!D.canEdit()) {
      if (row) return U.openDrawer({ title: row.title || 'Atividade', subtitle: 'Consulta · seu perfil é somente leitura', body: `<div class="t4-detail-grid">${U.field('Prazo', U.formatDate(row.due_at, true))}${U.field('Situação', row.status)}${U.field('Responsável', row.owner_username)}</div>${W.section('Contexto', `<p class="t4-preserve">${e(row.notes || 'Não informado')}</p>`)}${W.section('Resultado', `<p class="t4-preserve">${e(row.outcome || 'Não informado')}</p>`)}` });
      return;
    }
    if (row?.contact_followup_id) return editFollowup(await D.one(D.TABLES.followups, row.contact_followup_id), row.contact_id, after);
    return W.recordForm({ title: row ? 'Editar atividade' : 'Nova atividade', subtitle: 'Uma ação, associada aos registros certos.', table: D.TABLES.activities,
      row: row || { ...context, activity_type: 'Tarefa', priority: 'Normal', status: 'Pendente', owner_username: D.profile.username },
      fields: [
        { name: 'title', label: 'O que precisa ser feito?', required: true, wide: true },
        { name: 'activity_type', label: 'Tipo', type: 'select', options: ['Tarefa', 'Ligação', 'E-mail', 'Reunião', 'WhatsApp', 'Documento', 'Acompanhamento', 'Outro'], required: true, placeholder: null },
        { name: 'due_at', label: 'Data e hora', type: 'datetime-local' },
        { name: 'owner_username', label: 'Responsável' },
        { name: 'priority', label: 'Prioridade', type: 'select', options: PRIORITIES, required: true, placeholder: null },
        { name: 'status', label: 'Situação', type: 'select', options: ['Pendente', 'Em andamento', 'Concluída', 'Cancelada'], required: true, placeholder: null },
        { name: 'talent_id', label: 'Talento', type: 'select', options: choices(state.talents || [], 'nome_completo') },
        { name: 'employer_id', label: 'Empregador', type: 'select', options: choices(state.employers || [], 'nome') },
        { name: 'notes', label: 'Contexto', type: 'textarea', wide: true },
        { name: 'outcome', label: 'Resultado / decisão', type: 'textarea', wide: true }
      ], prepare(values, changes) {
        if (!row) Object.assign(values, Object.fromEntries(Object.entries(context).filter(([key]) => !(key in values))), { completed_at: values.status === 'Concluída' ? new Date().toISOString() : null });
        if ('status' in changes) changes.completed_at = values.status === 'Concluída' ? new Date().toISOString() : null;
      }, after });
  }
  function activityTable(state, rows, id = 'activities') {
    return W.table({ id, rows, columns: [
      { key: 'title', label: 'Atividade', required: true, render: (r) => `<button type="button" class="t4-row-link" data-action="edit-activity" data-id="${a(r.id)}">${e(r.title)}</button><span class="t4-cell-secondary">${e(r.activity_type)}${r.contact_followup_id ? ' · Contatos' : ''}</span>` },
      { key: 'due_at', label: 'Prazo', render: (r) => `${e(U.formatDate(r.due_at, true))}${M.overdue(r.due_at, r.status) ? U.badge('Vencida', 'danger') : ''}` },
      { key: 'talent_id', label: 'Vínculos', render: (r) => `<div class="t4-chip-row">${r.talent_id ? W.link(talentName(state, r.talent_id), `./index.html?talent=${encodeURIComponent(r.talent_id)}`) : ''}${r.employer_id ? W.link(employerName(state, r.employer_id), `./organizacional.html?employer=${encodeURIComponent(r.employer_id)}`) : ''}${r.contact_id ? W.link('Contato', `./contatos.html?contact=${encodeURIComponent(r.contact_id)}`) : ''}</div>` },
      { key: 'owner_username', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => D.canEdit() && M.isOpen(r.status) ? W.button('Concluir', 'finish-activity', r.id, { className: 'sm', icon: 'check' }) : '' }
    ] });
  }
  function editSelection(state, row, context = {}, after) {
    if (!D.canEdit()) return;
    const modern = !row || row.modern;
    if (!row && !state.selections?.modern) throw new Error('A tabela de seleções por vaga não está disponível. Não execute SQL sem validar o ambiente.');
    if (!modern) {
      const original = row.sources.find((s) => s.table === row._source).row;
      const link = row._source === D.TABLES.legacyLinks;
      return W.recordForm({ title: 'Editar vínculo geral', subtitle: talentName(state, row.talent_id) + ' · ' + employerName(state, row.employer_id), row: original, table: row._source,
        notice: 'Este é um vínculo anterior, sem vaga específica. A edição preserva seu ID e não altera o cadastro geral do talento.',
        fields: [
          { name: 'status_vinculo', label: 'Etapa do vínculo', required: true, type: 'select', options: ['Aguardando retorno', 'Aguardando envio', 'Aguardando resposta', 'Reunião marcada', 'Em processo', 'Gostou', 'Não gostou', 'Contratado', 'Removido', 'Excluído'], placeholder: null },
          { name: 'proxima_acao', label: 'Próxima ação', wide: true },
          ...(link ? fields([['proximo_followup_em', 'Prazo', 'datetime-local'], ['responsavel_interno', 'Responsável'], ['motivo_match', 'Motivo do vínculo', 'textarea'], ['observacao_rh', 'Observações', 'textarea']])
            : fields([['data_envio', 'Data de envio', 'date'], ['data_retorno', 'Data do retorno', 'date'], ['motivo_encaixe', 'Motivo do vínculo', 'textarea'], ['riscos_ressalvas', 'Riscos e ressalvas', 'textarea'], ['observacoes', 'Observações', 'textarea']]))
        ], after });
    }
    const raw = row ? row.sources?.[0]?.row || row : { ...context, stage: 'Mapeado', status: 'Ativo', priority: 100, viability: 'A validar', owner_username: D.profile.username };
    return W.recordForm({ title: row ? 'Editar seleção' : 'Nova seleção', subtitle: 'Talento + vaga. Um talento pode participar de mais de uma seleção.', row: raw, table: D.TABLES.matches,
      fields: [
        { name: 'talent_id', label: 'Talento', type: 'select', options: choices((state.talents || []).filter((talent) => M.isTalent(talent)), 'nome_completo'), required: true, readonly: !!row, wide: true },
        { name: 'opening_id', label: 'Vaga / empregador', type: 'select', options: state.openings.map((r) => ({ value: r.id, label: `${employerName(state, r.employer_id)} · ${r.title}` })), required: true, readonly: !!row, wide: true },
        { name: 'stage', label: 'Etapa da seleção', type: 'select', options: STAGES, required: true, placeholder: null },
        { name: 'status', label: 'Situação do vínculo', type: 'select', options: ['Ativo', 'Encerrado'], required: true, placeholder: null },
        { name: 'owner_username', label: 'Responsável' },
        { name: 'priority', label: 'Ordem de prioridade', type: 'number', min: 1, max: 9999, required: true },
        { name: 'next_action', label: 'Próxima ação', wide: true },
        { name: 'next_action_at', label: 'Prazo da próxima ação', type: 'datetime-local' },
        { name: 'viability', label: 'Viabilidade avaliada', type: 'select', options: ['A validar', 'Baixa', 'Média', 'Alta'], required: true, placeholder: null },
        { section: 'Avaliação humana · opcional' },
        ...['overall', 'professional', 'language', 'mobility', 'document'].map((key, i) => ({ name: `${key}_score`, label: ['Compatibilidade geral (%)', 'Profissional (%)', 'Idioma (%)', 'Mobilidade (%)', 'Documentação (%)'][i], type: 'number', min: 0, max: 100, step: 0.1 })),
        { name: 'reasons', label: 'Por que este talento se encaixa?', type: 'textarea', wide: true },
        { name: 'barriers', label: 'Barreiras / ressalvas', type: 'textarea', wide: true },
        { name: 'sent_at', label: 'Apresentação ao empregador', type: 'datetime-local' },
        { name: 'responded_at', label: 'Retorno do empregador', type: 'datetime-local' }
      ], prepare(values) {
        if (!row) {
          const opening = W.find(state.openings, values.opening_id);
          if (!opening || !W.find(state.employers, opening.employer_id)) throw new Error('Selecione uma vaga com empregador válido.');
          values.employer_id = opening.employer_id;
          if (state.selections.rows.some((r) => r.modern && M.same(r.talent_id, values.talent_id) && M.same(r.opening_id, values.opening_id))) throw new Error('Este talento já está vinculado à vaga. Abra a seleção existente.');
        }
      }, after });
  }
  function selectionTable(state, rows, id = 'selections', options = {}) {
    return W.table({ id, rows, columns: [
      { key: 'talent_id', label: 'Talento', required: true, value: (r) => talentName(state, r.talent_id), render: (r) => { const talent = W.find(state.talents, r.talent_id); const meta = [talent?.profissao_principal || talent?.area_profissional, talent && !M.activeRecord(talent) ? 'Arquivado' : ''].filter(Boolean).join(' · '); return W.person(talentName(state, r.talent_id), meta, '', 'selection-detail', r.key); } },
      { key: 'employer_id', label: 'Empregador / vaga', value: (r) => employerName(state, r.employer_id), render: (r) => { const employer = W.find(state.employers, r.employer_id); const name = window.T4Modern?.employer ? window.T4Modern.employer(employer || { nome: employerName(state, r.employer_id), id: r.employer_id }) : e(employerName(state, r.employer_id)); return W.stackHtml(name, r.opening_id ? W.find(state.openings, r.opening_id)?.title || 'Vaga não encontrada' : 'Vínculo geral · anterior à V2'); } },
      { key: 'stage', label: 'Etapa', render: (r) => W.status(r.stage) },
      { key: 'next_action', label: 'Próxima ação', render: (r) => W.stack(r.next_action, M.dateOnly(r.next_action_at) ? U.formatDate(r.next_action_at) : '') },
      { key: 'owner_username', label: 'Responsável' },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => W.button('Abrir', 'selection-detail', r.key, { className: 'sm', icon: 'chevron' }) }
    ], pageSize: options.pageSize || 25, groupBy: options.groupBy || null });
  }
  function selectionAnalytics(state, rows, options = {}) {
    const scope = options.scope || 'active';
    const open = rows.filter((row) => ['review', 'sent', 'interview', 'offer'].includes(M.selectionBucket(row)));
    const hired = rows.filter((row) => M.selectionBucket(row) === 'hired');
    const closed = rows.filter((row) => M.selectionBucket(row) === 'closed');
    const rank = new Map(M.SELECTION_COLUMNS.map((column, index) => [column.id, index]));
    const recency = (row) => String(row.updated_at || row.responded_at || row.sent_at || row.created_at || '');
    const sorted = (list) => [...list].sort((left, right) => rank.get(M.selectionBucket(left)) - rank.get(M.selectionBucket(right))
      || String(right.next_action_at || '').localeCompare(String(left.next_action_at || ''), 'pt-BR', { numeric: true })
      || recency(right).localeCompare(recency(left), 'pt-BR', { numeric: true })
      || M.norm(talentName(state, left.talent_id)).localeCompare(M.norm(talentName(state, right.talent_id)), 'pt-BR'));
    const groupLabel = (row) => M.SELECTION_COLUMNS.find((column) => column.id === M.selectionBucket(row))?.name || 'Sem etapa';
    const prefix = options.idPrefix || 'selection-analytics';
    const tableSection = (title, description, list, id, empty) => `<section class="t4-selection-analytics-group"><header><div><span class="t4-selection-analytics-kicker">REGISTRO OPERACIONAL</span><h3>${e(title)}</h3><p>${e(description)}</p></div><strong>${list.length}</strong></header>${list.length ? selectionTable(state, sorted(list), id, { pageSize: 25, groupBy: title === 'Seleções em aberto' ? groupLabel : null }) : U.emptyState(title === 'Contratados' ? 'Nenhuma contratação registrada' : empty, 'Altere o filtro ou crie uma nova relação para preencher este bloco.')}</section>`;
    const summary = `<div class="t4-selection-analytics-summary" aria-label="Resumo das seleções"><span><strong>${open.length}</strong> em aberto</span><span><strong>${hired.length}</strong> contratada${hired.length === 1 ? '' : 's'}</span><span><strong>${closed.length}</strong> no histórico</span></div>`;
    const groups = [];
    if (scope !== 'closed') {
      groups.push(tableSection('Seleções em aberto', 'Em análise, apresentadas, entrevistas e propostas em uma única tabela paginada.', open, `${prefix}-open`, 'Nenhuma seleção em aberto'));
      groups.push(tableSection('Contratados', 'Relações concluídas com contratação, separadas da fila de acompanhamento.', hired, `${prefix}-hired`, 'Nenhum contratado neste recorte'));
    }
    if (scope === 'all' || scope === 'closed') {
      groups.push(tableSection('Histórico de encerrados', 'Excluídos, removidos e demais relações fechadas ficam disponíveis somente para consulta.', closed, `${prefix}-closed`, 'Nenhum registro encerrado'));
    }
    return `<div class="t4-selection-analytics">${summary}${groups.join('')}</div>`;
  }
  function selectionDrawer(state, row) {
    if (!row) return;
    const opening = W.find(state.openings, row.opening_id);
    const talent = W.find(state.talents, row.talent_id), archived = talent && !M.activeRecord(talent);
    return U.openDrawer({ title: talentName(state, row.talent_id), subtitle: `${archived ? 'Arquivado · ' : ''}${employerName(state, row.employer_id)} · ${opening?.title || 'Vínculo geral'}`,
      actions: `${D.canEdit() ? W.button('Editar seleção', 'edit-selection', row.key, { className: 'primary', icon: 'edit' }) : ''}${W.link('Ficha do talento', `./index.html?talent=${encodeURIComponent(row.talent_id)}`, 'user')}${W.link('Empregador', `./organizacional.html?employer=${encodeURIComponent(row.employer_id)}`, 'building')}`,
      body: `${archived ? W.note('Este Talento está arquivado, mas a seleção continua em andamento. Revise o vínculo antes de avançar.', 'warning') : ''}${row.sourceConflict ? W.note('Há etapas diferentes nas duas fontes antigas. O registro principal do CRM é exibido; ambos os originais permanecem abaixo para conferência.', 'warning') : ''}
        <div class="t4-detail-grid">${U.field('Etapa', row.stage)}${U.field('Situação', row.status)}${U.field('Responsável', row.owner_username)}${U.field('Prazo', U.formatDate(row.next_action_at))}${U.field('Enviado em', U.formatDate(row.sent_at))}${U.field('Retorno em', U.formatDate(row.responded_at))}</div>
        ${W.section('Próxima ação', `<p class="t4-preserve">${e(row.next_action || 'Defina o próximo passo desta seleção.')}</p>`)}
        ${W.section('Avaliação e contexto', `<div class="t4-detail-grid">${U.field('Viabilidade', row.viability)}${U.field('Compatibilidade geral', M.finite(row.overall_score) ? `${row.overall_score}%` : 'Não avaliada')}</div><h3>Motivos</h3><p class="t4-preserve">${e(row.reasons || 'Não informado')}</p><h3>Barreiras</h3><p class="t4-preserve">${e(row.barriers || 'Não informadas')}</p><p class="t4-preserve">${e(row.notes || '')}</p>`)}
        <details class="t4-disclosure"><summary>Origem e histórico preservados (${row.sources.length})</summary>${row.sources.map((s) => `<h3>${e(s.table)}</h3><pre class="t4-raw">${e(JSON.stringify(s.row, null, 2))}</pre>`).join('')}</details>` });
  }
  function selectionBoard(state, rows) {
    return `<div class="t4-board" aria-label="Quadro de seleções">${M.SELECTION_COLUMNS.map((col) => {
      const items = rows.filter((r) => M.selectionBucket(r) === col.id);
      return `<section class="t4-board-column ${a(col.tone)}"><header><h2>${e(col.name)}</h2><span>${items.length}</span></header><div class="t4-board-cards">${items.length ? items.map((r) => {
        const talent = W.find(state.talents, r.talent_id);
        return `<article class="t4-selection-card"><div class="t4-card-eyebrow">${e(employerName(state, r.employer_id))}</div><button class="t4-card-title" data-action="selection-detail" data-id="${a(r.key)}">${e(talentName(state, r.talent_id))}</button><p>${e(talent?.profissao_principal || talent?.area_profissional || 'Área não informada')}</p><div class="t4-chip-row">${U.badge(r.stage, col.tone)}${talent?.nivel_alemao ? U.badge(talent.nivel_alemao) : ''}</div><div class="t4-card-next"><span>${U.icon('arrow')}${e(r.next_action || 'Definir próxima ação')}</span>${r.next_action_at ? `<small class="${M.overdue(r.next_action_at, r.status) ? 't4-text-danger' : ''}">${e(U.formatDate(r.next_action_at))}</small>` : ''}</div><footer><span>${e(r.owner_username || 'Sem responsável')}</span>${D.canEdit() ? W.button('Etapa', 'edit-selection', r.key, { className: 'ghost sm', icon: 'edit' }) : ''}</footer>${!r.modern ? '<small class="t4-source-caption">Vínculo geral anterior</small>' : ''}</article>`;
      }).join('') : '<div class="t4-column-empty">Nenhuma seleção nesta etapa.</div>'}</div></section>`;
    }).join('')}</div>`;
  }
  const rawLabel = (key) => { const words = key.replaceAll('_', ' ').split(' '); return words.map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' '); };
  function storedFields(row, excluded = []) {
    const entries = Object.entries(row).filter(([key, value]) => !excluded.includes(key) && M.present(value));
    return `<details class="t4-disclosure"><summary>Demais informações preservadas (${entries.length})</summary><div class="t4-detail-grid">${entries.map(([key, value]) => {
      if (/foto|base64|blob/i.test(key) && String(value).length > 1000) return U.field(rawLabel(key), 'Arquivo preservado no cadastro original');
      return U.field(rawLabel(key), typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
    }).join('')}</div></details>`;
  }
  window.T4Records = Object.freeze({ LEVELS, PRIORITIES, STAGES, fields, choices, talentName, employerName, editFollowup, editActivity,
    finishActivity, activityTable, editSelection, selectionTable, selectionAnalytics, selectionDrawer, selectionBoard, storedFields,
    employerClassificationBadges, employerClassificationHtml, employerClassificationMatches, classificationKeys });
})();
