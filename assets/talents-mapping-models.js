/* Talentos 2.2 · contratos das duas planilhas. Sem rede, gravação ou dados reais. */
(function () {
  'use strict';
  const M = window.T4Models;
  const TABLES = Object.freeze({ profiles: 'talent_mapping_profiles', items: 'talent_mapping_items', partners: 'talent_mapping_partners' });
  const YES = ['Sim', 'Não'];
  const FIELDS = {
    presentation: [
      ['lista_nectanet', 'Lista Nectanet', 'profile', 'select', YES],
      ['nome_completo', 'Nome', 'talent'],
      ['visto', 'Visto', 'profile'],
      ['profissional_qualificado', 'Profissional Qualificado', 'profile', 'select', ['Fachkraft', 'Azubi', 'Junior', 'Técnico', 'Não']],
      ['novo_cv', 'Novo CV', 'profile', 'select', ['Feito', 'Não feito']],
      ['cv_drive_web_link', 'CV', 'talent', 'url'],
      ['idade', 'Idade', 'talent'],
      ['area_profissional', 'Área principal', 'talent'],
      ['cluster', 'Cluster', 'profile'],
      ['experiencia_profissional_tempo', 'Anos de experiência', 'talent'],
      ['nivel_alemao', 'Alemão', 'talent'],
      ['ingles', 'Inglês', 'profile'],
      ['outros_idiomas', 'Outros idiomas', 'profile'],
      ['employer_primary_id', 'Empresa principal', 'profile', 'employer'],
      ['employer_alt1_id', 'Empresa alternativa 1', 'profile', 'employer'],
      ['employer_alt2_id', 'Empresa alternativa 2', 'profile', 'employer'],
      ['perfil_profissional_para_apresentacao', 'Resumo do Talento', 'talent', 'textarea'],
      ['observacao_apresentacao', 'Observação', 'profile', 'textarea']
    ],
    tracking: [
      ['empresa', 'Empresa', 'item', 'employer'], ['nectanet', 'NectaNet?', 'item', 'select', YES],
      ['vacancy_status', 'Status', 'item', 'select', ['ABERTA', 'FECHADA', 'SEM VAGA', 'BANCO DE TALENTOS', 'A CONFIRMAR']],
      ['professional_score', 'Aderência profissional', 'item', 'number'],
      ['current_viability_score', 'Viabilidade atual', 'item', 'number'],
      ['projected_b1_score', 'Viabilidade projetada — B1 em 3 meses', 'item', 'number'],
      ['vacancy_situation', 'Vaga / situação', 'item'], ['type_area', 'Tipo / área', 'item'],
      ['fit_reasons', 'Por que se encaixa', 'item', 'textarea'], ['barriers', 'Barreira / risco', 'item', 'textarea'],
      ['language_requirement', 'Idioma / requisito', 'item'], ['recognition_requirement', 'Anerkennung / Approbation', 'item'],
      ['location', 'Local', 'item'], ['contact', 'Contato', 'item', 'textarea'],
      ['official_url', 'Link direto / oficial', 'item', 'url'], ['verified_on', 'Verificado em', 'item', 'date']
    ],
    summary: [
      ['talent', 'Talento'], ['profile', 'Perfil'], ['mapped', 'Itens mapeados'], ['open', 'Vagas abertas'],
      ['nectanet_open', 'NectaNet abertas'], ['fit90', 'Abertas fit ≥90'], ['current60', 'Abertas viab. atual ≥60'],
      ['projected60', 'Abertas viab. B1 ≥60'], ['best_nectanet', 'Melhor NectaNet'], ['best_external', 'Melhor BW externa'],
      ['barreira_principal', 'Barreira principal'], ['prioridade_mapeamento', 'Prioridade']
    ],
    radar: [
      ['empresa', 'Empresa'], ['talent', 'Talento(s)'], ['vacancy_status', 'Status'], ['professional_score', 'Aderência'],
      ['current_viability_score', 'Viab. atual'], ['projected_b1_score', 'Viab. B1 (3 meses)'],
      ['vacancy_situation', 'Vaga / alvo'], ['barriers', 'Barreira / observação'], ['location', 'Local'],
      ['official_url', 'Link'], ['verified_on', 'Verificado em']
    ],
    partners: [
      ['source', 'nectanet source'], ['empresa', 'Unternehmen'], ['ceo_name', 'Geschäftsführer'], ['ceo_email', 'Kontakt-E-Mail'],
      ['hr_name', 'Personaler'], ['hr_email', 'Kontakt-E-Mail 2'], ['contact_status', 'Kontaktstatus'],
      ['count', 'Anzahl Talente'], ['talent_names', 'Passende Talente'], ['areas', 'Arbeitsbereich'],
      ['german', 'Deutschniveau'], ['english', 'Englischniveau'], ['notes', 'PS']
    ],
    companies: [
      ['empresa', 'Empresa'], ['sector', 'Setor / tipo'], ['openings', 'Vagas em aberto'],
      ['description', 'Descrição da empresa'], ['send_email', 'E-mail para envio']
    ]
  };
  for (const fields of Object.values(FIELDS)) fields.forEach(Object.freeze);
  // A Talento marcado como Inativo/Arquivado/Cancelado deve sair da fila
  // ativa mesmo quando uma importação antiga deixou ativo=true.
  const active = (r) => M.activeRecord(r);
  const yes = (value) => value === true || ['sim', 'true', '1', 'yes'].includes(M.norm(value));
  const list = (value) => Array.isArray(value) ? value : M.present(value) ? [value] : [];
  const matches = (selected, values) => !list(selected).length || list(selected).some((s) => list(values).some((v) => M.norm(v) === M.norm(s)));
  const profileFor = (state, id) => (state.mappingProfiles || []).find((r) => M.same(r.id, id)) || {};
  const courseFor = (state, id) => (state.enrollments || []).filter((r) => M.same(r.candidate_id, id) && ['matriculado', 'ativo', 'pausado'].includes(M.norm(r.status)));
  function attentionReasons(state, row) {
    const result = [];
    if (/alta|crit/i.test(row.prioridade_comercial || '')) result.push(`Prioridade ${row.prioridade_comercial}`);
    if (M.present(row.pendencia_documental_critica) && !['nao', 'false', '0', 'nenhuma', 'sem pendencias', 'sem pendencia'].includes(M.norm(row.pendencia_documental_critica))) result.push('Pendência documental crítica');
    for (const enrollment of courseFor(state, row.id)) result.push(...M.riskReasons(enrollment));
    if ((state.activities || []).some((r) => M.same(r.talent_id, row.id) && M.overdue(r.due_at, r.status))) result.push('Atividade vencida');
    return [...new Set(result)];
  }
  function mine(row, profile) {
    const names = [profile?.nome, profile?.username].filter(M.present).map(M.norm);
    return M.present(row.responsavel_interno) && names.includes(M.norm(row.responsavel_interno));
  }
  function filterTalents(state, { archived = false, ignore = '', profile = null, scope = null } = {}) {
    const f = state.filters || {}, quick = list(state.quick).filter((v) => v !== 'all');
    return (state.talents || []).filter((r) => {
      if (active(r) === archived) return false;
      const requestedScope = scope || state.talentScope || 'talento';
      if (requestedScope !== 'all' && M.talentScope(r) !== requestedScope) return false;
      const extra = profileFor(state, r.id), selections = (state.selections?.rows || []).filter((s) => M.same(s.talent_id, r.id));
      const mappingItems = (state.mappingItems || []).filter((x) => !x.archived_at && M.same(x.talent_id, r.id));
      const employerIds = [...selections.map((s) => s.employer_id), extra.employer_primary_id, extra.employer_alt1_id, extra.employer_alt2_id, ...mappingItems.map((x) => x.employer_id)].filter(M.present);
      const employerNames = [
        ...employerIds.map((id) => (state.employers || []).find((item) => M.same(item.id, id))?.nome),
        ...selections.map((s) => s.employer_name_snapshot), ...mappingItems.map((x) => x.employer_name)
      ].filter(M.present);
      const values = { stage: [r.status_pipeline || 'Sem etapa'], german: [r.nivel_alemao, ...courseFor(state, r.id).map((en) => en.current_level)].filter(M.present), owner: [r.responsavel_interno || 'Sem responsável'], employer: [...employerIds, ...employerNames], cluster: [extra.cluster || 'Sem cluster'], visa: [extra.visto || 'Não informado'], qualification: [extra.profissional_qualificado || 'Não informado'], cv: [extra.novo_cv || 'Não informado'], nectanet: [extra.lista_nectanet || 'Não informado'] };
      if (Object.entries(values).some(([key, vals]) => key !== ignore && !matches(f[key], vals))) return false;
      if (quick.some((key) => key !== ignore && ({ mine: !mine(r, profile), attention: !attentionReasons(state, r).length, course: !courseFor(state, r.id).length, ready: !yes(r.pronto_para_employer) })[key])) return false;
      const query = M.norm(state.query);
      const openingTitles = selections.map((selection) => (state.openings || []).find((opening) => M.same(opening.id, selection.opening_id))?.title).filter(M.present);
      return !query || M.norm([r.id, r.nome_completo, r.email, r.telefone, r.profissao_principal, r.area_profissional, r.cidade_atual, r.responsavel_interno, extra.cluster, ...employerNames, ...openingTitles].filter(M.present).join(' ')).includes(query);
    });
  }
  function mappingRows(state) {
    const saved = state.mappingItems || [];
    const rows = saved.map((r) => ({ ...r, _saved: true }));
    for (const s of state.selections?.rows || []) {
      if (saved.some((r) => r.source_table === s._source && M.same(r.source_record_id, s.id) || !r.archived_at && s.opening_id && M.same(r.talent_id,s.talent_id) && M.same(r.opening_id,s.opening_id))) continue;
      rows.push({ id: `source:${s.key}`, talent_id: s.talent_id, employer_id: s.employer_id, opening_id: s.opening_id,
        source_table: s._source, source_record_id: String(s.id), professional_score: s.professional_score ?? null,
        fit_reasons: s.reasons, barriers: s.barriers, _saved: false, _selection: s });
    }
    return rows.filter((r) => !r.archived_at).map((r) => {
      const employer = (state.employers || []).find((x) => M.same(x.id, r.employer_id));
      const opening = (state.openings || []).find((x) => M.same(x.id, r.opening_id));
      const partner = (state.mappingPartners || []).find((x) => M.same(x.id, r.employer_id));
      const talent = (state.talents || []).find((x) => M.same(x.id, r.talent_id));
      return { ...r, empresa: employer?.nome || r.employer_name || 'Empresa não identificada', talent: talent?.nome_completo || r.talent_id,
        nectanet: r.nectanet ?? partner?.is_nectanet ?? null,
        vacancy_status: opening?.status || r.vacancy_status || 'A CONFIRMAR',
        vacancy_situation: opening?.title || r.vacancy_situation,
        type_area: opening?.area || r.type_area, language_requirement: opening?.language_requirement || r.language_requirement,
        recognition_requirement: opening?.recognition_requirement || r.recognition_requirement,
        location: opening?.location || r.location, official_url: opening?.external_url || r.official_url,
        contact: r.contact || employer?.contato_principal,
        verified_on: r.verified_on || M.dateOnly(opening?.verified_at),
        _opening: opening || null, _employer: employer || null };
    });
  }
  const openVacancy = (row) => ['aberta', 'aberto'].includes(M.norm(row.vacancy_status));
  const score = (value) => M.finite(value) && Number(value) >= 0 && Number(value) <= 100 ? Number(value) : null;
  function summaryRows(state, talents) {
    const mapped = mappingRows(state);
    return talents.map((r) => {
      const p = profileFor(state, r.id), all = mapped.filter((x) => M.same(x.talent_id, r.id)), opened = all.filter(openVacancy);
      // Melhores alvos são escolhas humanas; não transformar maior score em aprovação.
      const targetName = (id) => { const row = all.find((x) => M.same(x.id, id)); return row ? `${row.empresa} — ${row.vacancy_situation || 'Alvo a confirmar'}` : null; };
      return { id: r.id, talent: r.nome_completo, profile: p.perfil_titulo || r.profissao_principal || r.area_profissional,
        mapped: all.length, open: opened.length, nectanet_open: opened.filter((x) => yes(x.nectanet)).length,
        fit90: opened.filter((x) => score(x.professional_score) != null && score(x.professional_score) >= 90).length,
        current60: opened.filter((x) => score(x.current_viability_score) != null && score(x.current_viability_score) >= 60).length,
        projected60: opened.filter((x) => score(x.projected_b1_score) != null && score(x.projected_b1_score) >= 60).length,
        best_nectanet: targetName(p.best_nectanet_item_id), best_external: targetName(p.best_external_item_id),
        barreira_principal: p.barreira_principal, prioridade_mapeamento: p.prioridade_mapeamento };
    });
  }
  function presentationRows(state, talents) {
    return talents.map((r) => {
      const p = profileFor(state, r.id), detail = (state.presentationDetails || []).find((x) => M.same(x.id, r.id)) || {};
      const combined = { ...p, ...r, ...detail, id: r.id, _profile: p, _talent: r };
      if (!M.present(combined.perfil_profissional_para_apresentacao) && M.present(r.resumo_rh_curto)) {
        combined.perfil_profissional_para_apresentacao = r.resumo_rh_curto;
        combined._summaryFallback = true;
      }
      // Exibir a informação antiga sem copiá-la silenciosamente para um novo campo.
      if (!M.present(combined.ingles) && /^(ingles|english)$/.test(M.norm(detail.lingua_estrangeira)) && M.present(detail.nivel_lingua_estrangeira)) {
        combined.ingles = detail.nivel_lingua_estrangeira; combined._englishFallback = true;
      }
      return combined;
    });
  }
  function partnerRows(state, talents) {
    const people = presentationRows(state, talents), employers = state.employers || [];
    const partnerById = new Map((state.mappingPartners || []).map((r) => [String(r.id), r]));
    const importSnapshot = (notes) => {
      const match = String(notes || '').match(/\[T4_IMPORT_PARTNER_V1\]\s*([\s\S]*?)\s*\[\/T4_IMPORT_PARTNER_V1\]/);
      if (!match) return null;
      try { return JSON.parse(match[1]); } catch { return null; }
    };
    const ids = new Set([...partnerById.keys(), ...people.flatMap((p) => [p.employer_primary_id, p.employer_alt1_id, p.employer_alt2_id]).filter(M.present).map(String)]);
    return [...ids].map((id) => {
      const e = employers.find((r) => M.same(r.id, id)), p = partnerById.get(id) || {}, snapshot = importSnapshot(p.notes);
      const candidates = people.filter((r) => [r.employer_primary_id, r.employer_alt1_id, r.employer_alt2_id].some((x) => M.same(x, id)));
      const vacancyNames = (state.openings || []).filter((r) => M.same(r.employer_id, id) && !r.deleted_at && M.active(r.is_active) && openVacancy({vacancy_status:r.status})).map((r) => r.title);
      return { ...p, id, empresa: e?.nome || 'Empregador não disponível', count: snapshot?.count ?? candidates.length,
        talent_names: snapshot?.talent_names || candidates.map((r) => r.nome_completo).join('\n'),
        areas: snapshot?.areas || candidates.map((r) => r.area_profissional || '—').join('\n'),
        german: snapshot?.german || candidates.map((r) => r.nivel_alemao || '—').join('\n'),
        english: snapshot?.english || candidates.map((r) => r.ingles || '—').join('\n'),
        notes: snapshot?.notes || p.notes,
        sector: e?.area_atuacao || p.sector, openings: vacancyNames.join('\n') || p.openings_note,
        description: e?.descricao_resumida || p.description, send_email: p.send_email || e?.email_principal, _employer: e };
    });
  }
  function validateScores(values) {
    for (const key of ['professional_score', 'current_viability_score', 'projected_b1_score']) {
      if (M.present(values[key]) && score(values[key]) === null) throw new Error('Informe avaliações de 0 a 100 ou deixe em branco.');
    }
  }
  window.T4TalentMapping = Object.freeze({ TABLES, FIELDS: Object.freeze(FIELDS), active, yes, list, matches, profileFor, courseFor, mine, attentionReasons, filterTalents, mappingRows, summaryRows, presentationRows, partnerRows, score, openVacancy, validateScores });
})();
