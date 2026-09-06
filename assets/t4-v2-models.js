/* Regras puras compartilhadas pelas quatro áreas. Sem rede e sem gravações. */
(function () {
  'use strict';
  const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const same = (a, b) => a != null && b != null && String(a) === String(b);
  const active = (v) => v == null || !['false', '0', 'nao', 'no', 'inativo'].includes(norm(v));
  // `crm_scope` separates the operational Talent queue from the general
  // intake bucket. Missing values remain compatible with the pre-migration
  // database and are treated as Talents until the additive migration fills
  // the column explicitly.
  const talentScope = (row = {}) => {
    const value = norm(row.crm_scope);
    if (!value) return 'talento';
    return ['talento', 'talent', 'operacional'].includes(value) ? 'talento' : 'balde';
  };
  const isTalent = (row = {}) => talentScope(row) === 'talento';
  const scopeLabel = (row = {}) => isTalent(row) ? 'Talento' : 'Balde';
  // A database flag alone is not enough to determine whether a record should
  // appear in the working queue. Legacy imports often keep ativo=true while
  // the lifecycle field says Inativo, Arquivado, Excluído or Cancelado.
  const negativeLifecycle = (value) => /^(inativ|arquiv|exclu|cancel|desist|rejeit|removid|encerr)/.test(norm(value));
  const activeRecord = (row = {}) => active(row.ativo) && !row.deleted_at && !row.data_inativacao && !negativeLifecycle(row.status_pipeline || row.lifecycle_status || row.status);
  const present = (v) => v !== null && v !== undefined && String(v).trim() !== '';
  const finite = (v) => present(v) && Number.isFinite(Number(v));
  const number = (v) => finite(v) ? Number(v) : null;
  const dateOnly = (v) => {
    const raw = String(v || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return '';
    if (raw.length === 10) return raw;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function isOpen(status) {
    return !/^(concluid[oa]|cancelad[oa]|pronto|contratado|rejeitado|removido|excluid[oa]|desistente|transferido|arquivado|encerrado|inativo)$/.test(norm(status));
  }
  const overdue = (date, status, now = today()) => isOpen(status) && !!dateOnly(date) && dateOnly(date) < now;
  function riskReasons(row, now = today()) {
    if (!['matriculado', 'ativo', 'pausado'].includes(norm(row?.status))) return [];
    const reasons = [];
    if (norm(row.risk_level) === 'alto') reasons.push('Risco alto informado');
    if (['atencao', 'critico'].includes(norm(row.performance))) reasons.push(`Desempenho: ${row.performance}`);
    if (finite(row.attendance_percent) && Number(row.attendance_percent) < 75) reasons.push('Presença abaixo de 75%');
    if (dateOnly(row.next_action_due) && dateOnly(row.next_action_due) < now) reasons.push('Acompanhamento vencido');
    return reasons;
  }
  function canonicalMatch(row, source) {
    const modern = source === 'talent_opportunity_matches';
    const link = source === 'candidate_employer_links';
    const stage = modern ? row.stage : row.status_vinculo || row.resultado || 'Sem etapa';
    return {
      ...row, id: row.id, key: `${source}:${row.id}`, _source: source, modern,
      talent_id: modern ? row.talent_id : link ? row.candidate_id : row.candidato_id,
      employer_id: modern || link ? row.employer_id : row.empregador_id,
      opening_id: modern ? row.opening_id : null,
      stage, status: modern ? row.status : !active(row.ativo) || row.deleted_at ? 'Inativo' : 'Ativo',
      viability: row.viability || (row.elegivel === true ? 'Alta' : row.elegivel === false ? 'Baixa' : 'A validar'),
      overall_score: row.overall_score ?? row.match_strength ?? null,
      owner_username: row.owner_username || row.responsavel_interno || '',
      next_action: row.next_action || row.proxima_acao || '',
      next_action_at: row.next_action_at || row.proximo_followup_em || null,
      sent_at: row.sent_at || row.data_envio || row.apresentado_em || null,
      responded_at: row.responded_at || row.data_retorno || null,
      priority: row.priority || row.prioridade || '',
      reasons: row.reasons || row.motivo_encaixe || row.motivo_match || '',
      barriers: row.barriers || row.riscos_ressalvas || '',
      notes: row.notes || row.observacoes || row.observacao_rh || '',
      sources: [{ table: source, row }]
    };
  }
  function mergeMatches(modern = [], legacy = [], links = []) {
    const out = modern.map((row) => canonicalMatch(row, 'talent_opportunity_matches'));
    const pairs = new Map();
    for (const raw of legacy) {
      const row = canonicalMatch(raw, 'candidate_employer_matches');
      out.push(row);
      const key = `${row.talent_id}|${row.employer_id}`;
      // O CRM anterior priorizava matches sobre links. Preservamos os dois
      // originais dentro de sources, sem sobrescrever registros no banco.
      if (!pairs.has(key)) pairs.set(key, row);
    }
    for (const raw of links) {
      const row = canonicalMatch(raw, 'candidate_employer_links');
      const key = `${row.talent_id}|${row.employer_id}`;
      const existing = pairs.get(key);
      if (!existing) { out.push(row); continue; }
      existing.sources.push(...row.sources);
      if (norm(existing.stage) !== norm(row.stage)) existing.sourceConflict = true;
      for (const key of ['owner_username', 'next_action', 'next_action_at', 'sent_at', 'responded_at', 'reasons', 'barriers', 'notes']) {
        if (!present(existing[key])) existing[key] = row[key];
      }
    }
    return out;
  }
  function selectionBucket(row) {
    const status = norm(`${row.stage} ${row.status}`);
    if (/rejeit|removid|exclu|cancel|inativo|arquiv|encerr|fechad|desist|nao aprovado/.test(status)) return 'closed';
    if (/contrat|admitid/.test(status)) return 'hired';
    // "Não gostou" continua no acompanhamento: é uma etapa real do vínculo,
    // não um registro excluído/removido. Deve vir antes de "gostou" porque
    // a palavra também contém o trecho "gostou".
    if (/nao gost/.test(status)) return 'sent';
    if (/proposta|oferta|aprov|gostou/.test(status)) return 'offer';
    if (/entrevista|reuniao/.test(status)) return 'interview';
    if (/enviad|apresentad|aguardando resposta|aguardando retorno|em processo/.test(status)) return 'sent';
    return 'review';
  }
  const SELECTION_COLUMNS = [
    { id: 'review', name: 'Em análise', stage: 'Em análise', tone: 'neutral' },
    { id: 'sent', name: 'Apresentados', stage: 'Enviado', tone: 'info' },
    { id: 'interview', name: 'Entrevistas', stage: 'Entrevista', tone: 'purple' },
    { id: 'offer', name: 'Propostas', stage: 'Proposta', tone: 'warning' },
    { id: 'hired', name: 'Contratados', stage: 'Contratado', tone: 'success' }
  ];
  function buildContacts(candidates = [], employers = [], contacts = [], categories = [], links = []) {
    const used = new Set();
    const cats = new Map(categories.map((r) => [String(r.id), r.name === 'Candidato' ? 'Talento' : r.name]));
    const rolesFor = (ids) => [...new Set(links.filter((r) => ids.some((id) => same(id, r.contact_id))).map((r) => cats.get(String(r.category_id))).filter(Boolean))];
    const result = [];
    function pushSource(raw, kind, aliases) {
      const attached = contacts.filter((r) => aliases.includes(norm(r.source_system)) && same(r.source_record_id, raw.id));
      attached.forEach((r) => used.add(String(r.id)));
      const link = attached[0] || null;
      const isTalent = kind === 'talent';
      const role = isTalent ? 'Talento' : 'Empregador';
      const name = isTalent ? raw.nome_completo : raw.nome;
      result.push({
        key: `${kind}:${raw.id}`, source: kind, sourceId: raw.id, contactId: link?.id || null,
        contactIds: attached.map((r) => r.id), raw, link, linkedRecords: attached,
        displayName: name || `${role} sem nome`, entityType: isTalent ? 'Pessoa' : 'Organização',
        email: (isTalent ? raw.email : raw.email_principal) || link?.email || '',
        phone: (isTalent ? raw.telefone : raw.telefone) || link?.phone || '',
        city: (isTalent ? raw.cidade_atual : raw.cidade) || link?.city || '',
        jobTitle: (isTalent ? raw.profissao_principal || raw.area_profissional : raw.area_atuacao) || link?.job_title || '',
        status: !activeRecord(raw) || raw.deleted_at || raw.data_inativacao ? 'Arquivado' : link?.archived_at ? 'Arquivado' : link?.status || 'Ativo',
        stage: link?.relationship_stage || 'Relacionamento',
        owner: raw.responsavel_interno || link?.owner_username || '',
        roles: [...new Set([role, ...rolesFor(attached.map((r) => r.id))])],
        organization: contacts.find((r) => same(r.id, link?.primary_organization_id))?.display_name || '',
        unresolved: false
      });
    }
    candidates.forEach((r) => pushSource(r, 'talent', ['candidatos', 'candidate', 'candidates']));
    employers.forEach((r) => pushSource(r, 'employer', ['employers', 'employer']));
    contacts.filter((r) => !used.has(String(r.id))).forEach((r) => result.push({
      key: `contact:${r.id}`, source: 'contact', sourceId: r.id, contactId: r.id, contactIds: [r.id], raw: r, link: r,
      displayName: r.display_name || 'Contato sem nome', entityType: r.entity_type || 'Pessoa',
      email: r.email || '', phone: r.phone || r.whatsapp || '', city: r.city || '', jobTitle: r.job_title || '',
      status: r.archived_at ? 'Arquivado' : r.status || 'Ativo', stage: r.relationship_stage || 'Novo', owner: r.owner_username || '',
      roles: rolesFor([r.id]), organization: contacts.find((o) => same(o.id, r.primary_organization_id))?.display_name || '',
      unresolved: !!r.source_system, linkedRecords: [r]
    }));
    return result.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }
  function duplicateGroups(rows) {
    const keys = new Map();
    const put = (key, row, type, value) => {
      if (!key) return;
      if (!keys.has(key)) keys.set(key, { type, value, rows: [] });
      const group = keys.get(key);
      if (!group.rows.some((r) => r.key === row.key)) group.rows.push(row);
    };
    for (const row of rows) {
      const related = row.linkedRecords?.length ? row.linkedRecords : [row.link || {}];
      for (const raw of related) {
        for (const value of [row.email, raw.email, raw.secondary_email]) {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '')) put(`email:${norm(value)}`, row, 'E-mail', value);
        }
        for (const value of [row.phone, raw.phone, raw.whatsapp]) {
          const digits = String(value || '').replace(/\D/g, '');
          if (digits.length >= 8 && !/^(\d)\1+$/.test(digits)) put(`phone:${digits}`, row, 'Telefone', value);
        }
      }
    }
    return [...keys.values()].filter((g) => g.rows.length > 1);
  }
  function safeUrl(value) {
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; }
    catch (_) { return ''; }
  }
  function snapshotEntries(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
    const p = payload.state && typeof payload.state === 'object' ? payload.state : payload;
    const allowed = ['employers', 'planEntries', 'meetings', 'weeklySummaries', 'operationalTasks', 'operationalMetrics', 'opTasks', 'opMetrics', 'dossiers'];
    return Object.fromEntries(allowed.filter((key) => p[key] != null).map((key) => [key, p[key]]));
  }
  window.T4Models = Object.freeze({ norm, same, active, negativeLifecycle, activeRecord, talentScope, isTalent, scopeLabel, present, finite, number, dateOnly, today, isOpen, overdue,
    riskReasons, mergeMatches, canonicalMatch, selectionBucket, SELECTION_COLUMNS, buildContacts, duplicateGroups, safeUrl, snapshotEntries });
})();
