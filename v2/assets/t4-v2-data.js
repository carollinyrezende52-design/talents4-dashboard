(function () {
  'use strict';

  const SUPABASE_URL = 'https://xcxqtjzlqmncwnhbolnl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjeHF0anpscW1uY3duaGJvbG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTU4NjQsImV4cCI6MjA4OTE3MTg2NH0.TJ1KB6mwSE-wu3EBO8UfP7br6byIloDsr0ejJ4_3luc';
  const ROOT_LOGIN = '../index.html';
  const DEFAULT_TIMEOUT = 9_000;

  const TABLES = Object.freeze({
    candidates: 'candidatos',
    employers: 'employers',
    openings: 'employer_openings',
    matches: 'talent_opportunity_matches',
    legacyMatches: 'candidate_employer_matches',
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
    users: 'usuarios'
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
      'tipo_de_candidato', 'tipo_vaga_preferido', 'cv_drive_web_link', 'cv_drive_file_name'
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
    courseUpdates: '*'
  });

  let client = null;
  let session = null;
  let profile = null;
  let appRef = null;
  let authSubscription = null;
  const channels = new Set();
  const optionalMissing = new Set();

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
      || /relation .* does not exist|could not find the table|schema cache/i.test(text);
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
    const target = new URL(ROOT_LOGIN, location.href);
    if (reason) target.searchParams.set('notice', reason);
    location.replace(target.href);
  }

  async function loadProfile(currentSession) {
    const username = userNameFromSession(currentSession);
    if (!username) return { username: '', nome: currentSession.user.email || 'Usuário', role: 'viewer', ativo: 'SIM' };
    const response = await withTimeout(
      client.from(TABLES.users).select('username,nome,role,color,ativo').eq('username', username).maybeSingle(),
      6_000,
      'Leitura do perfil'
    );
    if (response.error) throw response.error;
    const row = response.data;
    if (!row) throw new Error('Usuário autenticado sem perfil interno ativo.');
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

    const auth = await withTimeout(client.auth.getSession(), 7_000, 'Validação da sessão');
    if (auth.error) throw auth.error;
    session = auth.data?.session || null;
    if (!session) {
      if (options.redirect !== false) redirectToLogin('Faça login para abrir a V2.');
      throw new Error('Sessão não encontrada.');
    }

    profile = await loadProfile(session);
    app.setUser({ name: profile.nome, role: roleLabel(profile.role) });
    app.setSync('ok', 'Supabase conectado');

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
    let query = client.from(table).update(payload).eq(options.idColumn || 'id', id);
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

  async function loadCandidates(options = {}) {
    const configure = (query) => {
      let next = query.order('nome_completo', { ascending: true }).limit(options.limit || 1_500);
      if (options.activeOnly !== false) next = next.eq('ativo', true);
      return next;
    };
    try {
      return await select(TABLES.candidates, SELECTS.candidates, configure, { label: 'Leitura de Talentos', timeout: 12_000 });
    } catch (error) {
      if (!missingColumn(error)) throw error;
      return select(TABLES.candidates, '*', configure, { label: 'Leitura compatível de Talentos', timeout: 12_000 });
    }
  }

  async function loadEmployers(options = {}) {
    const configure = (query) => {
      let next = query.order('nome', { ascending: true }).limit(options.limit || 1_000);
      if (options.activeOnly !== false) next = next.eq('ativo', true);
      return next;
    };
    try {
      return await select(TABLES.employers, SELECTS.employers, configure, { label: 'Leitura de empregadores' });
    } catch (error) {
      if (!missingColumn(error)) throw error;
      return select(TABLES.employers, '*', configure, { label: 'Leitura compatível de empregadores' });
    }
  }

  async function loadOpenings(options = {}) {
    const configure = (query) => {
      let next = query.order('order_index', { ascending: true }).limit(options.limit || 1_000);
      if (options.includeDeleted !== true) next = next.is('deleted_at', null);
      return next;
    };
    try {
      return await select(TABLES.openings, SELECTS.openings, configure, { label: 'Leitura de oportunidades' });
    } catch (error) {
      if (!missingColumn(error)) throw error;
      return select(TABLES.openings, '*', configure, { label: 'Leitura compatível de oportunidades' });
    }
  }

  async function loadMatches(options = {}) {
    const modern = await optionalSelect(
      TABLES.matches,
      SELECTS.matches,
      (query) => query.order('updated_at', { ascending: false }).limit(options.limit || 2_000),
      { label: 'Leitura de compatibilidades' }
    );
    if (modern.available) return { rows: modern.data, modern: true };
    const legacy = await select(
      TABLES.legacyMatches,
      SELECTS.legacyMatches,
      (query) => query.order('is_primary', { ascending: false }).order('prioridade', { ascending: true }).limit(options.limit || 2_000),
      { label: 'Leitura de vínculos atuais' }
    );
    return { rows: legacy, modern: false };
  }

  async function loadActivities(options = {}) {
    return optionalSelect(
      TABLES.activities,
      SELECTS.activities,
      (query) => {
        let next = query.order('due_at', { ascending: true }).limit(options.limit || 1_000);
        if (options.openOnly) next = next.neq('status', 'Concluída').neq('status', 'Cancelada');
        return next;
      },
      { label: 'Leitura de atividades' }
    );
  }

  async function loadContacts(options = {}) {
    return select(TABLES.contacts, SELECTS.contacts, (query) => {
      let next = query.order('display_name', { ascending: true }).limit(options.limit || 2_000);
      if (options.includeArchived !== true) next = next.is('archived_at', null);
      return next;
    }, { label: 'Leitura da central de contatos' });
  }

  async function loadCourse() {
    const [classes, enrollments, updates] = await Promise.all([
      select(TABLES.classes, SELECTS.classes, (query) => query.order('start_date', { ascending: false }).limit(500), { label: 'Leitura de turmas' }),
      select(TABLES.enrollments, SELECTS.enrollments, (query) => query.order('updated_at', { ascending: false }).limit(2_000), { label: 'Leitura de matrículas' }),
      select(TABLES.courseUpdates, SELECTS.courseUpdates, (query) => query.order('event_date', { ascending: false }).limit(2_000), { label: 'Leitura do histórico de alemão' })
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
    optionalSelect,
    insert,
    update,
    upsert,
    softDelete,
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
    get optionalMissing() { return new Set(optionalMissing); }
  });

  window.T4Data = api;
})();
