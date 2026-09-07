(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data, R = window.T4Records;
  const e = U.esc, a = U.attr;
  const VIEWS = [
    { id: 'overview', label: 'Meu dia', subtitle: 'Aprendizagem, presença e próximos passos dos talentos.', icon: 'dashboard', hidden: true },
    { id: 'classes', label: 'Turmas', subtitle: 'Instituição, professor, horários e recursos de cada turma.', icon: 'book' },
    { id: 'students', label: 'Matrículas', subtitle: 'Uma matrícula ligada ao cadastro original do Talento.', icon: 'graduation' },
    { id: 'attention', label: 'A acompanhar', subtitle: 'Alertas explicados, sem confundir informação ausente com desempenho ruim.', icon: 'warning' },
    { id: 'history', label: 'Histórico de evolução', subtitle: 'Presenças, avaliações, evolução, contatos e alertas.', icon: 'history', primary: false }
  ];
  const app = U.mount({ module: 'german', moduleLabel: 'Alemão', views: VIEWS, defaultView: 'classes' });
  const state = { talents: [], contacts: [], classes: [], enrollments: [], updates: [], teacherLink: false, classId: '', status: '', level: '', risk: '', query: '', display: 'cards', classScope: 'active', studentScope: 'current', loaded: false };
  const sources = {
    talents: { label: 'Talentos', load: () => D.loadCandidates({ activeOnly: false }) },
    contacts: { label: 'Professores / contatos', load: () => D.loadContacts({ includeArchived: true }) },
    classes: { label: 'Turmas', load: () => D.all(D.TABLES.classes) },
    enrollments: { label: 'Matrículas', load: () => D.all(D.TABLES.enrollments) },
    updates: { label: 'Histórico de aulas', load: () => D.all(D.TABLES.courseUpdates, '*', (q) => q.order('event_date', { ascending: false })) },
    teacherLink: { label: 'Vínculo de professor', load: async () => { try { await D.select(D.TABLES.classes, 'teacher_contact_id', (q) => q.limit(1)); return true; } catch (err) { if (D.missingColumn(err)) return false; throw err; } } }
  };
  const load = W.loader(app, state, sources, render);
  const name = (id) => R.talentName(state, id);
  const cls = (id) => W.find(state.classes, id);
  const current = (r) => ['Matriculado', 'Ativo', 'Pausado'].includes(r.status);
  const values = (value) => Array.isArray(value) ? value.filter(M.present).map(String) : M.present(value) ? [String(value)] : [];
  const firstValue = (value) => values(value)[0] || '';
  const matches = (value, selected) => { const wanted = values(selected); return !wanted.length || wanted.some((item) => (Array.isArray(value) ? value : [value]).some((candidate) => M.norm(candidate) === M.norm(item))); };
  const teacher = (r) => {
    const c = W.find(state.contacts, r.teacher_contact_id);
    if (c && ['candidatos', 'candidate', 'candidates'].includes(c.source_system)) return W.find(state.talents, c.source_record_id)?.nome_completo || c.display_name;
    return c?.display_name || r.teacher_name || 'Professor não informado';
  };
  const match = (values) => !state.query || M.norm(values.filter(M.present).join(' ')).includes(M.norm(state.query));
  function rows(attention = false) {
    return state.enrollments.filter((r) => matches(r.class_id, state.classId) && matches(r.status, state.status) && matches(r.current_level, state.level) && matches(r.risk_level, state.risk) && (!attention || M.riskReasons(r).length) && match([name(r.candidate_id), cls(r.class_id)?.name, r.owner_name, r.next_action, r.notes]));
  }
  const filterLabels = { classId: 'Turma', status: 'Situação', level: 'Nível', risk: 'Risco' };
  const filterValueLabel = (key, value) => key === 'classId' ? (W.find(state.classes, value)?.name || value) : value;
  function filters() {
    return `<div class="t4-toolbar">${W.multiFilter('classId', 'Turmas', R.choices(state.classes, 'name'), state.classId)}${W.multiFilter('status', 'Situações', ['Matriculado', 'Ativo', 'Pausado', 'Concluído', 'Desistente', 'Transferido'], state.status)}${W.multiFilter('level', 'Níveis', R.LEVELS, state.level)}${W.multiFilter('risk', 'Riscos', ['Baixo', 'Médio', 'Alto'], state.risk)}<span class="t4-toolbar-spacer"></span>${W.button('Limpar', 'clear', '', { className: 'ghost sm' })}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div>${W.activeFiltersBar(state, ['classId', 'status', 'level', 'risk'], filterLabels, filterValueLabel)}`;
  }
  function render() {
    if (!state.loaded) return;
    app.setSearchHandler((q) => { state.query = q; render(); }, 'Buscar talento, turma ou instituição…');
    app.setCounts({ classes: state.classes.length, students: state.enrollments.filter(current).length, attention: state.enrollments.filter((r) => M.riskReasons(r).length).length, history: state.updates.length });
    const createClass = app.view === 'classes';
    app.setPrimaryAction(createClass ? 'Nova turma' : 'Nova matrícula', D.canEdit() ? () => createClass ? editClass() : editEnrollment() : null);
    const html = ({ overview, classes: classesView, students: () => filters() + studentScopes() + enrollmentTable(rows(state.studentScope !== 'all' ? undefined : false).filter((r) => state.studentScope === 'current' ? current(r) : state.studentScope === 'closed' ? !current(r) : true)), attention: () => filters() + studentScopes() + W.note('A acompanhar = presença abaixo de 75%, risco alto, desempenho em atenção/crítico ou acompanhamento vencido. Somente matrículas em acompanhamento geram alertas.') + enrollmentTable(rows(true), 'attention'), history: historyView }[app.view] || overview)();
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html;
    U.animateCounters(app.pageRoot);
  }
  function overview() {
    const active = state.enrollments.filter(current), measured = active.filter((r) => M.finite(r.attendance_percent));
    const avg = measured.length ? `${Math.round(measured.reduce((sum, r) => sum + Number(r.attendance_percent), 0) / measured.length)}%` : '—';
    return `<div class="t4-work-intro"><div><span class="t4-overline">DESENVOLVIMENTO DOS TALENTOS</span><h2>Evolução visível. Acompanhamento próximo.</h2><p>Do primeiro encontro à certificação, com contexto para agir.</p></div>${W.button('Ver turmas', 'go', 'classes', { icon: 'book' })}</div>
      <div class="t4-kpi-grid">${U.kpi('Turmas ativas', state.classes.filter((r) => r.status === 'Ativa').length, 'Instituições e professores')}${U.kpi('Em acompanhamento', active.length, 'Matrículas ativas, matriculadas ou pausadas')}${U.kpi('Presença média', avg, `${measured.length} matrículas com presença registrada`)}${U.kpi('Precisam de atenção', state.enrollments.filter((r) => M.riskReasons(r).length).length, 'Motivos visíveis por aluno', 'warn')}</div>
      ${W.section('Acompanhar de perto', enrollmentTable(rows(true), 'course-attention'), W.button('Todos os alunos', 'go', 'students', { className: 'sm' }))}
      ${W.section('Turmas em andamento', classCards(state.classes.filter((r) => r.status === 'Ativa' && match([r.name, r.code, r.provider, teacher(r)]))))}`;
  }
  function classCards(list) {
    return `<div class="t4-cards-grid">${list.map((r) => {
      const students = state.enrollments.filter((s) => M.same(s.class_id, r.id) && current(s));
      const filled = r.capacity ? Math.min(100, students.length / r.capacity * 100) : 0;
      return `<article class="t4-course-card"><div class="t4-company-head"><span class="t4-course-code">${e(r.code)}</span>${W.status(r.status)}</div><button class="t4-card-title" data-action="class-detail" data-id="${a(r.id)}">${e(r.name)}</button><p>${e(r.provider || 'Instituição não informada')}</p><div class="t4-level-route"><strong>${e(r.level_start)}</strong>${U.icon('arrow')}<strong>${e(r.level_target)}</strong><span>${e(r.modality)}</span></div><div class="t4-course-meta"><span>${U.icon('user')}${e(teacher(r))}</span><span>${U.icon('clock')}${e(r.schedule_text || 'Horários a definir')}</span><span>${U.icon('calendar')}${e(U.formatDate(r.start_date))} – ${e(U.formatDate(r.expected_end_date))}</span></div><div class="t4-progress" role="meter" aria-label="Ocupação da turma" aria-valuenow="${students.length}" aria-valuemin="0" aria-valuemax="${Math.max(students.length, Number(r.capacity) || 1)}"><span style="width:${filled}%"></span></div><footer><span>${students.length} / ${e(r.capacity)} vagas ocupadas</span>${W.button('Abrir turma', 'class-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</footer></article>`;
    }).join('') || U.emptyState('Nenhuma turma neste recorte', 'As turmas encerradas continuam disponíveis em Turmas.')}</div>`;
  }
  function classesView() {
    const scope = state.classScope || 'active';
    const closed = (r) => /conclu|cancel|encerr|arquiv/i.test(M.norm(r.status || ''));
    const list = state.classes.filter((r) => (scope === 'active' ? !closed(r) : scope === 'closed' ? closed(r) : true) && match([r.name, r.code, r.provider, teacher(r), r.schedule_text]));
    const count = (id) => state.classes.filter((r) => id === 'active' ? !closed(r) : id === 'closed' ? closed(r) : true).length;
    return W.chips([{ id: 'active', label: 'Em andamento', count: count('active'), icon: 'book' }, { id: 'all', label: 'Todas', count: count('all'), icon: 'list' }, { id: 'closed', label: 'Histórico', count: count('closed'), icon: 'archive' }], scope, 'class-scope') + W.chips([{ id: 'cards', label: 'Cartões', icon: 'grid' }, { id: 'list', label: 'Lista', icon: 'list' }], state.display, 'display') + (state.display === 'cards' ? classCards(list) : W.table({ id: 'classes', rows: list, columns: [
      { key: 'name', label: 'Turma', required: true, render: (r) => `<button class="t4-row-link" data-action="class-detail" data-id="${a(r.id)}">${e(r.name)}</button><small class="t4-cell-secondary">${e(r.code)}</small>` }, { key: 'provider', label: 'Instituição' }, { key: 'teacher_name', label: 'Professor', value: teacher, render: (r) => e(teacher(r)) }, { key: 'schedule_text', label: 'Horário' }, { key: 'level_target', label: 'Nível-alvo' }, { key: 'expected_end_date', label: 'Previsão de término', render: (r) => e(U.formatDate(r.expected_end_date)) }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }
    ] }));
  }
  function studentScopes() {
    const currentCount = state.enrollments.filter(current).length, closedCount = state.enrollments.filter((r) => !current(r)).length;
    return W.chips([{ id: 'current', label: 'Em acompanhamento', count: currentCount, icon: 'graduation' }, { id: 'all', label: 'Todas as matrículas', count: state.enrollments.length, icon: 'list' }, { id: 'closed', label: 'Concluídas / encerradas', count: closedCount, icon: 'archive' }], state.studentScope || 'current', 'student-scope');
  }
  function enrollmentTable(list, id = 'students') {
    return W.table({ id, rows: list, columns: [
      { key: 'candidate_id', label: 'Talento', required: true, value: (r) => name(r.candidate_id), render: (r) => W.person(name(r.candidate_id), cls(r.class_id)?.name || 'Turma não encontrada', '', 'enrollment-detail', r.id) },
      { key: 'current_level', label: 'Nível / meta', render: (r) => W.stack(r.current_level || 'Não avaliado', `Meta: ${r.target_level || cls(r.class_id)?.level_target || '—'}`) },
      { key: 'attendance_percent', label: 'Presença', render: (r) => M.finite(r.attendance_percent) ? U.badge(`${r.attendance_percent}%`, Number(r.attendance_percent) < 75 ? 'warning' : 'success') : '<span class="t4-muted">Sem registro</span>' },
      { key: 'progress_percent', label: 'Progresso', render: (r) => `${e(r.progress_percent ?? 0)}%` },
      { key: 'exam_status', label: 'Prova', render: (r) => W.status(r.exam_status) },
      { key: 'next_action', label: 'Próximo passo', render: (r) => W.stack(r.next_action, r.next_action_due ? U.formatDate(r.next_action_due) : '') },
      { key: 'owner_name', label: 'Responsável' },
      { key: 'risk', label: 'Atenção', value: (r) => M.riskReasons(r).length, render: (r) => M.riskReasons(r).length ? `<span class="t4-risk-reasons">${M.riskReasons(r).map((reason) => e(reason)).join('<br>')}</span>` : W.status(r.status) },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => D.canEdit() ? W.button('Registrar', 'new-update', r.id, { className: 'sm', icon: 'plus' }) : '' }
    ] });
  }
  function historyTable(list, id = 'german-history') {
    return W.table({ id, rows: list, columns: [
      { key: 'event_date', label: 'Data', render: (r) => e(U.formatDate(r.event_date)) },
      { key: 'enrollment_id', label: 'Talento', required: true, render: (r) => e(name(W.find(state.enrollments, r.enrollment_id)?.candidate_id)) },
      { key: 'kind', label: 'Tipo', render: (r) => U.badge(r.kind, r.kind === 'Alerta' ? 'warning' : 'info') }, { key: 'attendance_status', label: 'Presença' },
      { key: 'score', label: 'Nota' }, { key: 'level_after', label: 'Nível após registro' }, { key: 'note', label: 'Observação', render: (r) => `<span class="t4-clamp-3">${e(r.note || '—')}</span>` },
      { key: 'actions', label: '', ariaLabel: 'Ações', sort: false, render: (r) => D.canEdit() ? W.button('Editar', 'edit-update', r.id, { className: 'ghost sm', icon: 'edit' }) : '' }
    ] });
  }
  function historyView() {
    const list = state.updates.filter((r) => { const en = W.find(state.enrollments, r.enrollment_id); return matches(en?.class_id, state.classId) && match([name(en?.candidate_id), r.note, r.kind, r.attendance_status]); });
    return `<div class="t4-toolbar">${W.multiFilter('classId', 'Turmas', R.choices(state.classes, 'name'), state.classId)}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div>` + historyTable(list);
  }
  function classDetail(row) {
    if (!row) return;
    U.openDrawer({ title: row.name, subtitle: `${row.code} · ${row.provider || 'Instituição não informada'}`, actions: `${D.canEdit() ? W.button('Editar turma', 'edit-class', row.id, { className: 'sm', icon: 'edit' }) + W.button('Matricular talento', 'enroll-in-class', row.id, { className: 'primary sm', icon: 'plus' }) : ''}${row.teacher_contact_id ? W.link('Ficha do professor', `./contatos.html?contact=${encodeURIComponent(row.teacher_contact_id)}`, 'contact') : ''}`,
      body: `<div class="t4-detail-grid">${U.field('Professor', teacher(row))}${U.field('Instituição', row.provider)}${U.field('Modalidade', row.modality)}${U.field('Horários', row.schedule_text)}${U.field('Nível inicial', row.level_start)}${U.field('Meta', row.level_target)}${U.field('Início', U.formatDate(row.start_date))}${U.field('Término previsto', U.formatDate(row.expected_end_date))}${U.field('Capacidade', row.capacity)}${U.field('Situação', row.status)}</div><div class="t4-resource-links">${W.external('Link da aula', row.meeting_link)}${W.external('Materiais de apoio', row.drive_link)}</div><p class="t4-preserve">${e(row.notes || '')}</p>${W.section('Alunos em acompanhamento', enrollmentTable(state.enrollments.filter((r) => M.same(r.class_id, row.id) && current(r)), 'class-students'))}${state.enrollments.some((r) => M.same(r.class_id, row.id) && !current(r)) ? W.note('Matrículas concluídas ou encerradas ficam preservadas no Histórico e não competem com a turma atual.', 'info') : ''}` });
  }
  function enrollmentDetail(row) {
    if (!row) return;
    const talent = W.find(state.talents, row.candidate_id), course = cls(row.class_id);
    U.openDrawer({ title: name(row.candidate_id), subtitle: `${course?.name || 'Turma não encontrada'} · ${row.status}`, actions: `${D.canEdit() ? W.button('Editar matrícula', 'edit-enrollment', row.id, { className: 'sm', icon: 'edit' }) + W.button('Registrar evolução / presença', 'new-update', row.id, { className: 'primary sm', icon: 'plus' }) : ''}${W.link('Ficha do talento', `./index.html?talent=${encodeURIComponent(row.candidate_id)}`, 'user')}`,
      body: `${M.riskReasons(row).map((reason) => W.note(reason, 'warning')).join('')}<div class="t4-detail-grid">${U.field('Nível no curso', row.current_level)}${U.field('Nível informado no perfil', talent?.nivel_alemao)}${U.field('Nível-alvo', row.target_level)}${U.field('Presença', M.finite(row.attendance_percent) ? `${row.attendance_percent}%` : 'Sem registro')}${U.field('Progresso', `${row.progress_percent ?? 0}%`)}${U.field('Desempenho', row.performance)}${U.field('Risco informado', row.risk_level)}${U.field('Prova', row.exam_status)}${U.field('Última nota', row.last_assessment_score)}${U.field('Responsável', row.owner_name)}${U.field('Matrícula', U.formatDate(row.enrolled_at))}${U.field('Conclusão', U.formatDate(row.completed_at))}</div>${W.section('Próxima ação', `<p>${e(row.next_action || 'Não definida')}</p><small>${e(U.formatDate(row.next_action_due))}</small>`)}<p class="t4-preserve">${e(row.notes || '')}</p>${W.section('Histórico completo', historyTable(state.updates.filter((r) => M.same(r.enrollment_id, row.id)), 'student-history'))}${R.storedFields(row, ['id', 'class_id', 'candidate_id', 'current_level', 'target_level', 'attendance_percent', 'progress_percent', 'performance', 'risk_level', 'exam_status', 'next_action', 'next_action_due', 'owner_name', 'notes'])}` });
  }
  function editClass(row) {
    if (!D.canEdit()) return;
    return W.recordForm({ title: row ? 'Editar turma' : 'Nova turma', table: D.TABLES.classes, row: row || { level_start: 'A1', level_target: 'B1', modality: 'Online', capacity: 20, status: 'Planejada' }, fields: [
      { name: 'code', label: 'Código da turma', required: true }, { name: 'name', label: 'Nome da turma', required: true }, { name: 'provider', label: 'Instituição de ensino' },
      ...(state.teacherLink ? [{ name: 'teacher_contact_id', label: 'Professor vinculado à agenda', type: 'select', options: state.contacts.filter((r) => r.entity_type === 'Pessoa' && !r.archived_at).map((r) => ({ value: r.id, label: r.display_name })) }] : []),
      { name: 'teacher_name', label: 'Nome do professor', help: 'Quando houver contato vinculado, o nome da agenda tem prioridade na exibição.' },
      { name: 'level_start', label: 'Nível inicial', type: 'select', options: R.LEVELS, required: true, placeholder: null }, { name: 'level_target', label: 'Nível-alvo', type: 'select', options: R.LEVELS.slice(1), required: true, placeholder: null },
      { name: 'start_date', label: 'Início', type: 'date' }, { name: 'expected_end_date', label: 'Término previsto', type: 'date' }, { name: 'modality', label: 'Modalidade', type: 'select', options: ['Online', 'Presencial', 'Híbrido'], required: true, placeholder: null }, { name: 'capacity', label: 'Capacidade', type: 'number', min: 1, required: true }, { name: 'status', label: 'Situação', type: 'select', options: ['Planejada', 'Ativa', 'Pausada', 'Concluída', 'Cancelada'], required: true, placeholder: null },
      { name: 'schedule_text', label: 'Dias, horários e fuso', wide: true }, { name: 'meeting_link', label: 'Link da aula', type: 'url' }, { name: 'drive_link', label: 'Link dos materiais', type: 'url', help: 'Apenas referência existente; não há sincronização com o Google.' }, { name: 'notes', label: 'Observações', type: 'textarea', wide: true }
    ], prepare(v, c) {
      if (v.start_date && v.expected_end_date && v.expected_end_date < v.start_date) throw new Error('O término não pode ser anterior ao início.');
      if (v.teacher_contact_id && (!row || 'teacher_contact_id' in c)) { const teacherName = W.find(state.contacts, v.teacher_contact_id)?.display_name; if (teacherName) { v.teacher_name = teacherName; if (row) c.teacher_name = teacherName; } }
    }, after: load });
  }
  function editEnrollment(row, classId) {
    if (!D.canEdit()) return;
    return W.recordForm({ title: row ? 'Editar matrícula' : 'Nova matrícula', table: D.TABLES.enrollments, row: row || { class_id: classId || firstValue(state.classId), status: 'Matriculado', enrolled_at: M.today(), progress_percent: 0, performance: 'Sem avaliação', risk_level: 'Baixo', exam_status: 'Não agendado', owner_name: D.profile.nome },
      notice: 'A evolução do curso aparece na ficha do talento. O nível informado no perfil é preservado separadamente; esta operação não sobrescreve o cadastro original.', fields: [
        { name: 'candidate_id', label: 'Talento', type: 'select', options: R.choices(state.talents, 'nome_completo'), required: true, readonly: !!row, wide: true }, { name: 'class_id', label: 'Turma', type: 'select', options: R.choices(state.classes, 'name'), required: true, readonly: !!row, wide: true },
        { name: 'status', label: 'Situação', type: 'select', options: ['Matriculado', 'Ativo', 'Pausado', 'Concluído', 'Desistente', 'Transferido'], required: true, placeholder: null }, { name: 'enrolled_at', label: 'Data da matrícula', type: 'date', required: true }, { name: 'completed_at', label: 'Data da conclusão', type: 'date' }, { name: 'owner_name', label: 'Responsável pelo acompanhamento' },
        { name: 'current_level', label: 'Nível atual do curso', type: 'select', options: R.LEVELS }, { name: 'target_level', label: 'Nível-alvo', type: 'select', options: R.LEVELS.slice(1) }, { name: 'progress_percent', label: 'Progresso (%)', type: 'number', min: 0, max: 100, step: 0.1, required: true }, { name: 'performance', label: 'Desempenho', type: 'select', options: ['Sem avaliação', 'Excelente', 'Adequado', 'Atenção', 'Crítico'], required: true, placeholder: null }, { name: 'risk_level', label: 'Risco informado', type: 'select', options: ['Baixo', 'Médio', 'Alto'], required: true, placeholder: null }, { name: 'exam_status', label: 'Situação da prova', type: 'select', options: ['Não agendado', 'Agendado', 'Aprovado', 'Reprovado'], required: true, placeholder: null },
        { name: 'next_action', label: 'Próxima ação', wide: true }, { name: 'next_action_due', label: 'Prazo', type: 'date' }, { name: 'notes', label: 'Observações', type: 'textarea', wide: true }
      ], prepare(v) {
        if (!row) {
          if (state.enrollments.some((r) => M.same(r.candidate_id, v.candidate_id) && M.same(r.class_id, v.class_id))) throw new Error('Este talento já tem uma matrícula nesta turma. Abra a matrícula existente.');
          const course = cls(v.class_id);
          if (course && state.enrollments.filter((r) => M.same(r.class_id, course.id) && current(r)).length >= course.capacity) throw new Error('A turma atingiu a capacidade cadastrada. Revise a capacidade antes de matricular.');
        }
      }, after: load });
  }
  function editUpdate(row, enrollmentId) {
    if (!D.canEdit()) return;
    const enrollment = W.find(state.enrollments, row?.enrollment_id || enrollmentId);
    if (!enrollment) throw new Error('Matrícula não encontrada. Atualize a tela.');
    const modal = W.recordForm({ title: row ? 'Editar registro do histórico' : 'Registrar presença / evolução', subtitle: name(enrollment.candidate_id), table: D.TABLES.courseUpdates,
      row: row || { kind: 'Presença', event_date: M.today() }, fields: [
        { name: 'kind', label: 'Tipo de registro', type: 'select', options: ['Presença', 'Avaliação', 'Evolução', 'Contato', 'Alerta'], required: true, placeholder: null }, { name: 'event_date', label: 'Data', type: 'date', required: true },
        { name: 'attendance_status', label: 'Presença na aula', type: 'select', options: ['Presente', 'Falta justificada', 'Falta'] }, { name: 'score', label: 'Nota (0 a 100)', type: 'number', min: 0, max: 100, step: 0.1 }, { name: 'level_after', label: 'Nível após o registro', type: 'select', options: R.LEVELS }, { name: 'note', label: 'Observação', type: 'textarea', wide: true }
      ], prepare(v, c) {
        if (v.kind === 'Presença' && !v.attendance_status) throw new Error('Escolha a presença na aula.');
        if (v.kind !== 'Presença') { v.attendance_status = null; if (row && row.attendance_status != null) c.attendance_status = null; }
        if (!row) v.enrollment_id = enrollment.id;
      }, after: load });
    const sync = () => { modal.querySelector('[name="attendance_status"]').closest('label').hidden = modal.querySelector('[name="kind"]').value !== 'Presença'; };
    modal.querySelector('[name="kind"]').addEventListener('change', sync); sync();
  }
  W.bind(app, { change(key, value) { state[key] = value; render(); }, async action(action, id) {
    if (action === 'reload') return D.session ? load() : location.reload();
    if (action === 'go') return app.route(id);
    if (action === 'clear') { state.classId = []; state.status = []; state.level = []; state.risk = []; state.query = ''; state.classScope = 'active'; state.studentScope = 'current'; app.resetSearch(); render(); return; }
    if (action === 'active-filter-remove') { const [key, value] = JSON.parse(id); if (Array.isArray(state[key])) state[key] = state[key].filter((v) => v !== value); render(); return; }
    if (action === 'display') { state.display = id; render(); return; }
    if (action === 'class-scope') { state.classScope = ['active', 'all', 'closed'].includes(id) ? id : 'active'; render(); return; }
    if (action === 'student-scope') { state.studentScope = ['current', 'all', 'closed'].includes(id) ? id : 'current'; state.status = ''; render(); return; }
    if (action === 'class-detail') return classDetail(cls(id));
    if (action === 'edit-class') return editClass(cls(id));
    if (action === 'enrollment-detail') return enrollmentDetail(W.find(state.enrollments, id));
    if (action === 'edit-enrollment') return editEnrollment(W.find(state.enrollments, id));
    if (action === 'enroll-in-class') return editEnrollment(null, id);
    if (action === 'new-update') return editUpdate(null, id);
    if (action === 'edit-update') return editUpdate(W.find(state.updates, id));
  } });
  app.onRoute(render);
  W.start(app, async () => {
    await load();
    const params = new URLSearchParams(location.search), talent = params.get('talent'), enrollment = params.get('enrollment');
    if (!state.openedInitial && (talent || enrollment)) {
      state.openedInitial = true;
      const found = enrollment ? W.find(state.enrollments, enrollment) : state.enrollments.find((r) => M.same(r.candidate_id, talent) && current(r)) || state.enrollments.find((r) => M.same(r.candidate_id, talent));
      if (found) enrollmentDetail(found); else U.toast('Este talento ainda não possui matrícula.', '', 6000);
    }
  }, [D.TABLES.classes, D.TABLES.enrollments, D.TABLES.courseUpdates, D.TABLES.candidates, D.TABLES.contacts]);
})();
