/* Talents 4 · ponte de importação/exportação dos modelos oficiais.
   A importação sempre passa por prévia + confirmação. Os arquivos são lidos
   no navegador; somente os registros confirmados pelo usuário são enviados
   ao Supabase. Não há sincronização automática com Drive ou com produção. */
(function (global) {
  'use strict';

  const U = global.T4V2 || { esc: (value) => String(value ?? ''), attr: (value) => String(value ?? ''), icon: () => '' };
  const W = global.T4Work || { note: (value) => String(value ?? ''), button: () => '' };
  const M = global.T4Models || { norm: (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(), same: (left, right) => String(left) === String(right) };
  const D = global.T4Data || {};
  const T = global.T4TalentMapping || {};
  const e = U.esc, a = U.attr;
  const workbook = () => global.T4Workbook;
  const norm = (value) => M?.norm ? M.norm(value) : String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const has = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const today = () => M?.today ? M.today() : new Date().toISOString().slice(0, 10);

  const candidateFields = [
    ['lista_nectanet', 'Lista Nectanet'], ['nome_completo', 'Nome'], ['visto', 'Visto'],
    ['profissional_qualificado', 'Profissional Qualificado'], ['novo_cv', 'Novo CV'], ['cv_drive_web_link', 'CV'],
    ['idade', 'Idade'], ['area_profissional', 'Área principal'], ['cluster', 'Cluster'],
    ['experiencia_profissional_tempo', 'Anos de experiência'], ['nivel_alemao', 'Alemão'], ['ingles', 'Inglês'],
    ['outros_idiomas', 'Outros idiomas'], ['employer_primary', 'Empresa principal'],
    ['employer_alt1', 'Empresa alternativa 1'], ['employer_alt2', 'Empresa alternativa 2'],
    ['perfil_profissional_para_apresentacao', 'Resumo do candidato'], ['observacao_apresentacao', 'Observação']
  ];
  const partnerFields = [
    ['source', 'nectanet source'], ['empresa', 'Unternehmen'], ['ceo_name', 'Geschäftsführer'], ['ceo_email', 'Kontakt-E-Mail'],
    ['hr_name', 'Personaler'], ['hr_email', 'Kontakt-E-Mail 2'], ['contact_status', 'Kontaktstatus'],
    ['count', 'Anzahl Kandidaten'], ['talent_names', 'Passende Kandidaten'], ['areas', 'Arbeitsbereich'],
    ['german', 'Deutschniveau'], ['english', 'Englischniveau'], ['notes', 'PS']
  ];
  const companyFields = [['empresa', 'Empresa'], ['sector', 'Setor / tipo'], ['openings', 'Vagas em aberto'], ['description', 'Descrição da empresa'], ['send_email', 'E-mail para envio']];
  // Aba nova (confirmada em "Nectanet Partner 01092026" na planilha oficial
  // de 2026-09-02). O nome inclui uma data que muda a cada atualização da
  // planilha (ex.: "Nectanet Partner 01102026" no mês seguinte) — por isso
  // o reconhecimento usa um padrão, não o nome exato de hoje (ver sheetKind()).
  const companySignalFields = [
    ['empresa', 'Empresa'], ['ceo_name', 'Geschäftsführung'], ['email', 'E-mail'], ['hr_name', 'HR / Personal'],
    ['hr_email', 'E-mail HR'], ['status', 'Status'], ['count', 'Qtd.'], ['adherent_talents_text', 'Talentos aderentes']
  ];
  const trackingFields = [
    ['empresa', 'Empresa'], ['nectanet', 'NectaNet?'], ['vacancy_status', 'Status'], ['professional_score', 'Aderência profissional'],
    ['current_viability_score', 'Viabilidade atual'], ['projected_b1_score', 'Viabilidade projetada — B1 em 3 meses'], ['vacancy_situation', 'Vaga / situação'],
    ['type_area', 'Tipo / área'], ['fit_reasons', 'Por que se encaixa'], ['barriers', 'Barreira / risco'], ['language_requirement', 'Idioma / requisito'],
    ['recognition_requirement', 'Anerkennung / Approbation'], ['location', 'Local'], ['contact', 'Contato'], ['official_url', 'Link direto / oficial'], ['verified_on', 'Verificado em']
  ];
  const summaryFields = [
    ['talent', 'Talento'], ['profile', 'Perfil'], ['mapped', 'Itens mapeados'], ['open', 'Vagas abertas'],
    ['nectanet_open', 'NectaNet abertas'], ['fit90', 'Abertas fit ≥90'], ['current60', 'Abertas viab. atual ≥60'],
    ['projected60', 'Abertas viab. B1 ≥60'], ['best_nectanet', 'Melhor NectaNet'], ['best_external', 'Melhor BW externa'],
    ['barreira_principal', 'Barreira principal'], ['prioridade_mapeamento', 'Prioridade']
  ];
  const radarFields = [
    ['empresa', 'Empresa'], ['talent', 'Talento(s)'], ['vacancy_status', 'Status'], ['professional_score', 'Aderência'],
    ['current_viability_score', 'Viab. atual'], ['projected_b1_score', 'Viab. B1 (3 meses)'], ['vacancy_situation', 'Vaga / alvo'],
    ['barriers', 'Barreira / observação'], ['location', 'Local'], ['official_url', 'Link'], ['verified_on', 'Verificado em']
  ];
  const exportHeaders = Object.freeze({
    presentation: ['Lista Nectanet', 'Nome', 'Visto', 'Profissional Qualificado', 'Novo CV', 'CV', 'Idade', 'Área principal', 'Cluster', 'Anos de experiência', 'Alemão', 'Inglês', 'Outros idiomas', 'Empresa principal', 'Empresa alternativa 1', 'Empresa alternativa 2', 'Resumo do candidato', 'Observação'],
    partners: ['nectanet source', 'Unternehmen', 'Geschäftsführer', 'Kontakt-E-Mail', 'Personaler', 'Kontakt-E-Mail 2', 'Kontaktstatus', 'Anzahl Kandidaten', 'Passende Kandidaten', 'Arbeitsbereich', 'Deutschniveau', 'Englischniveau', 'PS'],
    companies: ['Empresa', 'Setor / tipo', 'Vagas em aberto', 'Descrição da empresa', 'E-mail para envio']
  });
  const contextLabels = Object.freeze({
    'perfil comprovado': 'perfil_comprovado', idiomas: 'idiomas_contexto', 'regra desta revisao': 'regra_revisao',
    'premissa da projecao b1': 'premissa_projecao', 'projecao de idioma': 'premissa_projecao'
  });
  const fieldAliases = Object.freeze({
    count: ['Anzahl Talentos'], talent_names: ['Passende Talentos'],
    perfil_profissional_para_apresentacao: ['Resumo do Talento']
  });

  function labelKey(value) {
    return norm(value).replace(/[?·—–/()]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function headerRow(sheet, definitions) {
    const expected = definitions.map(([field, label]) => [field, new Set([label, ...(fieldAliases[field] || [])].map(labelKey))]);
    let best = { index: -1, score: 0, positions: new Map() };
    (sheet.rows || []).slice(0, 30).forEach((row, index) => {
      const positions = new Map();
      (row || []).forEach((value, column) => {
        const key = labelKey(value);
        const field = expected.find(([, labels]) => labels.has(key))?.[0];
        if (field && !positions.has(field)) positions.set(field, column);
      });
      if (positions.size > best.score) best = { index, score: positions.size, positions };
    });
    if (best.score < Math.min(2, definitions.length)) return null;
    return best;
  }

  function recordsFrom(sheet, definitions) {
    const head = headerRow(sheet, definitions);
    if (!head) return { headerRow: -1, rows: [] };
    const rows = [];
    for (let index = head.index + 1; index < (sheet.rows || []).length; index++) {
      const source = sheet.rows[index] || [];
      if (!source.some(has)) continue;
      const row = { _row: index + 1, _sheet: sheet.name };
      for (const [field, column] of head.positions) row[field] = source[column] ?? '';
      const first = definitions[0]?.[0];
      if (!has(row[first]) && !source.some((value) => has(value))) continue;
      rows.push(row);
    }
    return { headerRow: head.index, rows };
  }

  function contextFrom(sheet) {
    const context = { talent_name: sheet.rows?.[0]?.[0] || sheet.name, perfil_titulo: sheet.rows?.[2]?.[0] || '' };
    for (const row of sheet.rows || []) {
      const key = labelKey(row?.[0]);
      const field = contextLabels[key];
      if (field && !has(context[field])) context[field] = row?.[1] ?? '';
    }
    return context;
  }

  function splitTalentNames(value) {
    return String(value || '').split(/\s*(?:\n|;|,\s+(?=[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ]))\s*/).map((name) => name.trim()).filter(has);
  }

  // "Nectanet Partner 01092026" muda de nome a cada atualização da planilha
  // (o sufixo é a data). Reconhecer por padrão, não pelo texto exato de hoje.
  function isCompanySignalSheet(sheetKey) {
    return /^nectanet partner \d{6,8}$/.test(sheetKey);
  }

  // "Matriz NectaNet": uma linha por empresa, uma coluna por Talento (nomes
  // dinâmicos, não um schema fixo de campos) — não cabe no parser genérico
  // baseado em rótulos de coluna fixos usado pelas outras abas. O cabeçalho
  // fica na linha em que a primeira célula é "Empresa NectaNet" (alias de
  // "Empresa"); as colunas seguintes até "Melhores encaixes" são nomes de
  // Talento. A matriz mede aderência de ambiente, não vaga aberta — cada
  // aderência não-vazia vira um sinal de classificação de empresa, nunca
  // uma linha de acompanhamento (ela não tem vaga, status ou link).
  function parseMatrizSheet(sheet) {
    const rows = sheet.rows || [];
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      if (labelKey(rows[i]?.[0]) === 'empresa nectanet') { headerIdx = i; break; }
    }
    if (headerIdx < 0) return { headerRow: -1, companies: [] };
    const header = rows[headerIdx];
    const lastCol = header.findIndex((value) => labelKey(value) === 'melhores encaixes');
    const talentCols = header.map((value, index) => ({ value, index }))
      .slice(1, lastCol > 0 ? lastCol : header.length)
      .filter(({ value }) => has(value));
    const companies = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      const empresa = row?.[0];
      if (!has(empresa)) continue;
      const adherence = {};
      for (const { value: talentName, index } of talentCols) {
        const cell = row[index];
        if (has(cell) && norm(cell) !== norm('—') && cell !== '—') adherence[talentName] = String(cell).trim();
      }
      companies.push({
        _row: r + 1, _sheet: sheet.name, empresa,
        adherence,
        best_fit: lastCol > 0 ? row[lastCol] : '',
        notes: lastCol > 0 ? row[lastCol + 1] : ''
      });
    }
    return { headerRow: headerIdx, companies };
  }

  function parseBook(book) {
    const names = new Set((book.sheets || []).map((sheet) => labelKey(sheet.name)));
    const hasCompanySignalSheet = [...names].some(isCompanySignalSheet);
    const kind = names.has('candidatos priorizados') || names.has('nectanet partner') || names.has('empresas detalhadas') || hasCompanySignalSheet ? 'nectanet'
      : names.has('resumo bw') || names.has('radar nectanet') || names.has('matriz nectanet') || (book.sheets || []).some((sheet) => headerRow(sheet, trackingFields)) ? 'mapping' : 'unknown';
    const result = { name: book.name, kind, presentation: [], partners: [], companies: [], companySignals: [], matrizNectanet: [], tracking: [], contexts: [], summaries: [], radar: [], unknownSheets: [] };
    for (const sheet of book.sheets || []) {
      const sheetKey = labelKey(sheet.name);
      if (sheetKey === 'candidatos priorizados') result.presentation.push(...recordsFrom(sheet, candidateFields).rows);
      else if (sheetKey === 'nectanet partner') result.partners.push(...recordsFrom(sheet, partnerFields).rows);
      else if (sheetKey === 'empresas detalhadas') result.companies.push(...recordsFrom(sheet, companyFields).rows);
      else if (isCompanySignalSheet(sheetKey)) result.companySignals.push(...recordsFrom(sheet, companySignalFields).rows.filter((row) => normalizeCompany(row.empresa) && norm(row.empresa) !== 'empresa'));
      else if (sheetKey === 'matriz nectanet') result.matrizNectanet.push(...parseMatrizSheet(sheet).companies);
      else if (sheetKey === 'resumo bw') result.summaries = recordsFrom(sheet, summaryFields).rows;
      else if (sheetKey === 'radar nectanet') result.radar = recordsFrom(sheet, radarFields).rows;
      else {
        const tracking = recordsFrom(sheet, trackingFields);
        if (tracking.headerRow >= 0) {
          result.contexts.push({ ...contextFrom(sheet), _sheet: sheet.name });
          result.tracking.push(...tracking.rows.map((row) => ({ ...row, talent_name: contextFrom(sheet).talent_name, _sheet: sheet.name })));
        } else if (!['resumo bw', 'radar nectanet', 'matriz nectanet'].includes(sheetKey)) result.unknownSheets.push(sheet.name);
      }
    }
    // Alguns .xlsm exportados do Google Sheets carregam o resultado de
    // FILTER/TEXTJOIN como texto de fallback (__xludf.DUMMYFUNCTION), em vez
    // do valor visível. Reconstituir esses quatro campos a partir da aba
    // oficial de Talentos evita gravar a fórmula quebrada no CRM.
    const formulaFallback = (value) => /__xludf\.DUMMYFUNCTION|^IFERROR\(/i.test(String(value || ''));
    const relatedCandidates = (company) => result.presentation.filter((candidate) =>
      ['employer_primary', 'employer_alt1', 'employer_alt2'].some((key) => normalizeCompany(candidate[key]) === normalizeCompany(company)));
    const uniqueLines = (rows, key) => [...new Set(rows.map((row) => String(row[key] || '').trim()).filter(has))].join('\n');
    result.partners.forEach((partner) => {
      if (![partner.talent_names, partner.areas, partner.german, partner.english].some(formulaFallback)) return;
      const related = relatedCandidates(partner.empresa);
      partner.talent_names = uniqueLines(related, 'nome_completo');
      partner.areas = uniqueLines(related, 'area_profissional');
      partner.german = uniqueLines(related, 'nivel_alemao');
      partner.english = uniqueLines(related, 'ingles');
    });
    return result;
  }

  // Classifica cada empresa citada nas quatro fontes possíveis, sem nunca
  // inferir parceria direta com a Talents 4 (nenhuma das planilhas tem uma
  // coluna confiável para isso — ver docs/mapeamento/CLASSIFICACAO_EMPRESAS.md).
  // Uma empresa pode vir de mais de uma fonte NectaNet ao mesmo tempo; a
  // confiança da classificação de origem sobe com o número de fontes
  // independentes que a citam, mas a parceria direta fica sempre pendente
  // de revisão humana.
  const NECTANET_SIGNAL_SOURCES = Object.freeze(['nectanet_partner_novo', 'nectanet_partner', 'matriz_nectanet']);
  function classifyCompanies(nectanet, mapping) {
    const byKey = new Map();
    const touch = (raw, source) => {
      const display = companyName(raw);
      const key = normalizeCompany(display);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, { empresa: display, sources: new Set() });
      byKey.get(key).sources.add(source);
    };
    (nectanet?.companies || []).forEach((row) => touch(row.empresa, 'empresas_detalhadas'));
    (nectanet?.companySignals || []).forEach((row) => touch(row.empresa, 'nectanet_partner_novo'));
    (nectanet?.partners || []).forEach((row) => touch(row.empresa, 'nectanet_partner'));
    (mapping?.matrizNectanet || []).forEach((row) => touch(row.empresa, 'matriz_nectanet'));
    const result = new Map();
    for (const [key, info] of byKey) {
      const nectanetSourceCount = NECTANET_SIGNAL_SOURCES.filter((s) => info.sources.has(s)).length;
      const presented = nectanetSourceCount > 0;
      result.set(key, {
        empresa: info.empresa,
        presented_by_nectanet: presented,
        source_channel: presented ? 'NECTANET' : 'UNKNOWN',
        direct_talents4_partnership: 'UNKNOWN',
        partnership_status: 'UNKNOWN',
        company_scope: presented ? 'NECTANET_PRESENTED' : (info.sources.has('empresas_detalhadas') ? 'GENERAL' : 'UNKNOWN'),
        classification_confidence: nectanetSourceCount >= 2 ? 'HIGH' : (presented || info.sources.has('empresas_detalhadas') ? 'MEDIUM' : 'LOW'),
        classification_source: [...info.sources].sort().join(', ')
      });
    }
    return result;
  }

  function parseBooks(books) {
    const parsed = books.map(parseBook);
    const nectanet = parsed.find((book) => book.kind === 'nectanet') || { presentation: [], partners: [], companies: [], companySignals: [], unknownSheets: [] };
    const mapping = parsed.find((book) => book.kind === 'mapping') || { tracking: [], contexts: [], summaries: [], radar: [], matrizNectanet: [], unknownSheets: [] };
    const names = [...new Set([...nectanet.presentation.map((row) => row.nome_completo), ...mapping.contexts.map((row) => row.talent_name)].filter(has))];
    const companyClassification = classifyCompanies(nectanet, mapping);
    const needsReview = [...companyClassification.values()].filter((c) => c.direct_talents4_partnership === 'UNKNOWN');
    const warnings = [];
    if (!parsed.some((book) => book.kind === 'nectanet')) warnings.push('Não foi reconhecido o modelo “Mapeamento candidatos - Nectanet”.');
    if (!parsed.some((book) => book.kind === 'mapping')) warnings.push('Não foi reconhecido o modelo “Mapeamento Talents 4”.');
    for (const book of parsed) for (const sheet of book.unknownSheets || []) warnings.push(`Aba não reconhecida: ${sheet} (${book.name}). Ela não foi gravada; confira antes de continuar.`);
    if (needsReview.length) warnings.push(`${needsReview.length} empresa(s) sem confirmação de parceria direta com a Talents 4 — nenhuma planilha tem essa informação de forma confiável; revise manualmente antes de comunicar parceria a alguém.`);
    return { books: parsed, nectanet, mapping, talentNames: names, warnings, companyClassification,
      stats: { files: parsed.length, candidates: nectanet.presentation.length, partners: nectanet.partners.length, companies: nectanet.companies.length, companySignals: nectanet.companySignals?.length || 0, matrizCompanies: mapping.matrizNectanet?.length || 0, tracking: mapping.tracking.length, profiles: mapping.contexts.length, summary: mapping.summaries.length, radar: mapping.radar.length, companiesClassified: companyClassification.size, companiesNeedingPartnershipReview: needsReview.length } };
  }

  function number(value) {
    if (!has(value)) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value).replace(',', '.').replace(/[^\d.+-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function dateOnly(value) {
    if (!has(value)) return null;
    const text = String(value).trim();
    const match = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
    if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
  }

  function choice(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (/^sim\b/i.test(text) || /nectanet/i.test(text)) return 'Sim';
    if (/^(não|nao|no)\b/i.test(text)) return 'Não';
    return text;
  }

  function companyName(value) {
    if (!has(value)) return '';
    const raw = String(value).replace(/\r/g, '').trim();
    if (!raw || /^(nenhuma|não informado|nao informado|a definir|não definido|nao definido|sem informação|sem informacao|n\/a|—|-)$/i.test(raw)) return '';
    // A planilha usa ocasionalmente “Empresa: URL” ou quebra o nome e a
    // URL em linhas separadas. O CRM deve guardar a empresa como entidade;
    // links pertencem ao campo de referência/vaga, nunca ao nome.
    if (/^\d+(?:[.,]\d+)?$/.test(raw)) return '';
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    const first = lines.find((line) => !/^https?:\/\//i.test(line)) || lines[0] || raw;
    return first.replace(/\s*:\s*https?:\/\/.*$/i, '').replace(/\s*:\s*$/, '').trim();
  }

  function normalizeCompany(value) { return norm(companyName(value)).replace(/[^a-z0-9]+/g, ' ').trim(); }

  function deterministicId(...values) {
    let hash = 2166136261;
    for (const value of values.join('|')) { hash ^= value.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    let hex = (hash >>> 0).toString(16).padStart(8, '0');
    for (let i = 1; i < 4; i++) { let part = 0; for (const value of values.join('|')) { part = Math.imul(part ^ value.charCodeAt(0), 2246822519); } hex += (part >>> 0).toString(16).padStart(8, '0'); }
    hex = hex.slice(0, 32);
    hex = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
    return hex.slice(0, 36);
  }

  function stableTalentId(name) { return `T4-IMPORT-${norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42) || deterministicId(name).replaceAll('-', '').slice(0, 24)}`.toUpperCase(); }

  function errorColumn(error) {
    const message = String(error?.message || '');
    return message.match(/column\s+(?:\w+\.)?["']?(\w+)["']?\s+does not exist/i)?.[1]
      || message.match(/could not find the ["'](\w+)["'] column/i)?.[1] || '';
  }

  async function chunks(rows, size, fn, progress) {
    let done = 0;
    for (let index = 0; index < rows.length; index += size) {
      await fn(rows.slice(index, index + size));
      done += Math.min(size, rows.length - index);
      progress?.(done, rows.length);
    }
  }

  async function upsertSafe(table, rows, options = {}, progress) {
    if (!rows.length) return;
    let pending = rows.map((row) => ({ ...row }));
    const removed = new Set();
    while (pending.length) {
      try {
        await chunks(pending, options.chunkSize || 40, (batch) => D.upsert(table, batch, { select: false, single: false, onConflict: options.onConflict || 'id' }), progress);
        return [...removed];
      } catch (error) {
        const missing = errorColumn(error);
        if (!D.missingColumn(error) || !missing || missing === 'id' || removed.has(missing)) throw error;
        removed.add(missing); pending = pending.map((row) => { const copy = { ...row }; delete copy[missing]; return copy; });
      }
    }
    return [...removed];
  }

  function mergeText(...values) { return values.map((value) => String(value ?? '').trim()).filter(Boolean).join('\n'); }

  function importedPartnerNotes(row) {
    const snapshot = { count: has(row.count) ? row.count : '', talent_names: row.talent_names || '', areas: row.areas || '', german: row.german || '', english: row.english || '', notes: row.notes || '' };
    return `[T4_IMPORT_PARTNER_V1]\n${JSON.stringify(snapshot)}\n[/T4_IMPORT_PARTNER_V1]`;
  }

  function importedPartnerSnapshot(notes) {
    const match = String(notes || '').match(/\[T4_IMPORT_PARTNER_V1\]\s*([\s\S]*?)\s*\[\/T4_IMPORT_PARTNER_V1\]/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
  }

  function rawWithoutSnapshot(notes) {
    return String(notes || '').replace(/\[T4_IMPORT_PARTNER_V1\][\s\S]*?\[\/T4_IMPORT_PARTNER_V1\]/g, '').trim();
  }

  async function importData(source, options = {}) {
    if (!D.canEdit()) throw new Error('Seu perfil é somente leitura; a importação exige um perfil de recrutador ou administrador.');
    const progress = options.progress || (() => {}), state = options.state || {};
    // Relatório visível ao usuário: quantidade prevista/criada/atualizada por
    // entidade e cada linha rejeitada por falta de Talento/empresa reconhecível.
    // A gravação acontece em etapas HTTP separadas (Empregadores → Talentos →
    // Contexto → Parceiros → Acompanhamento) sem transação entre elas — se uma
    // etapa falhar, as anteriores já foram persistidas. Como todo upsert usa
    // ID determinístico ou casamento por nome já existente, reimportar depois
    // de corrigir o problema atualiza os mesmos registros em vez de duplicar;
    // por isso o relatório parcial é anexado ao erro (`error.importReport`)
    // para o usuário saber exatamente o que já foi gravado antes de tentar de novo.
    const report = { employers: { created: 0, updated: 0 }, talents: { created: 0, updated: 0 }, profiles: { upserted: 0 }, partners: { upserted: 0 }, items: { upserted: 0 }, rejected: [] };
    try {
    const existingEmployers = new Map((state.employers || []).filter((row) => has(row.nome)).map((row) => [normalizeCompany(row.nome), row]));
    const employerByName = new Map(existingEmployers);
    const employerPatches = new Map(), newEmployers = [];
    const registerEmployer = (raw, patch = {}, context = '') => {
      const name = companyName(raw), key = normalizeCompany(name);
      if (!key) {
        if (context && has(raw)) report.rejected.push(`${context}: empresa "${String(raw).trim()}" não pôde ser identificada.`);
        return null;
      }
      let row = employerByName.get(key);
      if (!row) { row = { id: D.uuid(), nome: name, nome_normalizado: key.replace(/\s+/g, '_'), ativo: true, status: 'ativo', tipo: 'Empregador', pais: 'Alemanha', origem_lead: 'Importação de planilhas' }; employerByName.set(key, row); newEmployers.push(row); }
      const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => has(value)));
      if (Object.keys(cleanPatch).length) employerPatches.set(row.id, { ...(employerPatches.get(row.id) || {}), ...cleanPatch });
      return row.id;
    };
    const companyRows = source.nectanet.companies || [];
    companyRows.forEach((row) => registerEmployer(row.empresa, { area_atuacao: row.sector, perfis_buscados: row.openings, descricao_resumida: row.description, email_principal: row.send_email }, `Empresas detalhadas · linha ${row._row || '?'}`));
    (source.nectanet.partners || []).forEach((row) => registerEmployer(row.empresa, {}, `Nectanet Partner · linha ${row._row || '?'}`));
    (source.nectanet.companySignals || []).forEach((row) => registerEmployer(row.empresa, {}, `${row._sheet || 'Nectanet Partner (nova)'} · linha ${row._row || '?'}`));
    (source.mapping.matrizNectanet || []).forEach((row) => registerEmployer(row.empresa, {}, `Matriz NectaNet · linha ${row._row || '?'}`));
    (source.nectanet.presentation || []).forEach((row) => ['employer_primary', 'employer_alt1', 'employer_alt2'].forEach((key) => registerEmployer(row[key], {}, `Candidatos priorizados · linha ${row._row || '?'} (${row.nome_completo || 'sem nome'})`)));
    (source.mapping.tracking || []).forEach((row) => registerEmployer(row.empresa, { perfis_buscados: row.type_area }, `${row._sheet || 'Acompanhamento'} · linha ${row._row || '?'}`));
    (source.mapping.radar || []).forEach((row) => registerEmployer(row.empresa, { perfis_buscados: row.vacancy_situation }, `Radar NectaNet · linha ${row._row || '?'}`));
    // Classificação de origem (NectaNet vs. desconhecida) e parceria (sempre
    // pendente de revisão humana — nenhuma planilha confirma isso de forma
    // confiável). Colunas ainda não existentes no Supabase são removidas
    // automaticamente pelo upsertSafe/D.update abaixo (mesmo mecanismo já
    // usado para qualquer campo opcional ausente do schema atual).
    const classification = classifyCompanies(source.nectanet, source.mapping);
    for (const row of newEmployers) {
      const info = classification.get(normalizeCompany(row.nome));
      if (info) Object.assign(row, { presented_by_nectanet: info.presented_by_nectanet, source_channel: info.source_channel, direct_talents4_partnership: info.direct_talents4_partnership, partnership_status: info.partnership_status, company_scope: info.company_scope, classification_confidence: info.classification_confidence, classification_source: info.classification_source });
    }
    for (const row of employerByName.values()) {
      if (newEmployers.some((item) => String(item.id) === String(row.id))) continue;
      const info = classification.get(normalizeCompany(row.nome));
      if (!info) continue;
      employerPatches.set(row.id, { ...(employerPatches.get(row.id) || {}), presented_by_nectanet: info.presented_by_nectanet, source_channel: info.source_channel, company_scope: info.company_scope, classification_confidence: info.classification_confidence, classification_source: info.classification_source });
    }
    progress('empregadores', 0, newEmployers.length + employerPatches.size);
    if (newEmployers.length) await upsertSafe(D.TABLES.employers, newEmployers, { chunkSize: 30 }, (done, total) => progress('empregadores', done, newEmployers.length));
    const employerRows = [...employerByName.values()];
    for (const [id, patch] of employerPatches) {
      const row = employerRows.find((item) => String(item.id) === String(id));
      if (!row || newEmployers.some((item) => String(item.id) === String(id))) continue;
      await D.update(D.TABLES.employers, id, patch, { select: false });
    }
    progress('empregadores', newEmployers.length + employerPatches.size, newEmployers.length + employerPatches.size);
    report.employers = { created: newEmployers.length, updated: [...employerPatches.keys()].filter((id) => !newEmployers.some((row) => String(row.id) === String(id))).length };
    report.companiesNeedingPartnershipReview = [...classification.values()].filter((c) => c.direct_talents4_partnership === 'UNKNOWN').length;

    const existingTalents = new Map((state.talents || []).filter((row) => has(row.nome_completo)).map((row) => [norm(row.nome_completo), row]));
    const talentByName = new Map(existingTalents);
    const talentFor = (value) => {
      const key = norm(value), exact = talentByName.get(key);
      if (exact) return exact;
      const matches = [...talentByName.entries()].filter(([fullName]) => {
        const parts = fullName.split(' ');
        return fullName.includes(key) || parts[0] === key || parts.at(-1) === key;
      });
      return matches.length === 1 ? matches[0][1] : null;
    };
    const candidateRows = source.nectanet.presentation || [];
    const contextRows = source.mapping.contexts || [];
    const allNames = [...new Set([...candidateRows.map((row) => row.nome_completo), ...contextRows.map((row) => row.talent_name)].filter(has))];
    const newTalentRows = [], talentPatches = new Map();
    for (const name of allNames) {
      const key = norm(name);
      let row = talentByName.get(key);
      if (!row) { row = { id: stableTalentId(name), nome_completo: String(name).trim(), ativo: true, status_pipeline: 'Novo candidato', data_da_candidatura: today(), ultima_atualizacao: new Date().toISOString(), origem_cadastro: 'Importação de planilhas' }; talentByName.set(key, row); newTalentRows.push(row); }
      const candidate = candidateRows.find((item) => norm(item.nome_completo) === key);
      const context = contextRows.find((item) => norm(item.talent_name) === key);
      const patch = {};
      if (candidate) Object.assign(patch, {
        idade: has(candidate.idade) ? String(candidate.idade) : null,
        area_profissional: candidate.area_profissional,
        experiencia_profissional_tempo: candidate.experiencia_profissional_tempo,
        nivel_alemao: candidate.nivel_alemao,
        cv_drive_web_link: candidate.cv_drive_web_link,
        perfil_profissional_para_apresentacao: candidate.perfil_profissional_para_apresentacao
      });
      if (context?.perfil_titulo && !has(patch.area_profissional)) patch.area_profissional = context.perfil_titulo;
      Object.assign(patch, { ultima_atualizacao: new Date().toISOString() });
      talentPatches.set(row.id, Object.fromEntries(Object.entries(patch).filter(([, value]) => has(value))));
    }
    progress('Talentos', 0, newTalentRows.length + talentPatches.size);
    if (newTalentRows.length) await upsertSafe(D.TABLES.candidates, newTalentRows, { chunkSize: 25 }, (done, total) => progress('Talentos', done, newTalentRows.length));
    for (const [id, patch] of talentPatches) {
      if (newTalentRows.some((row) => String(row.id) === String(id))) continue;
      await D.update(D.TABLES.candidates, id, patch, { select: false });
    }
    progress('Talentos', newTalentRows.length + talentPatches.size, newTalentRows.length + talentPatches.size);
    report.talents = { created: newTalentRows.length, updated: [...talentPatches.keys()].filter((id) => !newTalentRows.some((row) => String(row.id) === String(id))).length };

    const profileRows = [], profileByTalent = new Map();
    for (const name of allNames) {
      const talent = talentFor(name), candidate = candidateRows.find((row) => norm(row.nome_completo) === norm(name)), context = contextRows.find((row) => norm(row.talent_name) === norm(name)), summary = (source.mapping.summaries || []).find((row) => norm(row.talent) === norm(name) || (talent && talentFor(row.talent)?.id === talent.id));
      if (!talent) continue;
      const profile = { id: talent.id };
      if (candidate) Object.assign(profile, { lista_nectanet: choice(candidate.lista_nectanet), visto: candidate.visto, profissional_qualificado: candidate.profissional_qualificado, novo_cv: candidate.novo_cv, cluster: candidate.cluster, ingles: candidate.ingles, outros_idiomas: candidate.outros_idiomas, observacao_apresentacao: candidate.observacao_apresentacao });
      if (context) Object.assign(profile, { perfil_titulo: context.perfil_titulo, perfil_comprovado: context.perfil_comprovado, idiomas_contexto: context.idiomas_contexto, regra_revisao: context.regra_revisao, premissa_projecao: context.premissa_projecao });
      if (summary) Object.assign(profile, { barreira_principal: summary.barreira_principal, prioridade_mapeamento: summary.prioridade_mapeamento });
      for (const [sourceKey, targetKey] of [['employer_primary', 'employer_primary_id'], ['employer_alt1', 'employer_alt1_id'], ['employer_alt2', 'employer_alt2_id']]) {
        if (candidate?.[sourceKey]) profile[targetKey] = registerEmployer(candidate[sourceKey]);
      }
      Object.assign(profile, Object.fromEntries(Object.entries(profile).filter(([, value]) => has(value))));
      profileRows.push(profile); profileByTalent.set(String(talent.id), profile);
    }
    progress('contextos', 0, profileRows.length);
    await upsertSafe(T.TABLES.profiles, profileRows, { chunkSize: 30 }, (done, total) => progress('contextos', done, profileRows.length));
    report.profiles.upserted = profileRows.length;

    const partnerById = new Map();
    for (const row of source.nectanet.partners || []) {
      const employerId = registerEmployer(row.empresa);
      if (!employerId) continue;
      const current = (state.mappingPartners || []).find((item) => String(item.id) === String(employerId));
      const existingNotes = rawWithoutSnapshot(current?.notes);
      partnerById.set(String(employerId), { id: employerId, is_nectanet: /nectanet|match|sim/i.test(String(row.source || '')) ? 'Sim' : 'Não', source: row.source || null, ceo_name: row.ceo_name || null, ceo_email: row.ceo_email || null, hr_name: row.hr_name || null, hr_email: row.hr_email || null, contact_status: row.contact_status || null, notes: importedPartnerNotes({ ...row, notes: row.notes || existingNotes }) });
    }
    const partnerRows = [...partnerById.values()];
    const companyByName = new Map(companyRows.map((row) => [normalizeCompany(row.empresa), row]));
    for (const row of companyRows) {
      const employerId = registerEmployer(row.empresa); if (!employerId) continue;
      const partner = partnerRows.find((item) => String(item.id) === String(employerId));
      const current = (state.mappingPartners || []).find((item) => String(item.id) === String(employerId));
      const patch = { id: employerId, sector: row.sector || null, openings_note: row.openings || null, description: row.description || null, send_email: row.send_email || null };
      if (partner) Object.assign(partner, Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'id' && has(patch[key]))));
      else if (current || row.send_email || row.sector || row.description) partnerRows.push({ ...patch, ...(current?.notes ? { notes: current.notes } : {}) });
    }
    progress('parceiros', 0, partnerRows.length); await upsertSafe(T.TABLES.partners, partnerRows, { chunkSize: 30 }, (done, total) => progress('parceiros', done, partnerRows.length));
    report.partners.upserted = partnerRows.length;

    const itemRows = [], existingItems = state.mappingItems || [];
    const appendItem = (row, talentName, defaultNectanet = null) => {
      const talent = talentFor(talentName), employerId = registerEmployer(row.empresa);
      if (!talent || !employerId) {
        const reasons = [!talent && `talento "${talentName || '(vazio)'}" não encontrado na base`, !employerId && `empresa "${row.empresa || '(vazio)'}" não identificada`].filter(Boolean).join(' e ');
        report.rejected.push(`${row._sheet || 'Acompanhamento'} · linha ${row._row || '?'}: ${reasons}.`);
        return;
      }
      const payload = { talent_id: talent.id, employer_id: employerId, employer_name: companyName(row.empresa), nectanet: choice(row.nectanet) || defaultNectanet, vacancy_status: row.vacancy_status || 'A CONFIRMAR', professional_score: number(row.professional_score), current_viability_score: number(row.current_viability_score), projected_b1_score: number(row.projected_b1_score), vacancy_situation: row.vacancy_situation || null, type_area: row.type_area || null, fit_reasons: row.fit_reasons || null, barriers: row.barriers || null, language_requirement: row.language_requirement || null, recognition_requirement: row.recognition_requirement || null, location: row.location || null, contact: row.contact || null, official_url: /^https?:\/\/[^\s]+$/i.test(String(row.official_url || '')) ? String(row.official_url).trim() : null, verified_on: dateOnly(row.verified_on), verification_notes: row.verified_on && !dateOnly(row.verified_on) ? `Valor original de “Verificado em”: ${row.verified_on}` : null };
      const id = deterministicId('mapping', talent.id, employerId, row.vacancy_situation || '', row.location || '', row.official_url || '');
      const existing = [...existingItems, ...itemRows].find((item) => String(item.id) === id || (!item.archived_at && String(item.talent_id) === String(talent.id) && String(item.employer_id) === String(employerId) && norm(item.vacancy_situation) === norm(row.vacancy_situation)));
      itemRows.push({ id: existing?.id || id, ...payload });
    };
    for (const row of source.mapping.tracking || []) appendItem(row, row.talent_name);
    for (const row of source.mapping.radar || []) {
      for (const talentName of splitTalentNames(row.talent)) appendItem({ ...row, nectanet: 'Sim' }, talentName, 'Sim');
    }
    progress('acompanhamentos', 0, itemRows.length); await upsertSafe(T.TABLES.items, itemRows, { chunkSize: 30 }, (done, total) => progress('acompanhamentos', done, itemRows.length));
    report.items.upserted = itemRows.length;
    for (const summary of source.mapping.summaries || []) {
      const talent = talentFor(summary.talent);
      const profile = talent && profileByTalent.get(String(talent.id));
      if (!profile) continue;
      const findBest = (value, requireNectanet) => {
        if (!has(value)) return null;
        const text = norm(value);
        return itemRows.find((item) => String(item.talent_id) === String(talent.id) && (!requireNectanet || /sim/i.test(String(item.nectanet || ''))) && text.includes(norm(companyName(item.employer_name))) && text.includes(norm(item.vacancy_situation || '')))?.id || null;
      };
      const bestNectanet = findBest(summary.best_nectanet, true), bestExternal = findBest(summary.best_external, false);
      if (bestNectanet) profile.best_nectanet_item_id = bestNectanet;
      if (bestExternal) profile.best_external_item_id = bestExternal;
    }
    const profileUpdates = profileRows.filter((row) => row.best_nectanet_item_id || row.best_external_item_id);
    if (profileUpdates.length) await upsertSafe(T.TABLES.profiles, profileUpdates, { chunkSize: 30 }, (done, total) => progress('resumo do mapeamento', done, profileUpdates.length));
    return report;
    } catch (error) {
      // O que já está em report reflete etapas realmente concluídas (cada
      // contagem só é preenchida depois do upsert correspondente terminar).
      // Como a gravação não é transacional entre tabelas, isso é exatamente
      // o que o usuário precisa ver para decidir com segurança se reimporta.
      error.importReport = report;
      throw error;
    }
  }

  function selectedTalents(state) {
    const selected = state.selectedTalents instanceof Set ? [...state.selectedTalents] : [];
    const all = state.talents || [];
    const ids = selected.length ? selected : all.map((row) => row.id);
    return ids.map((id) => all.find((row) => String(row.id) === String(id))).filter(Boolean);
  }

  function employerLabel(state, id) { return state.employers?.find((row) => M.same(row.id, id))?.nome || id || ''; }
  function mappingValue(state, row, key) {
    if (key === 'empresa') return employerLabel(state, row.employer_id) || row.employer_name || '';
    return row[key] ?? '';
  }

  function partnerRowsFor(state, people) {
    const ids = new Set();
    for (const person of people) {
      const profile = T.profileFor(state, person.id);
      [profile.employer_primary_id, profile.employer_alt1_id, profile.employer_alt2_id].filter(has).forEach((id) => ids.add(String(id)));
      T.mappingRows(state).filter((row) => M.same(row.talent_id, person.id) && has(row.employer_id)).forEach((row) => ids.add(String(row.employer_id)));
    }
    const scoped = { ...state, mappingPartners: (state.mappingPartners || []).filter((row) => ids.has(String(row.id))) };
    return T.partnerRows(scoped, people).filter((row) => ids.has(String(row.id)));
  }

  function sourceCell(row, key) {
    if (key === 'empresa') return row.empresa || '';
    return row[key] ?? '';
  }

  function buildNectaWorkbook(state, people) {
    const candidateRows = T.presentationRows(state, people).map((row) => T.FIELDS.presentation.map(([key]) => {
      if (key === 'employer_primary_id') return employerLabel(state, row[key]);
      if (key === 'employer_alt1_id') return employerLabel(state, row[key]);
      if (key === 'employer_alt2_id') return employerLabel(state, row[key]);
      return row[key] ?? '';
    }));
    const partnerRows = partnerRowsFor(state, people).map((row) => T.FIELDS.partners.map(([key]) => sourceCell(row, key)));
    const companyIds = new Set(partnerRowsFor(state, people).map((row) => row.id));
    T.presentationRows(state, people).forEach((row) => [row.employer_primary_id, row.employer_alt1_id, row.employer_alt2_id].filter(has).forEach((id) => companyIds.add(String(id))));
    T.mappingRows(state).filter((row) => people.some((person) => M.same(person.id, row.talent_id))).forEach((row) => has(row.employer_id) && companyIds.add(String(row.employer_id)));
    const companyRows = [...companyIds].map((id) => {
      const employer = state.employers?.find((row) => String(row.id) === String(id)), partner = state.mappingPartners?.find((row) => String(row.id) === String(id));
      return [employer?.nome || partner?.empresa || id, employer?.area_atuacao || partner?.sector || '', employer?.perfis_buscados || employer?.vagas_abertas || partner?.openings_note || '', employer?.descricao_resumida || partner?.description || '', partner?.send_email || employer?.email_principal || ''];
    });
    const h1 = exportHeaders.presentation, h2 = exportHeaders.partners, h3 = exportHeaders.companies;
    return { sheets: [
      { name: 'Nectanet Partner', rows: [h2, ...partnerRows], headerRow: 1, freezeRows: 1, widths: [17, 35, 28, 36, 28, 36, 18, 14, 36, 38, 18, 22, 28], pageBreaks: partnerRows.slice(0, -1).map((_, i) => i + 2) },
      { name: 'Candidatos priorizados', rows: [h1, ...candidateRows], headerRow: 1, freezeRows: 1, widths: [14, 32, 18, 20, 14, 42, 10, 42, 38, 24, 20, 20, 28, 32, 32, 32, 68, 70], pageBreaks: candidateRows.slice(0, -1).map((_, i) => i + 2) },
      { name: 'Empresas detalhadas', rows: [h3, ...companyRows], headerRow: 1, freezeRows: 1, widths: [38, 34, 62, 78, 58] }
    ] };
  }

  function mappingSheet(state, person) {
    const profile = T.profileFor(state, person.id), rows = T.mappingRows(state).filter((row) => M.same(row.talent_id, person.id));
    const context = [['Perfil comprovado', profile.perfil_comprovado], ['Idiomas', profile.idiomas_contexto || [person.nivel_alemao ? `Alemão informado: ${person.nivel_alemao}` : '', person.lingua_estrangeira].filter(Boolean).join(' | ')], ['Regra desta revisão', profile.regra_revisao], ['Projeção de idioma', profile.premissa_projecao]].filter(([, value]) => has(value));
    const rowsOut = [[person.nome_completo], [], [profile.perfil_titulo || person.area_profissional || person.profissao_principal || ''], [], ...context.map(([label, value]) => [label, value]), T.FIELDS.tracking.map(([, label]) => label), ...rows.map((row) => T.FIELDS.tracking.map(([key]) => mappingValue(state, row, key)))];
    const headerIndex = rowsOut.findIndex((row) => row[0] === 'Empresa') + 1;
    const merges = ['A1:P1', 'A3:P3']; let current = 5;
    for (const [, value] of context) { merges.push(`B${current}:P${current}`); current++; }
    return { name: person.nome_completo, rows: rowsOut, headerRow: headerIndex, freezeRows: headerIndex, widths: [38, 13, 16, 18, 18, 24, 52, 34, 72, 72, 36, 38, 28, 40, 64, 24], merges, pageBreaks: rows.length > 1 ? rows.slice(0, -1).map((_, i) => headerIndex + 1 + i) : [] };
  }

  function buildMappingWorkbook(state, people) {
    const summary = T.summaryRows(state, people);
    const summaryHeader = T.FIELDS.summary.map(([, label]) => label), summaryValues = summary.map((row) => T.FIELDS.summary.map(([key]) => row[key] ?? ''));
    const ids = new Set(people.map((row) => String(row.id)));
    const radarRows = T.mappingRows(state).filter((row) => ids.has(String(row.talent_id)) && T.yes(row.nectanet)).map((row) => T.FIELDS.radar.map(([key]) => key === 'talent' ? row.talent : mappingValue(state, row, key)));
    // Rótulo da coluna de exportação segue o modelo oficial ("Talento", no
    // singular). O rótulo "Talento(s)" de T.FIELDS.radar é da grade dentro
    // do sistema, não da planilha — trocado só aqui para não mexer em texto
    // de tela que não tem relação com fidelidade ao arquivo oficial.
    const radarHeader = T.FIELDS.radar.map(([key, label]) => key === 'talent' ? 'Talento' : label);
    return { sheets: [
      ...people.map((person) => mappingSheet(state, person)),
      { name: 'Resumo BW', rows: [['MAPEAMENTO TALENTS 4 — NECTANET + BADEN-WÜRTTEMBERG'], [`Exportação gerada em ${new Date().toLocaleDateString('pt-BR')}. Projeções são cenários de idioma e não aprovação automática.`], [], summaryHeader, ...summaryValues], headerRow: 4, freezeRows: 4, widths: [28, 46, 16, 16, 18, 18, 22, 22, 52, 52, 72, 20], merges: ['A1:L1', 'A2:L2'] },
      { name: 'Radar NectaNet', rows: [['RADAR NECTANET — MATCHES RELEVANTES AOS TALENTOS'], [`Exportação gerada em ${new Date().toLocaleDateString('pt-BR')}. Só entram vagas marcadas como NectaNet no acompanhamento por Talento.`], [], radarHeader, ...radarRows], headerRow: 4, freezeRows: 4, widths: [38, 28, 17, 15, 15, 18, 58, 72, 28, 64, 26], merges: ['A1:K1', 'A2:K2'] }
    ] };
  }

  function download(blob, name) {
    const url = global.URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.rel = 'noopener'; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => global.URL.revokeObjectURL(url), 1500);
  }

  async function exportFiles(state, kind = 'both') {
    const people = selectedTalents(state); if (!people.length) throw new Error('Não há Talentos disponíveis para exportar.');
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'nectanet' || kind === 'both') download(await workbook().write(buildNectaWorkbook(state, people)), `Talents4_Nectanet_${stamp}.xlsx`);
    if (kind === 'mapping' || kind === 'both') download(await workbook().write(buildMappingWorkbook(state, people)), `Talents4_Acompanhamento_${stamp}.xlsx`);
    return people.length;
  }

  function stat(label, value, tone = '') { return `<div class="t4-data-stat ${a(tone)}"><strong>${e(value)}</strong><span>${e(label)}</span></div>`; }
  function card(title, copy, button, tone = '') { return `<article class="t4-data-card ${a(tone)}"><div><span class="t4-data-card-icon">${U.icon(tone === 'import' ? 'upload' : 'download')}</span><h3>${e(title)}</h3><p>${e(copy)}</p></div>${button}</article>`; }
  function reportHtml(report, complete) {
    if (!report) return '';
    const rows = [
      ['Empregadores', report.employers?.created || 0, report.employers?.updated || 0],
      ['Talentos', report.talents?.created || 0, report.talents?.updated || 0],
      ['Contexto de apresentação', report.profiles?.upserted || 0, ''],
      ['Parceiros NectaNet', report.partners?.upserted || 0, ''],
      ['Linhas de acompanhamento', report.items?.upserted || 0, '']
    ];
    const rejected = report.rejected || [];
    const heading = complete ? 'Resumo da importação' : 'O que já foi gravado antes da falha';
    const note = complete
      ? (rejected.length ? W.note(`${rejected.length} linha${rejected.length === 1 ? '' : 's'} da planilha não pôde${rejected.length === 1 ? '' : 'ram'} ser associada a um Talento ou empresa e não ${rejected.length === 1 ? 'foi gravada' : 'foram gravadas'}. Veja os detalhes abaixo.`, 'warning') : '')
      : W.note('A gravação não é uma única transação: as linhas abaixo já estão salvas mesmo com a importação interrompida. Como a gravação usa upsert idempotente (por identificação estável), corrigir o problema e importar novamente atualiza esses mesmos registros em vez de duplicá-los.', 'warning');
    return `<div class="t4-data-summary"><div><span class="t4-overline">${e(heading)}</span></div>${rows.map(([label, created, updated]) => stat(label, updated === '' ? created : `${created} novo(s) · ${updated} atualizado(s)`)).join('')}</div>${note}${rejected.length ? `<details class="t4-disclosure"><summary>${rejected.length} linha${rejected.length === 1 ? '' : 's'} rejeitada${rejected.length === 1 ? '' : 's'} · não gravada${rejected.length === 1 ? '' : 's'}</summary><ul>${rejected.map((line) => `<li>${e(line)}</li>`).join('')}</ul></details>` : ''}`;
  }

  // O sistema não importa planilha nenhuma — a origem dos dados é o
  // cadastro feito na própria interface. Esta tela existe só para
  // exportar os dois modelos oficiais, com fidelidade ao layout original,
  // a partir do recorte de Talentos que o usuário selecionou. Não confundir
  // com importData()/parseBook() acima, que ficam no arquivo sem uso na
  // interface — não removidos porque já têm teste próprio cobrindo a
  // leitura fiel do .xlsm/.xlsx (útil se um dia for reativado), mas nenhum
  // botão desta tela chama esse caminho.
  function open(options = {}) {
    const state = options.state || {}, selectedCount = state.selectedTalents instanceof Set ? state.selectedTalents.size : 0;
    const modal = U.openModal({ title: 'Exportar planilhas', subtitle: 'Gere os dois modelos oficiais, exatamente como o layout original, com o recorte de Talentos que você selecionou.', wide: true, body: '<div data-data-center></div>', footer: '<span class="t4-save-hint" data-data-status>Os arquivos são baixados pelo navegador; nada é enviado a nenhum servidor.</span><button type="button" class="t4-btn" data-cancel>Fechar</button>' });
    const body = modal.querySelector('[data-data-center]'), status = modal.querySelector('[data-data-status]');
    const setStatus = (message, tone = '') => { status.textContent = message; status.className = `t4-save-hint ${tone}`; };
    const render = () => {
      const selectionCopy = selectedCount ? `${selectedCount} Talento${selectedCount === 1 ? '' : 's'} selecionado${selectedCount === 1 ? '' : 's'}` : 'Nenhuma seleção: exportará todos os Talentos carregados';
      body.innerHTML = `<div class="t4-data-hero"><span class="t4-overline">EXPORTAÇÃO OFICIAL</span><h3>Dois modelos, fiéis ao original.</h3><p>Cada exportação preserva abas, cabeçalhos e ordem de campo do arquivo oficial correspondente. Marque os Talentos na lista antes de abrir esta tela para exportar só o recorte escolhido.</p></div><div class="t4-data-cards">${card('Modelo Nectanet', 'Uma aba por Talento marcado para apresentação, no layout de "Mapeamento candidatos - Nectanet".', `<button type="button" class="t4-btn primary" data-data-export="nectanet">Exportar modelo Nectanet</button>`, 'export')}${card('Modelo Talents 4', 'Acompanhamento completo por Talento, no layout de "Mapeamento Talents 4".', `<button type="button" class="t4-btn primary" data-data-export="mapping">Exportar modelo Talents 4</button>`, 'export')}</div><div class="t4-data-export-grid"><div><strong>Os dois de uma vez</strong><p>Gera os dois arquivos com o mesmo recorte.</p><div><button type="button" class="t4-btn sm" data-data-export="both">Exportar os dois modelos</button></div></div><div><strong>Seleção atual</strong><p>${e(selectionCopy)}</p></div></div>`;
      bind();
    };
    const bind = () => {
      modal.querySelector('[data-cancel]')?.addEventListener('click', U.closeModal);
      modal.querySelectorAll('[data-data-export]').forEach((button) => button.addEventListener('click', async () => {
        try { const count = await exportFiles(state, button.dataset.dataExport); U.toast(`${count} Talento${count === 1 ? '' : 's'} exportado${count === 1 ? '' : 's'} no${button.dataset.dataExport === 'both' ? 's' : ''} modelo${button.dataset.dataExport === 'both' ? 's' : ''} oficia${button.dataset.dataExport === 'both' ? 'is' : 'l'}.`, 'success'); setStatus('Exportação concluída. Confira os downloads do navegador.', 'success'); }
        catch (error) { setStatus(error.message || 'Não foi possível exportar.', 'error'); }
      }));
    };
    render(); return modal;
  }

  global.T4ImportExport = Object.freeze({ parseBook, parseBooks, importData, buildNectaWorkbook, buildMappingWorkbook, exportFiles, open, importedPartnerSnapshot });
})(typeof window === 'undefined' ? globalThis : window);
