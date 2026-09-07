(function () {
  'use strict';

  const SUPABASE_URL = 'https://xcxqtjzlqmncwnhbolnl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjeHF0anpscW1uY3duaGJvbG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTU4NjQsImV4cCI6MjA4OTE3MTg2NH0.TJ1KB6mwSE-wu3EBO8UfP7br6byIloDsr0ejJ4_3luc';
  const ROOT_LOGIN = './index.html';
  const LOGIN_EMAIL_DOMAIN = 't4ops.crm';
  const DEFAULT_TIMEOUT = 15_000;

  const TABLES = Object.freeze({
    candidates: 'candidatos',
    employers: 'employers',
    openings: 'employer_openings',
    matches: 'talent_opportunity_matches',
    legacyMatches: 'candidate_employer_matches',
    legacyLinks: 'candidate_employer_links',
    plans: 'organizational_plan_entries',
    meetings: 'organizational_meetings',
    summaries: 'organizational_weekly_summaries',
    replacements: 'organizational_replacement_requests',
    tasks: 'operational_tasks',
    metrics: 'operational_metrics',
    archive: 'org_ui_state_snapshots',
    documentationNodes: 'documentation_nodes',
    activities: 'crm_activities',
    contacts: 'contact_records',
    categories: 'contact_categories',
    contactCategories: 'contact_record_categories',
    relationships: 'contact_relationships',
    interactions: 'contact_interactions',
    followups: 'contact_followups',
    classes: 'german_course_classes',
    enrollments: 'german_course_enrollments',
    courseUpdates: 'german_course_updates',
    users: 'usuarios',
    poPlans: 'operational_plans',
    poMembers: 'operational_plan_members',
    taskResponsibles: 'operational_task_responsibles',
    notifications: 'crm_notifications',
    chatConversations: 'crm_chat_conversations',
    chatParticipants: 'crm_chat_participants',
    chatMessages: 'crm_chat_messages',
    systemSettings: 't4_system_settings'
  });

  const SELECTS = Object.freeze({
    candidates: [
      'id', 'nome_completo', 'ativo', 'email', 'telefone', 'cidade_atual', 'pais_de_origem', 'idade',
      'status_pipeline', 'substatus', 'status_final', 'data_da_candidatura', 'data_entrada_etapa_atual',
      'ultima_atualizacao', 'responsavel_interno', 'prioridade_comercial', 'perfil', 'nivel_alemao',
      'em_curso_de_alemao', 'nivel_alvo', 'previsao_termino_alemao', 'resultado_da_prova',
      'area_profissional', 'profissao_principal', 'resumo_rh_curto', 'documentacao_completa',
      'pendencia_documental_critica', 'elegivel_para_employer', 'pronto_para_employer',
      'readiness_internacional', 'risco_desistencia', 'disponibilidade_mudanca', 'status_employer',
      'retorno_employer', 'data_envio_employer', 'motivo_inativacao', 'data_inativacao', 'reativavel',
      'tipo_de_candidato', 'tipo_vaga_preferido', 'cv_drive_web_link', 'cv_drive_file_name', 'crm_scope'
    ].join(','),
    employers: [
      'id', 'nome', 'nome_normalizado', 'ativo', 'tipo', 'status', 'area_atuacao', 'subsetor', 'cidade', 'pais',
      'nivel_alemao_minimo', 'vagas_abertas', 'responsavel_interno', 'contato_principal', 'email_principal',
      'telefone', 'site', 'descricao_resumida', 'prioridade_comercial', 'origem_lead', 'data_ultimo_contato',
      'perfis_buscados', 'requisitos_principais', 'diferenciais_desejaveis', 'observacoes_internas',
      'created_at', 'updated_at', 'deleted_at'
    ].join(','),
    openings: [
      'id', 'employer_id', 'title', 'quantity', 'status', 'order_index', 'is_active', 'deleted_at',
      'location', 'area', 'external_url', 'language_requirement', 'recognition_requirement',
      'verified_at', 'description', 'source', 'created_at', 'updated_at'
    ].join(','),
    matches: [
      'id', 'talent_id', 'opening_id', 'employer_id', 'stage', 'status', 'priority', 'overall_score',
      'professional_score', 'language_score', 'mobility_score', 'document_score', 'viability',
      'reasons', 'barriers', 'next_action', 'next_action_at', 'owner_username', 'sent_at', 'responded_at',
      'created_at', 'updated_at'
    ].join(','),
    legacyMatches: [
      'id', 'candidato_id', 'empregador_id', 'status_vinculo', 'prioridade', 'match_strength', 'is_primary',
      'data_envio', 'data_retorno', 'elegivel', 'motivo_encaixe', 'riscos_ressalvas', 'proxima_acao',
      'observacoes', 'created_at', 'updated_at'
    ].join(','),
    activities: [
      'id', 'title', 'activity_type', 'status', 'priority', 'due_at', 'completed_at', 'owner_username',
      'talent_id', 'employer_id', 'opening_id', 'contact_id', 'enrollment_id', 'notes', 'outcome',
      'created_by', 'created_at', 'updated_at'
    ].join(','),
    contacts: '*',
    categories: '*',
    contactCategories: '*',
    interactions: '*',
    followups: '*',
    classes: '*',
    enrollments: '*',
    courseUpdates: '*',
    users: 'username,nome,role,ativo'
  });

  let client = null;
  let session = null;
  let profile = null;
  let appRef = null;
  let authSubscription = null;
  const channels = new Set();
  const optionalMissing = new Set();
  const readWarnings = new Map();

  function withTimeout(promise, timeout = DEFAULT_TIMEOUT, label = 'Operação') {
    let timer;
    const gate = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(timeout / 1000)} segundos.`)), timeout);
    });
    return Promise.race([promise, gate]).finally(() => clearTimeout(timer));
  }

  function missingRelation(error) {
    const text = String(error?.message || error || '');
    return error?.code === '42P01'
      || error?.code === 'PGRST205'
      || /relation .* does not exist|could not find the table/i.test(text);
  }

  function missingColumn(error) {
    const text = String(error?.message || error || '');
    return error?.code === '42703' || /column .* does not exist|could not find.*column/i.test(text);
  }

  function activeValue(value) {
    if (value == null) return true;
    if (typeof value === 'boolean') return value;
    return !/^(n[aã]o|no|false|0|inativo)$/i.test(String(value).trim());
  }

  function userNameFromSession(current) {
    return current?.user?.user_metadata?.username
      || current?.user?.email?.split('@')[0]
      || '';
  }

  function roleLabel(role) {
    return ({ admin: 'Administrador', recrutador: 'Recrutador', viewer: 'Visualizador' })[role] || role || 'Visualizador';
  }

  function redirectToLogin(reason = '') {
    if (window.T4_DEMO) { location.reload(); return; }
    const target = new URL(ROOT_LOGIN, location.href);
    if (reason) target.searchParams.set('notice', reason);
    location.replace(target.href);
  }

  function isLoginPage() {
    return new URL(ROOT_LOGIN, location.href).pathname === location.pathname;
  }

  function renderLoginForm(app) {
    const esc = window.T4V2?.esc || ((v) => String(v ?? ''));
    const notice = new URLSearchParams(location.search).get('notice') || '';
    app.setSync('error', 'Login necessário');
    app.pageRoot.innerHTML = `
      <div class="t4-login-screen">
        <form class="t4-login-card" data-login-form novalidate>
          <h1 class="t4-login-title">Talents 4</h1>
          ${notice ? `<p class="t4-login-notice">${esc(notice)}</p>` : ''}
          <label class="t4-field"><span class="t4-field-label">Usuário</span><span class="t4-field-control"><input type="text" name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus></span></label>
          <label class="t4-field"><span class="t4-field-label">Senha</span><span class="t4-field-control"><input type="password" name="password" autocomplete="current-password" required></span></label>
          <p class="t4-login-error" data-login-error hidden></p>
          <button type="submit" class="t4-btn primary t4-login-submit">Entrar</button>
        </form>
      </div>`;
    const form = app.pageRoot.querySelector('[data-login-form]');
    const errorBox = form.querySelector('[data-login-error]');
    const submitButton = form.querySelector('.t4-login-submit');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      submitButton.disabled = true;
      submitButton.textContent = 'Entrando…';
      try {
        const typed = form.username.value.trim();
        const email = typed.includes('@') ? typed : `${typed}@${LOGIN_EMAIL_DOMAIN}`;
        const { error } = await client.auth.signInWithPassword({ email, password: form.password.value });
        if (error) throw error;
        location.href = `${ROOT_LOGIN}?view=overview`;
      } catch (error) {
        errorBox.textContent = /invalid login credentials/i.test(error?.message || '')
          ? 'Usuário ou senha incorretos.'
          : (error?.message || 'Não foi possível entrar. Tente novamente.');
        errorBox.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = 'Entrar';
      }
    });
  }

  async function loadProfile(currentSession) {
    const username = userNameFromSession(currentSession);
    if (!username) throw new Error('A sessão não identifica um perfil interno. Entre novamente pelo CRM.');
    const response = await withTimeout(
      client.from(TABLES.users).select('username,nome,role,color,ativo').eq('username', username).maybeSingle(),
      12_000,
      'Leitura do perfil'
    );
    if (response.error) throw response.error;
    const row = response.data;
    if (!row || !['admin', 'recrutador', 'viewer'].includes(row.role)) throw new Error('Usuário autenticado sem perfil interno autorizado.');
    if (row.ativo != null && !activeValue(row.ativo)) throw new Error('Perfil interno desativado.');
    return {
      username,
      nome: row.nome || currentSession.user.user_metadata?.name || currentSession.user.email || username,
      role: row.role || 'viewer',
      color: row.color || '#002A4A',
      ativo: row.ativo ?? 'SIM'
    };
  }

  async function init(app, options = {}) {
    if (!window.supabase?.createClient) throw new Error('Biblioteca do Supabase não carregou.');
    appRef = app;
    app.setSync('loading', 'Validando sessão');
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'x-application-name': 'talents4-crm-v2' } }
    });

    const auth = await withTimeout(client.auth.getSession(), 12_000, 'Validação da sessão');
    if (auth.error) throw auth.error;
    session = auth.data?.session || null;
    if (!session) {
      if (isLoginPage()) { renderLoginForm(app); return new Promise(() => {}); }
      if (options.redirect !== false) redirectToLogin('Faça login para abrir a V2.');
      throw new Error('Sessão não encontrada.');
    }

    if (!window.T4_DEMO) {
      const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
      const onMeuDia = isLoginPage() && new URLSearchParams(location.search).get('view') === 'overview';
      if (isReload && !onMeuDia) { location.replace(new URL(`${ROOT_LOGIN}?view=overview`, location.href).href); return new Promise(() => {}); }
    }

    profile = await loadProfile(session);
    app.setUser({ name: profile.nome, role: roleLabel(profile.role) });
    app.setSync('ok', 'Supabase conectado');
    if (typeof document?.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      document.dispatchEvent(new CustomEvent('t4:ready', { detail: { profile } }));
    }

    authSubscription?.unsubscribe?.();
    const listener = client.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession;
      if (event === 'SIGNED_OUT' || !nextSession) redirectToLogin('Sessão encerrada.');
    });
    authSubscription = listener.data?.subscription || null;
    document.addEventListener('t4:logout', logout, { once: true });
    return api;
  }

  async function logout() {
    try { await client?.auth.signOut(); } finally { redirectToLogin('Sessão encerrada.'); }
  }

  function assertReady() {
    if (!client || !session) throw new Error('Supabase ainda não foi inicializado.');
  }

  function assertEdit() {
    if (!canEdit()) throw new Error('Seu perfil possui acesso somente para leitura.');
  }

  function canEdit() { return ['admin', 'recrutador'].includes(profile?.role); }
  function canAdmin() { return profile?.role === 'admin'; }

  async function select(table, columns = '*', configure = null, options = {}) {
    assertReady();
    let query = client.from(table).select(columns, options.selectOptions || undefined);
    if (configure) query = configure(query);
    const response = await withTimeout(query, options.timeout || DEFAULT_TIMEOUT, options.label || `Leitura de ${table}`);
    if (response.error) throw response.error;
    return response.data || [];
  }

  // PostgREST pode limitar cada resposta a 1.000 linhas. Nunca transformar um
  // recorte silencioso em "todos os dados". A ordenação precisa ser estável.
  async function all(table, columns = '*', configure = null, options = {}) {
    const size = options.pageSize || 500;
    const max = options.maxRows || 20000;
    const rows = [];
    for (let offset = 0; offset <= max;) {
      const page = await select(table, columns, (query) => {
        let next = configure ? configure(query) : query;
        for (const key of options.orderKeys || ['id']) next = next.order(key, { ascending: true });
        return next.range(offset, offset + size - 1);
      }, options);
      rows.push(...page);
      if (rows.length > max) throw new Error(`Há mais de ${max} registros em ${table}. A carga foi interrompida para não apresentar totais incompletos.`);
      if (!page.length || page.length < size) return rows;
      offset += page.length;
    }
    throw new Error(`Não foi possível concluir a paginação de ${table}.`);
  }

  async function optionalAll(table, columns = '*', configure = null, options = {}) {
    try { return { data: await all(table, columns, configure, options), available: true }; }
    catch (error) {
      if (!missingRelation(error)) throw error;
      optionalMissing.add(table);
      return { data: [], available: false, error };
    }
  }

  async function one(table, id, columns = '*') {
    const rows = await select(table, columns, (q) => q.eq('id', id).limit(1));
    if (!rows.length) throw new Error('Registro não encontrado ou sem permissão de leitura.');
    return rows[0];
  }

  async function optionalSelect(table, columns = '*', configure = null, options = {}) {
    if (optionalMissing.has(table)) return { data: [], available: false, error: null };
    try {
      const data = await select(table, columns, configure, options);
      return { data, available: true, error: null };
    } catch (error) {
      if (missingRelation(error)) {
        optionalMissing.add(table);
        return { data: [], available: false, error };
      }
      throw error;
    }
  }

  async function insert(table, payload, options = {}) {
    assertReady();
    assertEdit();
    let query = client.from(table).insert(payload);
    if (options.select !== false) query = query.select(options.columns || '*');
    if (options.single !== false && options.select !== false) query = query.single();
    const response = await withTimeout(query, options.timeout || DEFAULT_TIMEOUT, options.label || `Inclusão em ${table}`);
    if (response.error) throw response.error;
    return response.data;
  }

  async function update(table, id, payload, options = {}) {
    assertReady();
    assertEdit();
    if (options.expectedUpdatedAt && options.select === false) throw new Error('A verificação de concorrência exige retornar o registro atualizado.');
    let query = client.from(table).update(payload).eq(options.idColumn || 'id', id);
    if (options.expectedUpdatedAt) query = query.eq(options.expectedColumn || 'updated_at', options.expectedUpdatedAt);
    if (options.select !== false) query = query.select(options.columns || '*');
    if (options.single !== false && options.select !== false) query = query.single();
    const response = await withTimeout(query, options.timeout || DEFAULT_TIMEOUT, options.label || `Atualização em ${table}`);
    if (response.error) throw response.error;
    return response.data;
  }

  async function upsert(table, payload, options = {}) {
    assertReady();
    assertEdit();
    let query = client.from(table).upsert(payload, options.onConflict ? { onConflict: options.onConflict } : undefined);
    if (options.select !== false) query = query.select(options.columns || '*');
    if (options.single && options.select !== false) query = query.single();
    const response = await withTimeout(query, options.timeout || DEFAULT_TIMEOUT, options.label || `Gravação em ${table}`);
    if (response.error) throw response.error;
    return response.data;
  }

  async function softDelete(table, id, fields = {}) {
    return update(table, id, { ...fields, deleted_at: new Date().toISOString() }, { select: false });
  }

  async function removeAssociation(table, filters) {
    assertReady(); assertEdit();
    const allowed = table === TABLES.contactCategories ? ['contact_id', 'category_id'] : table === TABLES.relationships ? ['id'] : null;
    if (!allowed || !allowed.every((key) => filters?.[key])) throw new Error('A remoção exige uma associação exata; cadastros não podem ser excluídos por esta função.');
    let query = client.from(table).delete();
    for (const key of allowed) query = query.eq(key, filters[key]);
    const result = await withTimeout(query.select(), DEFAULT_TIMEOUT, 'Remoção da associação');
    if (result.error) throw result.error;
    if (!result.data?.length) throw new Error('Associação não encontrada ou sem permissão de remoção.');
    return result.data;
  }

  async function loadCandidates(options = {}) {
    const configure = (query) => {
      let next = query.order('nome_completo', { ascending: true });
      if (options.activeOnly !== false) next = next.eq('ativo', true);
      return next;
    };
    let columns = SELECTS.candidates.split(',');
    const absent = [];
    // Retirar somente a coluna que o servidor confirmou não existir. Uma
    // diferença de esquema não pode ocultar todos os demais campos da lista.
    while (columns.length) {
      try {
        const rows = await all(TABLES.candidates, columns.join(','), configure, { label: 'Leitura de Talentos', timeout: 12_000 });
        if (absent.length) readWarnings.set('candidates', `Talentos: campos ausentes neste esquema (${absent.join(', ')}). Os demais campos continuam carregados; confirme o esquema antes de avaliar totais dependentes desses campos.`);
        else readWarnings.delete('candidates');
        return rows;
      } catch (error) {
        const message = String(error?.message || '');
        const missing = message.match(/column\s+(?:\w+\.)?["']?(\w+)["']?\s+does not exist/i)?.[1]
          || message.match(/could not find the ['"](\w+)['"] column/i)?.[1];
        if (!missingColumn(error) || !missing || !columns.includes(missing) || ['id', 'nome_completo', 'ativo'].includes(missing)) throw error;
        absent.push(missing); columns = columns.filter((name) => name !== missing);
      }
    }
    throw new Error('Não foi possível reconhecer o esquema de talentos.');
  }

  async function loadEmployers(options = {}) {
    const configure = (query) => {
      let next = query.order('nome', { ascending: true });
      if (options.activeOnly !== false) next = next.eq('ativo', true);
      return next;
    };
    const classificationColumns = ['presented_by_nectanet', 'source_channel', 'direct_talents4_partnership', 'partnership_status', 'company_scope', 'classification_confidence', 'classification_source', 'classification_notes'];
    try {
      const rows = await all(TABLES.employers, '*', configure, { label: 'Leitura de empregadores' });
      const hasClassificationColumns = rows.length > 0 && classificationColumns.some((key) => Object.prototype.hasOwnProperty.call(rows[0], key));
      if (rows.length > 0 && !hasClassificationColumns) readWarnings.set('employer-classification', 'Empregadores: as colunas de classificação ainda não existem neste Supabase. As empresas aparecem como “Classificação pendente”; nenhuma parceria foi presumida.');
      else readWarnings.delete('employer-classification');
      return rows;
    } catch (error) {
      if (!missingColumn(error)) throw error;
      return all(TABLES.employers, '*', configure, { label: 'Leitura compatível de empregadores' });
    }
  }

  async function loadOpenings(options = {}) {
    const configure = (query) => {
      let next = query.order('order_index', { ascending: true });
      if (options.includeDeleted !== true) next = next.is('deleted_at', null);
      return next;
    };
    try {
      return await all(TABLES.openings, '*', configure, { label: 'Leitura de oportunidades' });
    } catch (error) {
      if (!missingColumn(error)) throw error;
      return all(TABLES.openings, '*', configure, { label: 'Leitura compatível de oportunidades' });
    }
  }

  async function loadMatches(options = {}) {
    const [modern, legacy, links] = await Promise.all([
      optionalAll(TABLES.matches), optionalAll(TABLES.legacyMatches), optionalAll(TABLES.legacyLinks)
    ]);
    return { rows: window.T4Models.mergeMatches(modern.data, legacy.data, links.data), modern: modern.available,
      sources: { modern: modern.available, legacy: legacy.available, links: links.available },
      warnings: [[modern, 'Seleções por vaga'], [legacy, 'Vínculos anteriores do CRM'], [links, 'Vínculos anteriores do Organizacional']].filter(([source]) => !source.available).map(([, name]) => `${name}: fonte não disponível; os totais incluem apenas as fontes acessíveis.`) };
  }

  async function loadActivities(options = {}) {
    const result = await optionalAll(
      TABLES.activities,
      '*',
      (query) => {
        let next = query.order('due_at', { ascending: true });
        if (options.openOnly) next = next.neq('status', 'Concluída').neq('status', 'Cancelada');
        return next;
      },
      { label: 'Leitura de atividades' }
    );
    if (!result.available) return result;
    // Follow-ups existentes são vinculados ao contato no banco. Resolver os
    // vínculos canônicos na leitura permite vê-los também na ficha do talento
    // ou empregador, sem duplicar a atividade nem alterar seu registro.
    try {
      const contacts = await optionalAll(TABLES.contacts, 'id,source_system,source_record_id');
      if (!contacts.available) return { ...result, warnings: ['Vínculos dos contatos indisponíveis: algumas atividades podem aparecer sem associação ao talento ou empregador.'] };
      const byId = new Map(contacts.data.map((row) => [String(row.id), row]));
      const data = result.data.map((row) => {
        const contact = byId.get(String(row.contact_id));
        if (!contact?.source_record_id) return row;
        const source = String(contact.source_system || '').toLowerCase();
        if (['candidatos', 'candidate', 'candidates'].includes(source) && !row.talent_id) return { ...row, talent_id: contact.source_record_id, _linkedViaContact: true };
        if (['employers', 'employer'].includes(source) && !row.employer_id) return { ...row, employer_id: contact.source_record_id, _linkedViaContact: true };
        return row;
      });
      return { ...result, data };
    } catch (error) {
      return { ...result, warnings: [`Não foi possível resolver os vínculos dos contatos: ${error.message || 'falha de leitura'}. As atividades originais foram preservadas.`] };
    }
  }

  async function loadContacts(options = {}) {
    return all(TABLES.contacts, SELECTS.contacts, (query) => {
      let next = query.order('display_name', { ascending: true });
      if (options.includeArchived !== true) next = next.is('archived_at', null);
      return next;
    }, { label: 'Leitura da central de contatos' });
  }

  async function loadCourse() {
    const [classes, enrollments, updates] = await Promise.all([
      all(TABLES.classes, SELECTS.classes, (query) => query.order('start_date', { ascending: false }), { label: 'Leitura de turmas' }),
      all(TABLES.enrollments, SELECTS.enrollments, (query) => query.order('updated_at', { ascending: false }), { label: 'Leitura de matrículas' }),
      all(TABLES.courseUpdates, SELECTS.courseUpdates, (query) => query.order('event_date', { ascending: false }), { label: 'Leitura do histórico de alemão' })
    ]);
    return { classes, enrollments, updates };
  }

  function subscribe(tables, callback, options = {}) {
    assertReady();
    const name = `t4-v2-${options.name || Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let channel = client.channel(name);
    [...new Set(tables.filter(Boolean))].forEach((table) => {
      if (optionalMissing.has(table)) return;
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => callback(payload, table));
    });
    channel.subscribe();
    channels.add(channel);
    return () => {
      channels.delete(channel);
      client.removeChannel(channel);
    };
  }

  function dispose() {
    channels.forEach((channel) => client?.removeChannel(channel));
    channels.clear();
    authSubscription?.unsubscribe?.();
    authSubscription = null;
  }

  function mapMatch(row, context = {}) {
    if (!row) return null;
    if (row._source) return row;
    if ('talent_id' in row) return { ...row, modern: true };
    return {
      id: row.id,
      talent_id: row.candidato_id,
      opening_id: null,
      employer_id: row.empregador_id,
      stage: row.status_vinculo || 'Mapeado',
      status: row.status_vinculo || 'Ativo',
      priority: row.prioridade,
      overall_score: row.match_strength,
      viability: row.elegivel === false ? 'Baixa' : row.elegivel === true ? 'Alta' : 'A validar',
      reasons: row.motivo_encaixe,
      barriers: row.riscos_ressalvas,
      next_action: row.proxima_acao,
      sent_at: row.data_envio,
      responded_at: row.data_retorno,
      created_at: row.created_at,
      updated_at: row.updated_at,
      modern: false,
      legacy: row,
      ...context
    };
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.random() * 16 | 0;
      return (character === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
    });
  }

  const api = Object.freeze({
    init,
    dispose,
    logout,
    select,
    all,
    one,
    optionalAll,
    optionalSelect,
    insert,
    update,
    upsert,
    softDelete,
    removeAssociation,
    loadCandidates,
    loadEmployers,
    loadOpenings,
    loadMatches,
    loadActivities,
    loadContacts,
    loadCourse,
    subscribe,
    mapMatch,
    canEdit,
    canAdmin,
    activeValue,
    missingRelation,
    missingColumn,
    withTimeout,
    uuid,
    TABLES,
    SELECTS,
    get client() { return client; },
    get session() { return session; },
    get profile() { return profile; },
    get readWarnings() { return [...readWarnings.values()]; },
    get optionalMissing() { return new Set(optionalMissing); }
  });

  window.T4Data = api;
})();
