(function () {
  'use strict';

  const U = window.T4V2;
  const W = window.T4Work;
  const M = window.T4Models;
  const D = window.T4Data;
  const e = U.esc;
  const a = U.attr;

  const AREA_LABELS = Object.freeze({
    talents4: 'Talents 4',
    employers: 'Empresas',
    talents: 'Talentos'
  });

  const AREA_HELP = Object.freeze({
    talents4: 'Documentos gerais do escritório, processos e referências compartilhadas.',
    employers: 'Pastas, contratos e atalhos organizados por empresa.',
    talents: 'Dossiês individuais e checklists ligados aos candidatos.'
  });

  const PROVIDERS = Object.freeze([
    { value: 'drive', label: 'Google Drive' },
    { value: 'dropbox', label: 'Dropbox' },
    { value: 'other', label: 'Outro link' }
  ]);

  const PROCESS_TYPES = Object.freeze([
    'Fachkraft',
    'Ausbildung',
    'Família junto',
    'Família depois',
    'Esposa',
    'Filho(s)'
  ]);

  const CHECKLIST_MARKS = Object.freeze([
    { value: '[ ]', label: '[ ] Pendente / não recebido' },
    { value: '[X]', label: '[X] Concluído / recebido' },
    { value: '[!]', label: '[!] Parcial / exige correção' },
    { value: '[-]', label: '[-] Não aplicável' }
  ]);

  const CHECKLIST_STATUSES = Object.freeze([
    'Pendente',
    'Concluído',
    'Recebido',
    'Conferido',
    'Parcial',
    'Não aplicável',
    'Não feito',
    'Etapa futura',
    'Risco ativo',
    'Incompleto',
    'Não recebido',
    'Não pronto',
    'Sem comprovação',
    'Revisar depois',
    'Aguardar decisão',
    'Recebida',
    'Pendente posterior'
  ]);

  /*
   * Template derived from “Checklist Operacional Lucas Luan Formigari.docx”.
   * The example person's values are intentionally not copied: only the
   * reusable checklist structure is stored for a new candidate.
   */
  const CHECKLIST_SECTIONS = [
    {
      id: 'triagem',
      title: '1. Triagem, entrevistas e proposta',
      items: [
        ['receber-curriculo', 'Receber currículo atualizado do candidato'],
        ['comprovante-endereco', 'Comprovante de endereço + quanto tempo mora no endereço'],
        ['passaporte-valido', 'Conferir passaporte válido'],
        ['nivel-alemao', 'Confirmar nível de alemão e certificado'],
        ['fachkraft-ausbildung', 'Avaliar se o perfil é Fachkraft ou Ausbildung'],
        ['anabin-diploma', 'Avaliar Anerkennung Diploma'],
        ['comprovantes-experiencia', 'Pedir Comprovantes de experiência de trabalho'],
        ['entrevista-preliminar', 'Realizar entrevista preliminar'],
        ['apresentar-empregador', 'Apresentar perfil ao empregador'],
        ['entrevista-empregador', 'Realizar entrevista com empregador'],
        ['aceite-proposta', 'Confirmar aceite da proposta por escrito']
      ]
    },
    {
      id: 'empregador',
      title: '2. Contrato e documentos do empregador',
      items: [
        ['arbeitsvertrag', 'Arbeitsvertrag recebido'],
        ['contrato-conferido', 'Contrato conferido pela Talents 4'],
        ['contrato-assinado', 'Contrato assinado pelo candidato'],
        ['vollmacht-empregador', 'Vollmacht do empregador'],
        ['betriebsnummer', 'Solicitar o Betriebsnummer ao empregador / Perguntar idade empresa'],
        ['untervollmacht-t4', 'Untervollmacht para Talents 4 GmbH'],
        ['ausweis-kunden', 'Ausweis Bevollmächtigte Person (Kunden)'],
        ['ausweis-t4', 'Ausweis Unterbevollmächtigte Person (T4)'],
        ['erklart-beschftigung', 'Erklärung zum Beschäftigungsverhältnis preenchida'],
        ['tatigkeitsbeschreibung', 'Tätigkeitsbeschreibung / descrição da vaga'],
        ['deutschkenntnisse-empregador', 'Bestätigung der Deutschkenntnisse / Zertifikat'],
        ['unterkunft', 'Unterkunftsbestätigung, se houver moradia inicial'],
        ['contrato-t4-empregador', 'Contrato T4/Empregador'],
        ['pagamento-visto', 'Formulário / negociar pagamento processo visto']
      ]
    },
    {
      id: 'candidato',
      title: '3. Documentos do candidato',
      items: [
        ['passaporte-candidato', 'Passaporte do candidato'],
        ['curriculo-alemao', 'Currículo em alemão'],
        ['diploma-formacao', 'Diploma / certificado de formação'],
        ['historico-ementa', 'Histórico E ementa / projeto pedagógico detalhado'],
        ['apostila-haia', 'Apostila de Haia da qualificação'],
        ['traducao-qualificacao', 'Tradução juramentada da qualificação'],
        ['certificado-alemao', 'Certificado de alemão'],
        ['residencia-brasil', 'Comprovante de residência no Brasil'],
        ['foto-biometrica', 'Foto biométrica'],
        ['seguro-entrada', 'Seguro saúde para entrada'],
        ['carta-motivacao', 'Carta de motivação, se Ausbildung'],
        ['aposentadoria-45', 'Plano de aposentadoria +45 anos']
      ]
    },
    {
      id: 'familia',
      title: '4. Família: cônjuge e filhos, se aplicável',
      items: [
        ['familia-quando', 'Confirmar se família vai junto ou depois'],
        ['passaporte-conjuge', 'Passaporte do cônjuge'],
        ['vollmacht-conjuge', 'Vollmacht Familiennachzug do cônjuge'],
        ['certidao-casamento', 'Certidão de casamento de inteiro teor'],
        ['traducao-casamento', 'Tradução certidão de casamento'],
        ['comprovacao-financeira', 'Comprovação financeira'],
        ['moradia-suficiente', 'Confirmação de moradia suficiente'],
        ['passaporte-filhos', 'Passaporte dos filhos'],
        ['certidao-filhos', 'Certidão de nascimento dos filhos'],
        ['traducao-nascimento', 'Tradução certidão nascimento'],
        ['vollmacht-filhos', 'Vollmacht Familiennachzug Kinder'],
        ['autorizacao-guarda', 'Autorização/guarda, se apenas um responsável viajar'],
        ['cv-conjuges', 'Pedir CV dos cônjuges e tentar achar emprego']
      ]
    },
    {
      id: 'lzf',
      title: '5. LZF, reconhecimento e Vorabzustimmung',
      items: [
        ['conferencia-dossie-lzf', 'Conferência final do dossiê antes do LZF'],
        ['envio-lzf', 'Envio ao LZF'],
        ['vereinbarung-lzf', 'Vereinbarung LZF'],
        ['ezb-lzf', 'Envio EZB Erklärung zum Arbeitsverhältinis'],
        ['antrag-ihk-fosa', 'Preencher Antragfomular IHK FOSA'],
        ['acompanhamento-reconhecimento', 'Acompanhamento do reconhecimento Anabin/ZAB/ IHK FOSA'],
        ['teilweise-anerkennung', 'Caso teilweise Anerkennung pedir Qualifizierungsplann pra IHK FOSA'],
        ['bundesagentur', 'Acompanhamento da Bundesagentur für Arbeit'],
        ['vorabzustimmung', 'Recebimento da Vorabzustimmung'],
        ['consulado-correto', 'Conferir encaminhamento ao consulado correto'],
        ['termin-consulado', 'Marcar Termin consulado'],
        ['docs-consulado', 'Preparar docs para consulado']
      ]
    },
    {
      id: 'consulado',
      title: '6. Consulado e VIDEX',
      items: [
        ['atualizar-contrato-ezb', 'Atualizar data contrato de trabalho + EZB'],
        ['videx', 'Preencher VIDEX'],
        ['revisar-videx', 'Revisar VIDEX antes de imprimir'],
        ['passaporte-copias', 'Separar passaporte original e cópias'],
        ['contrato-copias', 'Separar contrato em 2 vias/cópias'],
        ['curriculo-consulado', 'Separar currículo'],
        ['vorab-consulado', 'Separar Vorabzustimmung'],
        ['reconhecimento-consulado', 'Separar reconhecimento Anabin/ZAB, se aplicável'],
        ['seguro-aok', 'Separar seguro saúde (AOK)'],
        ['carta-ausbildung', 'Separar carta de motivação, se Ausbildung'],
        ['atendimento-consular', 'Agendar atendimento consular'],
        ['protocolo-consular', 'Registrar protocolo e previsão'],
        ['stellebeschreibung', 'Stellebeschreibung'],
        ['familia-consulado', 'Preparar mesmas coisas para familia caso necessario']
      ]
    },
    {
      id: 'onboarding',
      title: '7. Viagem, chegada e onboarding',
      items: [
        ['visto-aprovado', 'Confirmar aprovação do visto'],
        ['inicio-empregador', 'Confirmar data de início com empregador'],
        ['passagem', 'Organizar passagem'],
        ['acomodacao', 'Confirmar acomodação inicial'],
        ['chegada-cidade', 'Preparar chegada na cidade'],
        ['onboarding-empresa', 'Onboarding na empresa'],
        ['anmeldung-etapas', 'Anmeldung e etapas locais'],
        ['meldebescheinigung', 'Providenciar com Vermieter o Meldebescheinigung do Proprietario'],
        ['anmeldung-stadt', 'Anmeldung Stadt'],
        ['steuer-id', 'Pedir Steuer ID'],
        ['aok-identificadores', 'Transmitir Steuer ID e REnteversicherungsnummer da AOK para empresa'],
        ['aufenthaltstitel', 'Pedir Aufenhaltstitel se possivel'],
        ['conta-bancaria', 'Abrir conta bancaria']
      ]
    },
    {
      id: 'riscos',
      title: '8. Controle de risco e pendências',
      risk: true,
      items: [
        ['divergencia-endereco', 'Divergência de endereço/CEP'],
        ['sem-apostila', 'Documento sem apostila quando necessária'],
        ['traducao-nao-juramentada', 'Tradução não juramentada'],
        ['vaga-nao-qualificada', 'Vaga pode não ser qualifizierte Beschäftigung'],
        ['salario-incompativel', 'Salário/carga horária incompatível'],
        ['alemao-ausbildung', 'Alemão insuficiente para Ausbildung'],
        ['familia-moradia', 'Família sem moradia suficiente comprovada'],
        ['seguro-ausente', 'Seguro saúde ausente'],
        ['prazo-curto', 'Prazo de início muito curto']
      ]
    }
  ].map(function (section) {
    return {
      id: section.id,
      title: section.title,
      risk: Boolean(section.risk),
      items: section.items.map(function (item) {
        return { id: item[0], label: item[1] };
      })
    };
  });

  const state = {
    nodes: [],
    talents: [],
    employers: [],
    openings: [],
    selections: { rows: [] },
    area: 'talents4',
    folderId: '',
    query: '',
    loaded: false,
    sources: {}
  };

  function value(value) {
    return String(value == null ? '' : value).trim();
  }

  function same(left, right) {
    return M.same ? M.same(left, right) : String(left || '') === String(right || '');
  }

  function listNodes() {
    return (state.nodes || []).filter(function (node) {
      return !node.deleted_at;
    });
  }

  function folders(area) {
    return listNodes().filter(function (node) {
      return node.area === area && node.node_type === 'folder';
    });
  }

  function currentFolder() {
    const folder = folders(state.area).find(function (node) {
      return same(node.id, state.folderId);
    });
    if (!folder) state.folderId = '';
    return folder || null;
  }

  function sourceAvailable() {
    return state.sources && state.sources.nodes && state.sources.nodes.available === true;
  }

  function canWrite() {
    return sourceAvailable() && D.canEdit();
  }

  function displayTalent(talentId) {
    const talent = W.find(state.talents, talentId);
    return talent ? (talent.nome_completo || talent.nome || value(talentId)) : (value(talentId) || 'Talento não encontrado');
  }

  function displayEmployer(employerId) {
    const employer = W.find(state.employers, employerId);
    return employer ? (employer.nome || employer.name || value(employerId)) : (value(employerId) || 'Empresa não encontrada');
  }

  function displayOpening(openingId, employerId) {
    const opening = W.find(state.openings, openingId);
    if (!opening) return '';
    const title = opening.title || opening.cargo || opening.nome || 'Vaga';
    const employer = employerId && !same(opening.employer_id, employerId)
      ? ' · ' + displayEmployer(opening.employer_id)
      : '';
    return title + employer;
  }

  function selectionFor(talentId, employerId, openingId) {
    const rows = state.selections && Array.isArray(state.selections.rows) ? state.selections.rows : [];
    return rows.find(function (row) {
      return (!talentId || same(row.talent_id, talentId))
        && (!employerId || same(row.employer_id, employerId))
        && (!openingId || same(row.opening_id, openingId));
    }) || rows.find(function (row) {
      return (!talentId || same(row.talent_id, talentId))
        && (!employerId || same(row.employer_id, employerId));
    }) || null;
  }

  function contextFor(node) {
    const talent = node && node.talent_id ? displayTalent(node.talent_id) : '';
    const employer = node && node.employer_id ? displayEmployer(node.employer_id) : '';
    const opening = node && node.opening_id ? displayOpening(node.opening_id, node.employer_id) : '';
    return [talent, employer, opening].filter(Boolean).join(' · ');
  }

  function resolvedContext(node) {
    const talent = W.find(state.talents, node && node.talent_id);
    const employer = W.find(state.employers, node && node.employer_id);
    const opening = W.find(state.openings, node && node.opening_id)
      || selectionFor(node && node.talent_id, node && node.employer_id, node && node.opening_id);
    const selection = selectionFor(node && node.talent_id, node && node.employer_id, node && node.opening_id);
    return {
      talent: talent || null,
      employer: employer || null,
      opening: opening && opening.title ? opening : (opening && opening.cargo ? opening : null),
      selection: selection || null,
      candidate: talent ? (talent.nome_completo || talent.nome || '') : displayTalent(node && node.talent_id),
      employerName: employer ? (employer.nome || employer.name || '') : displayEmployer(node && node.employer_id),
      openingName: opening ? (opening.title || opening.cargo || opening.nome || '') : '',
      responsible: talent && (talent.responsavel_interno || talent.responsavel || talent.owner_username)
        || selection && (selection.owner_username || selection.responsible)
        || '',
      openedAt: node && (node.created_at || node.updated_at) || selection && (selection.created_at || selection.updated_at) || '',
      status: selection && (selection.stage || selection.status || selection.status_vinculo) || ''
    };
  }

  function parsePayload(node) {
    let incoming = node && node.payload;
    if (typeof incoming === 'string') {
      try { incoming = JSON.parse(incoming); } catch (_) { incoming = {}; }
    }
    incoming = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
    const base = defaultChecklistPayload();
    const oldSections = Array.isArray(incoming.sections) ? incoming.sections : [];
    const oldHeader = incoming.header && typeof incoming.header === 'object' ? incoming.header : {};
    return {
      version: incoming.version || base.version,
      template: incoming.template || base.template,
      header: Object.assign({}, base.header, oldHeader),
      sections: base.sections.map(function (section) {
        const oldSection = oldSections.find(function (item) { return item && item.id === section.id; }) || {};
        const oldItems = Array.isArray(oldSection.items) ? oldSection.items : [];
        return Object.assign({}, section, {
          items: section.items.map(function (item) {
            const oldItem = oldItems.find(function (candidate) { return candidate && candidate.id === item.id; }) || {};
            return Object.assign({}, item, oldItem, { id: item.id, label: item.label });
          })
        });
      })
    };
  }

  function defaultChecklistPayload() {
    return {
      version: 1,
      template: 'checklist_operacional_v1',
      header: {
        processType: [],
        consulate: '',
        statusGeneral: '',
        lzfResponsible: '',
        generalNotes: ''
      },
      sections: CHECKLIST_SECTIONS.map(function (section) {
        return {
          id: section.id,
          title: section.title,
          risk: Boolean(section.risk),
          items: section.items.map(function (item) {
            return {
              id: item.id,
              label: item.label,
              ok: '[ ]',
              responsible: '',
              status: 'Pendente',
              notes: ''
            };
          })
        };
      })
    };
  }

  function selectedFolderOptions(area, selectedId, candidateId) {
    const blocked = selectedId ? folderDescendantIds(selectedId, area) : new Set();
    const available = folders(area).filter(function (folder) {
      if (blocked.has(String(folder.id))) return false;
      if (!candidateId) return true;
      return !folder.talent_id || same(folder.talent_id, candidateId);
    });
    const options = [{ value: '', label: 'Raiz da área' }];
    available.sort(function (left, right) {
      return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR', { numeric: true });
    }).forEach(function (folder) {
      const target = contextFor(folder);
      options.push({ value: folder.id, label: (target ? target + ' · ' : '') + folder.name });
    });
    return options;
  }

  function talentOptions() {
    return [{ value: '', label: 'Não vinculado' }].concat((state.talents || []).map(function (talent) {
      return { value: talent.id, label: talent.nome_completo || talent.nome || talent.id };
    }));
  }

  function employerOptions() {
    return [{ value: '', label: 'Não vinculado' }].concat((state.employers || []).map(function (employer) {
      return { value: employer.id, label: employer.nome || employer.name || employer.id };
    }));
  }

  function openingOptions() {
    return [{ value: '', label: 'Não vinculado' }].concat((state.openings || []).map(function (opening) {
      return {
        value: opening.id,
        label: (opening.title || opening.cargo || opening.nome || 'Vaga')
          + (opening.employer_id ? ' · ' + displayEmployer(opening.employer_id) : '')
      };
    }));
  }

  function deriveEmployerFromOpening(values, changes) {
    const opening = W.find(state.openings, values.opening_id);
    if (!opening || values.employer_id || !opening.employer_id) return;
    values.employer_id = opening.employer_id;
    if (changes) changes.employer_id = opening.employer_id;
  }

  function nodeParent(row) {
    return row && row.parent_id || state.folderId || '';
  }

  function folderDescendantIds(folderId, area) {
    const blocked = new Set(folderId ? [String(folderId)] : []);
    let changed = true;
    while (changed) {
      changed = false;
      folders(area).forEach(function (folder) {
        if (blocked.has(String(folder.parent_id)) && !blocked.has(String(folder.id))) {
          blocked.add(String(folder.id));
          changed = true;
        }
      });
    }
    return blocked;
  }

  function commonTargetFields() {
    return [
      {
        name: 'talent_id',
        label: 'Talento vinculado',
        type: 'select',
        options: talentOptions(),
        searchable: true,
        help: 'Opcional. O vínculo usa o cadastro canônico de Talentos.'
      },
      {
        name: 'employer_id',
        label: 'Empresa vinculada',
        type: 'select',
        options: employerOptions(),
        searchable: true,
        help: 'Opcional. O vínculo usa o cadastro canônico de Empresas.'
      }
    ];
  }

  function openFolderForm(row) {
    if (!canWrite()) return;
    const editing = Boolean(row && row.id);
    const formRow = Object.assign({}, row || {}, { parent_id: nodeParent(row) });
    W.recordForm({
      table: D.TABLES.documentationNodes,
      row: editing ? row : null,
      title: editing ? 'Editar pasta' : 'Nova pasta',
      subtitle: AREA_LABELS[state.area] + ' · pastas podem conter outras pastas e atalhos',
      submitLabel: editing ? 'Salvar pasta' : 'Criar pasta',
      success: editing ? 'Pasta atualizada.' : 'Pasta criada.',
      fields: [
        {
          name: 'name',
          label: 'Nome da pasta',
          type: 'text',
          required: true,
          placeholder: 'Ex.: Contratos 2026'
        },
        {
          name: 'parent_id',
          label: 'Dentro de',
          type: 'select',
          options: selectedFolderOptions(state.area, editing ? row.id : '', ''),
          searchable: true,
          help: 'Deixe na raiz ou selecione uma pasta existente.'
        }
      ].concat(commonTargetFields()),
      row: formRow,
      prepare: async function (values, changes) {
        if (!editing) {
          values.area = state.area;
          values.node_type = 'folder';
          values.payload = {};
          values.url = null;
          values.provider = null;
          values.opening_id = null;
          values.deleted_at = null;
          values.position = nextPosition(values.parent_id);
        }
        values.parent_id = values.parent_id || null;
        values.talent_id = values.talent_id || null;
        values.employer_id = values.employer_id || null;
        deriveEmployerFromOpening(values, changes);
      },
      after: load
    });
  }

  function openLinkForm(row) {
    if (!canWrite()) return;
    const editing = Boolean(row && row.id);
    const formRow = Object.assign({}, row || {}, { parent_id: nodeParent(row) });
    W.recordForm({
      table: D.TABLES.documentationNodes,
      row: editing ? row : null,
      title: editing ? 'Editar atalho' : 'Novo atalho',
      subtitle: AREA_LABELS[state.area] + ' · Drive, Dropbox ou outro endereço seguro',
      submitLabel: editing ? 'Salvar atalho' : 'Adicionar atalho',
      success: editing ? 'Atalho atualizado.' : 'Atalho adicionado.',
      fields: [
        {
          name: 'name',
          label: 'Nome do atalho',
          type: 'text',
          required: true,
          placeholder: 'Ex.: Pasta de documentos do empregador'
        },
        {
          name: 'provider',
          label: 'Serviço',
          type: 'select',
          options: [{ value: '', label: 'Não informado' }].concat(PROVIDERS),
          required: true
        },
        {
          name: 'url',
          label: 'Link do Drive, Dropbox ou outro',
          type: 'url',
          required: true,
          wide: true,
          placeholder: 'https://...'
        },
        {
          name: 'parent_id',
          label: 'Dentro de',
          type: 'select',
          options: selectedFolderOptions(state.area, '', ''),
          searchable: true
        }
      ].concat(commonTargetFields()).concat([
        {
          name: 'opening_id',
          label: 'Vaga vinculada',
          type: 'select',
          options: openingOptions(),
          searchable: true,
          help: 'Opcional. Mantém o atalho associado a uma vaga já cadastrada.'
        }
      ]),
      row: formRow,
      prepare: async function (values, changes) {
        if (!editing) {
          values.area = state.area;
          values.node_type = 'link';
          values.payload = {};
          values.deleted_at = null;
          values.position = nextPosition(values.parent_id);
        }
        values.parent_id = values.parent_id || null;
        values.provider = values.provider || 'other';
        values.talent_id = values.talent_id || null;
        values.employer_id = values.employer_id || null;
        values.opening_id = values.opening_id || null;
        deriveEmployerFromOpening(values, changes);
      },
      after: load
    });
  }

  function openChecklistForm(row) {
    if (!canWrite()) return;
    const editing = Boolean(row && row.id);
    const folder = currentFolder();
    const formRow = Object.assign({}, row || {}, {
      parent_id: nodeParent(row),
      talent_id: row && row.talent_id || folder && folder.talent_id || ''
    });
    W.recordForm({
      table: D.TABLES.documentationNodes,
      row: editing ? row : null,
      title: editing ? 'Editar vínculo do Checklist Operacional' : 'Adicionar Checklist Operacional',
      subtitle: 'O checklist vem pronto com as 8 etapas do documento padrão e pode ficar em qualquer pasta do candidato.',
      submitLabel: editing ? 'Salvar vínculo' : 'Adicionar checklist',
      success: editing ? 'Vínculo do checklist atualizado.' : 'Checklist Operacional adicionado.',
      fields: [
        {
          name: 'parent_id',
          label: 'Pasta do candidato',
          type: 'select',
          options: selectedFolderOptions('talents', editing ? row.id : '', formRow.talent_id),
          searchable: true,
          required: true,
          help: 'A pasta deve pertencer à área Talentos. Pastas sem candidato também podem ser usadas.'
        },
        {
          name: 'talent_id',
          label: 'Candidato',
          type: 'select',
          options: talentOptions(),
          searchable: true,
          required: true
        },
        {
          name: 'employer_id',
          label: 'Empresa vinculada',
          type: 'select',
          options: employerOptions(),
          searchable: true
        },
        {
          name: 'opening_id',
          label: 'Vaga vinculada',
          type: 'select',
          options: openingOptions(),
          searchable: true
        }
      ],
      row: formRow,
      prepare: async function (values, changes) {
        if (!editing) {
          values.area = 'talents';
          values.node_type = 'checklist';
          values.name = 'Checklist Operacional';
          values.provider = null;
          values.url = null;
          values.payload = defaultChecklistPayload();
          values.deleted_at = null;
          values.position = nextPosition(values.parent_id);
        }
        values.parent_id = values.parent_id || null;
        values.talent_id = values.talent_id || null;
        values.employer_id = values.employer_id || null;
        values.opening_id = values.opening_id || null;
        deriveEmployerFromOpening(values, changes);
      },
      after: load
    });
  }

  function nextPosition(parentId) {
    return listNodes().filter(function (node) {
      return node.area === state.area && (node.parent_id || '') === (parentId || '');
    }).length;
  }

  function areaTabs() {
    return '<div class="t4-doc-area-tabs" role="tablist" aria-label="Área da documentação">'
      + Object.keys(AREA_LABELS).map(function (area) {
        return '<button type="button" role="tab" class="t4-doc-area-tab ' + (state.area === area ? 'is-active' : '')
          + '" aria-selected="' + (state.area === area ? 'true' : 'false') + '" data-action="documentation-area" data-id="' + a(area) + '">'
          + e(AREA_LABELS[area]) + '<small>' + e(AREA_HELP[area]) + '</small></button>';
      }).join('')
      + '</div>';
  }

  function breadcrumb() {
    const current = currentFolder();
    const chain = [];
    let cursor = current;
    const seen = new Set();
    while (cursor && !seen.has(String(cursor.id))) {
      seen.add(String(cursor.id));
      chain.unshift(cursor);
      cursor = folders(state.area).find(function (folder) { return same(folder.id, cursor.parent_id); }) || null;
    }
    return '<nav class="t4-doc-breadcrumb" aria-label="Localização">'
      + '<button type="button" data-action="documentation-open-folder" data-id="" class="' + (!current ? 'is-current' : '') + '">'
      + U.icon('folder') + e(AREA_LABELS[state.area]) + '</button>'
      + chain.map(function (folder, index) {
        return '<span aria-hidden="true">/</span><button type="button" data-action="documentation-open-folder" data-id="' + a(folder.id) + '" class="'
          + (index === chain.length - 1 ? 'is-current' : '') + '">' + e(folder.name) + '</button>';
      }).join('')
      + '</nav>';
  }

  function treeBranch(parentId, depth, trail) {
    const children = folders(state.area).filter(function (folder) {
      return (folder.parent_id || '') === (parentId || '');
    }).sort(function (left, right) {
      return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR', { numeric: true });
    });
    return children.map(function (folder) {
      if (trail.has(String(folder.id))) return '';
      const nextTrail = new Set(trail);
      nextTrail.add(String(folder.id));
      const nested = treeBranch(folder.id, depth + 1, nextTrail);
      return '<li><button type="button" class="t4-doc-tree-button ' + (same(folder.id, state.folderId) ? 'is-current' : '')
        + '" style="--tree-depth:' + depth + '" data-action="documentation-open-folder" data-id="' + a(folder.id) + '">'
        + U.icon('folder') + '<span>' + e(folder.name) + '</span><small>' + countChildren(folder.id) + '</small></button>'
        + (nested ? '<ul>' + nested + '</ul>' : '')
        + '</li>';
    }).join('');
  }

  function folderTree() {
    return '<aside class="t4-doc-tree" aria-label="Pastas da área"><div class="t4-doc-tree-head"><span>Pastas</span><strong>'
      + folders(state.area).length + '</strong></div><ul class="t4-doc-tree-list"><li><button type="button" class="t4-doc-tree-button t4-doc-tree-root '
      + (!state.folderId ? 'is-current' : '') + '" data-action="documentation-open-folder" data-id="">'
      + U.icon('folder') + '<span>Raiz da área</span><small>' + immediateNodes('').length + '</small></button></li>'
      + treeBranch('', 0, new Set()) + '</ul>'
      + (canWrite() ? '<button type="button" class="t4-btn ghost t4-doc-tree-new" data-action="documentation-new-folder">'
        + U.icon('plus') + 'Nova pasta</button>' : '')
      + '</aside>';
  }

  function countChildren(folderId) {
    return listNodes().filter(function (node) {
      return node.area === state.area && same(node.parent_id, folderId);
    }).length;
  }

  function immediateNodes(parentId) {
    const query = U.normalize(state.query);
    return listNodes().filter(function (node) {
      if (node.area !== state.area || (node.parent_id || '') !== (parentId || '')) return false;
      if (!query) return true;
      return U.normalize([node.name, node.provider, contextFor(node)].filter(Boolean).join(' ')).includes(query);
    }).sort(function (left, right) {
      const typeOrder = { folder: 0, checklist: 1, link: 2 };
      const byType = (typeOrder[left.node_type] || 9) - (typeOrder[right.node_type] || 9);
      if (byType) return byType;
      return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR', { numeric: true });
    });
  }

  function nodeProvider(node) {
    return PROVIDERS.find(function (provider) { return provider.value === node.provider; })?.label || 'Link externo';
  }

  function cardActions(node) {
    const editing = canWrite() ? '<button type="button" class="t4-doc-icon-action" data-action="documentation-edit" data-id="' + a(node.id) + '" aria-label="Editar">'
      + U.icon('edit') + '</button><button type="button" class="t4-doc-icon-action danger" data-action="documentation-delete" data-id="' + a(node.id) + '" aria-label="Excluir">'
      + U.icon('trash') + '</button>' : '';
    return '<div class="t4-doc-card-actions">' + editing + '</div>';
  }

  function renderFolderCard(node) {
    return '<article class="t4-doc-card t4-doc-folder-card"><button type="button" class="t4-doc-card-main" data-action="documentation-open-folder" data-id="' + a(node.id) + '">'
      + '<span class="t4-doc-card-icon folder">' + U.icon('folder') + '</span><span class="t4-doc-card-copy"><strong>' + e(node.name)
      + '</strong><small>Pasta · ' + countChildren(node.id) + ' item' + (countChildren(node.id) === 1 ? '' : 's') + '</small>'
      + (contextFor(node) ? '<em>' + e(contextFor(node)) + '</em>' : '') + '</span></button>' + cardActions(node) + '</article>';
  }

  function renderLinkCard(node) {
    const safe = M.safeUrl(node.url);
    const target = contextFor(node);
    return '<article class="t4-doc-card t4-doc-link-card"><span class="t4-doc-card-icon link">' + U.icon('link') + '</span>'
      + '<div class="t4-doc-card-copy"><strong>' + e(node.name) + '</strong><small>' + e(nodeProvider(node)) + '</small>'
      + (target ? '<em>' + e(target) + '</em>' : '') + (safe ? '<a class="t4-doc-link" href="' + a(safe) + '" target="_blank" rel="noopener noreferrer">'
        + U.icon('external') + 'Abrir link</a>' : '<span class="t4-doc-invalid-link">Link não disponível</span>') + '</div>' + cardActions(node) + '</article>';
  }

  function renderChecklistCard(node) {
    const context = resolvedContext(node);
    const payload = parsePayload(node);
    const progress = checklistProgress(payload);
    return '<article class="t4-doc-card t4-doc-checklist-card"><button type="button" class="t4-doc-card-main" data-action="documentation-checklist" data-id="' + a(node.id) + '">'
      + '<span class="t4-doc-card-icon checklist">' + U.icon('check') + '</span><span class="t4-doc-card-copy"><strong>Checklist Operacional</strong>'
      + '<small>Modelo DOCX · ' + progress.complete + '/' + progress.total + ' concluídos</small>'
      + '<em>' + e([context.candidate, context.employerName, context.openingName].filter(Boolean).join(' · ') || 'Sem vínculos complementares') + '</em>'
      + '<span class="t4-doc-progress"><i style="width:' + (progress.total ? Math.round(progress.complete / progress.total * 100) : 0) + '%"></i></span></span></button>'
      + cardActions(node) + '</article>';
  }

  function renderCard(node) {
    if (node.node_type === 'folder') return renderFolderCard(node);
    if (node.node_type === 'checklist') return renderChecklistCard(node);
    return renderLinkCard(node);
  }

  function sourceNotice() {
    if (!sourceAvailable()) {
      return '<div class="t4-doc-migration-note" role="status">' + U.icon('info') + '<div><strong>Documentação ainda não foi ativada no banco.</strong>'
        + '<p>A estrutura da área já está publicada. Revise e aplique manualmente a migração da pasta <code>supabase/talents-v22/documentation/</code>; nenhuma alteração automática será feita.</p></div></div>';
    }
    return W.sourceAlerts(state, ['talents', 'employers', 'openings', 'selections']);
  }

  function browser() {
    const current = currentFolder();
    const rows = immediateNodes(current ? current.id : '');
    const actions = canWrite()
      ? '<div class="t4-doc-browser-actions"><button type="button" class="t4-btn" data-action="documentation-new-link">'
        + U.icon('link') + 'Novo atalho</button>'
        + (state.area === 'talents' ? '<button type="button" class="t4-btn" data-action="documentation-new-checklist">' + U.icon('check') + 'Adicionar Checklist Operacional</button>' : '')
        + '<button type="button" class="t4-btn primary" data-action="documentation-new-folder">' + U.icon('plus') + 'Nova pasta</button></div>'
      : '';
    return '<section class="t4-doc-browser"><div class="t4-doc-browser-head"><div><span class="t4-doc-eyebrow">'
      + e(current ? 'PASTA ATUAL' : 'RAIZ DA ÁREA') + '</span><h2>' + e(current ? current.name : AREA_LABELS[state.area]) + '</h2>'
      + '<p>' + e(current ? (contextFor(current) || 'Pasta de documentação') : AREA_HELP[state.area]) + '</p></div>' + actions + '</div>'
      + (state.query ? '<div class="t4-doc-query-note">Busca por: <strong>' + e(state.query) + '</strong></div>' : '')
      + (rows.length ? '<div class="t4-doc-grid">' + rows.map(renderCard).join('') + '</div>'
        : '<div class="t4-doc-empty"><span class="t4-doc-empty-icon">' + U.icon(state.query ? 'search' : 'folder') + '</span><h3>'
        + (state.query ? 'Nenhum item encontrado' : 'Esta pasta está vazia') + '</h3><p>'
        + (state.query ? 'Tente outro termo de busca.' : 'Crie uma pasta, adicione um atalho ou inclua o checklist do candidato.') + '</p>'
        + (canWrite() && !state.query ? '<div><button type="button" class="t4-btn primary" data-action="documentation-new-folder">' + U.icon('plus') + 'Nova pasta</button>'
          + '<button type="button" class="t4-btn" data-action="documentation-new-link">' + U.icon('link') + 'Novo atalho</button></div>' : '') + '</div>')
      + '</section>';
  }

  function render() {
    const current = currentFolder();
    const total = listNodes().filter(function (node) { return node.area === state.area; }).length;
    app.setCounts({ home: total });
    app.setPrimaryAction('Nova pasta', canWrite() ? function () { openFolderForm(); } : null, { accent: true });
    app.pageRoot.innerHTML = '<div class="t4-doc-page"><header class="t4-doc-intro"><div><span class="t4-doc-eyebrow">CENTRAL DE ARQUIVOS</span>'
      + '<h1>Documentação</h1><p>Organize documentos, atalhos e checklists sem duplicar os cadastros de Talents 4.</p></div>'
      + '<div class="t4-doc-intro-meta"><strong>' + total + '</strong><span>item' + (total === 1 ? '' : 's') + ' nesta área</span></div></header>'
      + areaTabs() + '<div class="t4-doc-toolbar">' + breadcrumb() + '<div class="t4-doc-toolbar-actions">'
      + (current ? '<button type="button" class="t4-btn ghost" data-action="documentation-up">' + U.icon('arrow') + 'Subir um nível</button>' : '')
      + (canWrite() ? '<button type="button" class="t4-btn ghost" data-action="documentation-new-link">' + U.icon('link') + 'Novo atalho</button>' : '')
      + '</div></div>' + sourceNotice() + '<div class="t4-doc-layout">' + folderTree() + browser() + '</div></div>';
  }

  function checklistProgress(payload) {
    const items = (payload.sections || []).flatMap(function (section) { return section.items || []; });
    const complete = items.filter(function (item) {
      return item.ok === '[X]' || ['Concluído', 'Recebido', 'Conferido', 'Recebida'].includes(item.status);
    }).length;
    const partial = items.filter(function (item) {
      return !(item.ok === '[X]' || ['Concluído', 'Recebido', 'Conferido', 'Recebida'].includes(item.status))
        && (item.ok === '[!]' || ['Parcial', 'Incompleto', 'Risco ativo', 'Revisar depois', 'Aguardar decisão'].includes(item.status));
    }).length;
    return { total: items.length, complete: complete, partial: partial, pending: items.length - complete - partial };
  }

  function markClass(mark) {
    return mark === '[X]' ? 'complete' : mark === '[!]' ? 'partial' : mark === '[-]' ? 'na' : 'pending';
  }

  function statusClass(status) {
    const normalized = U.normalize(status);
    if (['concluido', 'recebido', 'conferido', 'recebida'].includes(normalized)) return 'complete';
    if (['parcial', 'incompleto', 'risco ativo', 'revisar depois', 'aguardar decisao'].includes(normalized)) return 'partial';
    if (['nao aplicavel'].includes(normalized)) return 'na';
    return 'pending';
  }

  function statusOptions(selected) {
    return CHECKLIST_STATUSES.map(function (status) {
      return '<option value="' + a(status) + '" ' + (status === selected ? 'selected' : '') + '>' + e(status) + '</option>';
    }).join('');
  }

  function markOptions(selected) {
    return CHECKLIST_MARKS.map(function (mark) {
      return '<option value="' + a(mark.value) + '" ' + (mark.value === selected ? 'selected' : '') + '>' + e(mark.label) + '</option>';
    }).join('');
  }

  function checklistHeader(context, payload, editable) {
    const header = payload.header || {};
    const process = Array.isArray(header.processType) ? header.processType : [];
    const readOnly = function (label, content) {
      return '<div class="t4-doc-check-header"><span>' + e(label) + '</span><strong>' + e(content || 'Não informado') + '</strong></div>';
    };
    const processFields = '<fieldset class="t4-doc-process-types"><legend>Tipo de processo</legend><div>'
      + PROCESS_TYPES.map(function (item) {
        return '<label><input type="checkbox" data-check-process value="' + a(item) + '" ' + (process.includes(item) ? 'checked' : '') + ' ' + (!editable ? 'disabled' : '') + '><span>' + e(item) + '</span></label>';
      }).join('') + '</div></fieldset>';
    const selectField = '<label class="t4-doc-check-edit-field"><span>Consulado responsável</span><input type="text" data-check-consulate value="' + a(header.consulate || '') + '" placeholder="Informe o consulado" ' + (!editable ? 'disabled' : '') + '></label>'
      + '<label class="t4-doc-check-edit-field"><span>Responsável LZF</span><input type="text" data-check-lzf value="' + a(header.lzfResponsible || '') + '" placeholder="Informe o responsável" ' + (!editable ? 'disabled' : '') + '></label>'
      + '<label class="t4-doc-check-edit-field"><span>Status geral</span><input type="text" data-check-general-status value="' + a(header.statusGeneral || context.status || '') + '" placeholder="Ex.: Em andamento" ' + (!editable ? 'disabled' : '') + '></label>';
    return '<div class="t4-doc-check-context"><div class="t4-doc-context-grid">'
      + readOnly('Candidato', context.candidate) + readOnly('Empregador', context.employerName)
      + readOnly('Cargo / Ausbildung', context.openingName) + readOnly('Responsável Talents 4', context.responsible)
      + readOnly('Data de abertura', U.formatDate(context.openedAt)) + readOnly('ID do cadastro', context.talent_id || '')
      + '</div><div class="t4-doc-check-edit-grid">' + processFields + selectField
      + '<label class="t4-doc-check-edit-field wide"><span>Observações gerais</span><textarea data-check-general-notes rows="2" placeholder="Observações do processo" ' + (!editable ? 'disabled' : '') + '>' + e(header.generalNotes || '') + '</textarea></label>'
      + '</div></div>';
  }

  function checklistSection(section, payload, editable) {
    const stored = (payload.sections || []).find(function (item) { return item.id === section.id; }) || section;
    const rows = section.items.map(function (templateItem) {
      const item = (stored.items || []).find(function (candidate) { return candidate.id === templateItem.id; }) || templateItem;
      const mark = item.ok || '[ ]';
      const status = item.status || 'Pendente';
      const lastColumn = section.risk ? 'Ação necessária' : 'Observações';
      return '<tr data-check-row data-section-id="' + a(section.id) + '" data-item-id="' + a(templateItem.id) + '">'
        + '<td class="t4-doc-check-mark-cell"><select class="t4-doc-check-mark ' + markClass(mark) + '" data-check-mark ' + (!editable ? 'disabled' : '') + ' aria-label="Marcador de ' + a(templateItem.label) + '">' + markOptions(mark) + '</select></td>'
        + '<th scope="row"><span>' + e(templateItem.label) + '</span></th>'
        + '<td><input type="text" data-check-responsible value="' + a(item.responsible || '') + '" placeholder="Responsável" ' + (!editable ? 'disabled' : '') + '></td>'
        + '<td><select class="t4-doc-check-status ' + statusClass(status) + '" data-check-status ' + (!editable ? 'disabled' : '') + '>' + statusOptions(status) + '</select></td>'
        + '<td><textarea class="t4-doc-check-notes" data-check-notes rows="2" placeholder="' + a(lastColumn) + '" ' + (!editable ? 'disabled' : '') + '>' + e(item.notes || '') + '</textarea></td>'
        + '</tr>';
    }).join('');
    return '<section class="t4-doc-check-section ' + (section.risk ? 'is-risk' : '') + '" data-check-section="' + a(section.id) + '"><header><div><span>CHECKLIST OPERACIONAL</span><h3>' + e(section.title) + '</h3></div><small>' + section.items.length + ' itens</small></header>'
      + '<div class="t4-doc-check-table"><table><thead><tr><th>OK</th><th>' + (section.risk ? 'Risco' : 'Item') + '</th><th>Responsável</th><th>Status</th><th>' + (section.risk ? 'Ação necessária' : 'Observações') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }

  function checklistPayloadFromDrawer(drawer, node) {
    const previous = parsePayload(node);
    const processType = Array.from(drawer.querySelectorAll('[data-check-process]:checked')).map(function (input) { return input.value; });
    return {
      version: 1,
      template: 'checklist_operacional_v1',
      header: {
        processType: processType,
        consulate: drawer.querySelector('[data-check-consulate]')?.value.trim() || '',
        statusGeneral: drawer.querySelector('[data-check-general-status]')?.value.trim() || '',
        lzfResponsible: drawer.querySelector('[data-check-lzf]')?.value.trim() || '',
        generalNotes: drawer.querySelector('[data-check-general-notes]')?.value.trim() || ''
      },
      sections: CHECKLIST_SECTIONS.map(function (section) {
        const previousSection = previous.sections.find(function (candidate) { return candidate.id === section.id; }) || {};
        return {
          id: section.id,
          title: section.title,
          risk: Boolean(section.risk),
          items: section.items.map(function (templateItem) {
            const previousItem = (previousSection.items || []).find(function (candidate) { return candidate.id === templateItem.id; }) || {};
            const row = drawer.querySelector('[data-check-row][data-section-id="' + CSS.escape(section.id) + '"][data-item-id="' + CSS.escape(templateItem.id) + '"]');
            return {
              id: templateItem.id,
              label: templateItem.label,
              ok: row?.querySelector('[data-check-mark]')?.value || previousItem.ok || '[ ]',
              responsible: row?.querySelector('[data-check-responsible]')?.value.trim() || '',
              status: row?.querySelector('[data-check-status]')?.value || previousItem.status || 'Pendente',
              notes: row?.querySelector('[data-check-notes]')?.value.trim() || ''
            };
          })
        };
      })
    };
  }

  function refreshChecklistRow(row) {
    const mark = row.querySelector('[data-check-mark]');
    const status = row.querySelector('[data-check-status]');
    if (mark) mark.className = 't4-doc-check-mark ' + markClass(mark.value);
    if (status) status.className = 't4-doc-check-status ' + statusClass(status.value);
  }

  function refreshChecklistProgress(drawer) {
    const items = Array.from(drawer.querySelectorAll('[data-check-row]')).map(function (row) {
      return {
        ok: row.querySelector('[data-check-mark]')?.value || '[ ]',
        status: row.querySelector('[data-check-status]')?.value || 'Pendente'
      };
    });
    const complete = items.filter(function (item) { return item.ok === '[X]' || ['Concluído', 'Recebido', 'Conferido', 'Recebida'].includes(item.status); }).length;
    const partial = items.filter(function (item) {
      return !(item.ok === '[X]' || ['Concluído', 'Recebido', 'Conferido', 'Recebida'].includes(item.status))
        && (item.ok === '[!]' || ['Parcial', 'Incompleto', 'Risco ativo', 'Revisar depois', 'Aguardar decisão'].includes(item.status));
    }).length;
    const node = drawer.querySelector('[data-check-progress]');
    if (node) node.innerHTML = '<strong>' + complete + '</strong> concluídos <span>·</span> <strong>' + partial + '</strong> parciais <span>·</span> <strong>' + (items.length - complete - partial) + '</strong> pendentes';
  }

  function openChecklist(node) {
    const context = resolvedContext(node);
    context.talent_id = node.talent_id || '';
    const payload = parsePayload(node);
    const editable = D.canEdit();
    const drawer = U.openDrawer({
      title: 'Checklist Operacional',
      subtitle: [context.candidate, context.employerName, context.openingName].filter(Boolean).join(' · ') || 'Cadastro sem vínculos complementares',
      actions: '<span class="t4-doc-check-progress" data-check-progress></span><button type="button" class="t4-btn primary" data-checklist-save ' + (!editable ? 'disabled' : '') + '>' + U.icon('check') + 'Salvar checklist</button>',
      body: '<div class="t4-doc-checklist">' + checklistHeader(context, payload, editable)
        + '<div class="t4-doc-check-legend"><span>[X] concluído/recebido</span><span>[!] parcial ou exige correção</span><span>[ ] pendente/não recebido</span><span>[-] não aplicável</span></div>'
        + CHECKLIST_SECTIONS.map(function (section) { return checklistSection(section, payload, editable); }).join('')
        + '</div>'
    });
    drawer.classList.add('t4-doc-checklist-drawer');
    refreshChecklistProgress(drawer);
    drawer.querySelectorAll('[data-check-mark], [data-check-status]').forEach(function (control) {
      control.addEventListener('change', function () {
        refreshChecklistRow(control.closest('[data-check-row]'));
        refreshChecklistProgress(drawer);
      });
    });
    drawer.querySelector('[data-checklist-save]')?.addEventListener('click', async function () {
      if (!editable) return;
      const button = drawer.querySelector('[data-checklist-save]');
      button.disabled = true;
      button.textContent = 'Salvando…';
      try {
        const payloadToSave = checklistPayloadFromDrawer(drawer, node);
        await D.update(D.TABLES.documentationNodes, node.id, { payload: payloadToSave }, node.updated_at ? { expectedUpdatedAt: node.updated_at } : {});
        U.toast('Checklist Operacional salvo.', 'success');
        U.closeDrawer();
        await load();
      } catch (error) {
        button.disabled = false;
        button.innerHTML = U.icon('check') + 'Salvar checklist';
        U.toast(W.formatError(error), 'error', 7500);
      }
    });
  }

  async function deleteNode(node) {
    if (!canWrite()) return;
    const children = listNodes().filter(function (candidate) {
      return candidate.area === node.area;
    });
    const descendants = [];
    const collect = function (parentId, depth) {
      children.filter(function (candidate) { return same(candidate.parent_id, parentId); }).forEach(function (candidate) {
        descendants.push({ node: candidate, depth: depth });
        collect(candidate.id, depth + 1);
      });
    };
    collect(node.id, 1);
    const confirmed = await U.confirm({
      title: 'Excluir item da documentação?',
      subtitle: 'A exclusão é reversível no banco por meio do registro arquivado.',
      message: descendants.length ? 'Esta pasta contém ' + descendants.length + ' item(ns). Todos serão ocultados junto com ela.' : 'O item será ocultado da documentação.',
      confirmLabel: 'Excluir',
      danger: true
    });
    if (!confirmed) return;
    const all = descendants.sort(function (left, right) { return right.depth - left.depth; }).map(function (entry) { return entry.node; }).concat(node);
    const timestamp = new Date().toISOString();
    for (const item of all) {
      await D.update(D.TABLES.documentationNodes, item.id, { deleted_at: timestamp }, item.updated_at ? { expectedUpdatedAt: item.updated_at } : {});
    }
    U.toast('Item removido da documentação.', 'success');
    if (same(state.folderId, node.id)) state.folderId = node.parent_id || '';
    await load();
  }

  function action(actionName, id) {
    const node = listNodes().find(function (candidate) { return same(candidate.id, id); });
    if (actionName === 'reload') return load();
    if (actionName === 'documentation-area') {
      state.area = Object.prototype.hasOwnProperty.call(AREA_LABELS, id) ? id : 'talents4';
      state.folderId = '';
      render();
      return;
    }
    if (actionName === 'documentation-open-folder') {
      const folder = id ? folders(state.area).find(function (candidate) { return same(candidate.id, id); }) : null;
      if (id && !folder) return;
      state.folderId = folder ? folder.id : '';
      render();
      return;
    }
    if (actionName === 'documentation-up') {
      const folder = currentFolder();
      state.folderId = folder && folder.parent_id || '';
      render();
      return;
    }
    if (actionName === 'documentation-new-folder') return openFolderForm();
    if (actionName === 'documentation-new-link') return openLinkForm();
    if (actionName === 'documentation-new-checklist') return openChecklistForm();
    if (!node) return;
    if (actionName === 'documentation-edit') {
      return node.node_type === 'folder' ? openFolderForm(node) : node.node_type === 'checklist' ? openChecklistForm(node) : openLinkForm(node);
    }
    if (actionName === 'documentation-delete') return deleteNode(node);
    if (actionName === 'documentation-checklist' && node.node_type === 'checklist') return openChecklist(node);
  }

  const app = U.mount({
    module: 'documentation',
    moduleLabel: 'Documentação',
    defaultView: 'home',
    views: [
      {
        id: 'home',
        label: 'Documentação',
        title: 'Documentação',
        subtitle: 'Pastas, atalhos e checklists ligados aos cadastros canônicos.',
        icon: 'folder'
      }
    ]
  });

  const sources = {
    nodes: {
      label: 'Estrutura de documentação',
      load: function () {
        return D.optionalAll(
          D.TABLES.documentationNodes,
          '*',
          function (query) {
            return query.is('deleted_at', null).order('position', { ascending: true }).order('name', { ascending: true });
          },
          { label: 'Leitura da documentação', orderKeys: ['position', 'name', 'id'] }
        );
      }
    },
    talents: {
      label: 'Talentos',
      load: function () { return D.loadCandidates({ activeOnly: false }); }
    },
    employers: {
      label: 'Empresas',
      load: function () { return D.loadEmployers({ activeOnly: false }); }
    },
    openings: {
      label: 'Vagas',
      load: function () { return D.loadOpenings(); }
    },
    selections: {
      label: 'Seleções',
      load: function () { return D.loadMatches(); }
    }
  };

  const load = W.loader(app, state, sources, render);
  app.setSearchHandler(function (query) {
    state.query = query || '';
    render();
  }, 'Buscar pastas, candidatos, empresas ou links...');
  W.bind(app, {
    action: action
  });
  W.start(app, function () { return load(); }, [
    D.TABLES.documentationNodes,
    D.TABLES.candidates,
    D.TABLES.employers,
    D.TABLES.openings,
    D.TABLES.matches,
    D.TABLES.legacyMatches,
    D.TABLES.legacyLinks
  ]);
})();
