/* Prévia HTML de impressão. Sem serviços externos, canvas ou dados persistidos. */
(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models;
  const e = U.esc, a = U.attr;
  const display = (value) => typeof value === 'boolean' ? value ? 'Sim' : 'Não' : U.term(String(value));
  const DEFINITIONS = [
    ['nome_completo', 'Nome completo', 'Identificação', 'both'],
    ['profissao_principal', 'Profissão', 'Perfil profissional', 'both'],
    ['area_profissional', 'Área', 'Perfil profissional', 'both'],
    ['cidade_atual', 'Cidade atual', 'Identificação', 'both'],
    ['perfil_profissional_para_apresentacao', 'Apresentação profissional', 'Perfil profissional', 'both'],
    ['resumo_profissional', 'Resumo profissional', 'Perfil profissional', 'both'],
    ['resumo_rh_curto', 'Resumo executivo de RH', 'Contexto interno', 'ceo'],
    ['curso_de_graduacao', 'Formação', 'Perfil profissional', 'both'],
    ['universidade', 'Instituição de formação', 'Perfil profissional', 'both'],
    ['posgraduacao', 'Pós-graduação', 'Perfil profissional', 'both'],
    ['experiencia_profissional_tempo', 'Tempo de experiência', 'Perfil profissional', 'both'],
    ['relato_sobre_a_experiencia_profissional', 'Experiência profissional', 'Perfil profissional', 'both'],
    ['nivel_alemao', 'Alemão informado no perfil', 'Idiomas e disponibilidade', 'both'],
    ['_course', 'Acompanhamento de alemão', 'Idiomas e disponibilidade', 'both'],
    ['lingua_estrangeira', 'Outros idiomas', 'Idiomas e disponibilidade', 'both'],
    ['disponibilidade_mudanca', 'Disponibilidade de mudança', 'Idiomas e disponibilidade', 'both'],
    ['documentacao_completa', 'Situação geral da documentação', 'Idiomas e disponibilidade', 'both'],
    ['status_pipeline', 'Etapa de acompanhamento', 'Contexto interno', 'ceo'],
    ['responsavel_interno', 'Responsável interno', 'Contexto interno', 'ceo'],
    ['prioridade_comercial', 'Prioridade interna', 'Contexto interno', 'ceo'],
    ['_selections', 'Seleções e próximos passos', 'Contexto interno', 'ceo'],
    ['observacoes_internas', 'Observações internas', 'Contexto interno', 'ceo'],
    ['pendencia_documental_critica', 'Pendências documentais', 'Contexto interno', 'ceo'],
    ['email', 'E-mail pessoal', 'Dados pessoais opcionais', 'none'],
    ['telefone', 'Telefone pessoal', 'Dados pessoais opcionais', 'none'],
    ['cpf', 'CPF', 'Dados pessoais opcionais', 'none'],
    ['numero_do_passaporte', 'Número do passaporte', 'Dados pessoais opcionais', 'none'],
    ['passaporte_numero', 'Passaporte (registro estruturado)', 'Dados pessoais opcionais', 'none'],
    ['idade', 'Idade', 'Dados pessoais opcionais', 'none']
  ];
  function profile(row, state) {
    const course = state.enrollments.filter((r) => M.same(r.candidate_id, row.id) && ['Matriculado', 'Ativo', 'Pausado'].includes(r.status));
    const matches = state.selections.rows.filter((r) => M.same(r.talent_id, row.id));
    return { ...row,
      _course: course.map((r) => `${W.find(state.classes, r.class_id)?.name || 'Curso'} · Nível ${r.current_level || 'não avaliado'} · Meta ${r.target_level || 'não definida'}`).join('\n'),
      _selections: matches.map((r) => `${W.find(state.employers, r.employer_id)?.nome || 'Empregador'} · ${r.stage}${r.next_action ? ` · ${r.next_action}` : ''}`).join('\n')
    };
  }
  function open(row, state) {
    const values = profile(row, state);
    const selected = new Set(DEFINITIONS.filter(([key, , , preset]) => preset === 'both' && M.present(values[key])).map(([key]) => key));
    const modal = U.openModal({ title: 'Preparar dossiê em PDF', subtitle: 'Escolha os campos na própria prévia antes de imprimir ou salvar.', wide: true,
      body: `<div class="t4-pdf-toolbar"><label>Configuração inicial<select data-pdf-preset><option value="employer">Empregador</option><option value="ceo">CEO / uso interno</option></select></label><span data-pdf-count></span><button type="button" class="t4-btn sm" data-pdf-none>Desmarcar tudo</button></div>${W.note('Confira destinatário, conteúdo e necessidade de cada dado. Dados pessoais identificadores vêm desmarcados. A seleção não altera a ficha.')}
        <div class="t4-print-sheet" data-pdf-sheet><header class="t4-print-header"><div><strong>Talents 4<span>.</span></strong><small>RECRUTAMENTO INTERNACIONAL</small></div><div><span>DOSSIÊ PROFISSIONAL</span><small>${e(U.formatDate(M.today()))}</small></div></header><div class="t4-print-intro"><span class="t4-overline">PERFIL DO TALENTO</span><h1>Apresentação profissional</h1><p data-pdf-audience>Material para apresentação ao empregador</p></div>${[...new Set(DEFINITIONS.map((d) => d[2]))].map((group) => `<section class="t4-print-section" data-pdf-section><h2>${e(group)}</h2>${DEFINITIONS.filter((d) => d[2] === group).map(([key, label]) => `<div class="t4-print-field" data-pdf-field="${a(key)}" data-selected="${selected.has(key)}"><label><input type="checkbox" data-pdf-check="${a(key)}" ${selected.has(key) ? 'checked' : ''} ${!M.present(values[key]) ? 'disabled' : ''}><span>${e(label)}</span></label><div>${e(M.present(values[key]) ? display(values[key]) : 'Não informado — não será incluído')}</div></div>`).join('')}</section>`).join('')}<footer class="t4-print-footer"><span>Talents 4 · Recrutamento internacional</span><span>Compartilhamento direcionado · informações fornecidas no cadastro</span></footer></div>`,
      footer: '<span class="t4-save-hint">Na janela de impressão, escolha “Salvar como PDF”.</span><button type="button" class="t4-btn" data-pdf-close>Voltar</button><button type="button" class="t4-btn primary" data-pdf-export>Imprimir / salvar PDF</button>' });
    modal.classList.add('t4-pdf-modal');
    modal.parentElement.classList.add('t4-print-root');
    const sync = () => {
      modal.querySelectorAll('[data-pdf-check]').forEach((input) => { input.checked = selected.has(input.dataset.pdfCheck); input.closest('[data-pdf-field]').dataset.selected = String(input.checked); });
      modal.querySelectorAll('[data-pdf-section]').forEach((section) => { section.dataset.printEmpty = String(!section.querySelector('[data-selected="true"]')); });
      modal.querySelector('[data-pdf-count]').textContent = `${selected.size} campos selecionados`;
      modal.querySelector('[data-pdf-export]').disabled = selected.size === 0;
    };
    modal.querySelector('[data-pdf-preset]').addEventListener('change', (event) => {
      selected.clear();
      DEFINITIONS.forEach(([key, , , preset]) => { if (M.present(values[key]) && (preset === 'both' || preset === 'ceo' && event.target.value === 'ceo')) selected.add(key); });
      modal.querySelector('[data-pdf-audience]').textContent = event.target.value === 'ceo' ? 'Uso interno · apoio à decisão' : 'Material para apresentação ao empregador'; sync();
    });
    modal.addEventListener('change', (event) => { const key = event.target.dataset.pdfCheck; if (key) { event.target.checked ? selected.add(key) : selected.delete(key); sync(); } });
    modal.querySelector('[data-pdf-none]').addEventListener('click', () => { selected.clear(); sync(); });
    modal.querySelector('[data-pdf-close]').addEventListener('click', U.closeModal);
    modal.querySelector('[data-pdf-export]').addEventListener('click', () => {
      if (!selected.size) return;
      const previous = document.title;
      const identity = selected.has('nome_completo') ? row.nome_completo : 'perfil';
      document.title = `Talents4_${String(identity || 'perfil').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_')}_dossie`;
      window.addEventListener('afterprint', () => { document.title = previous; }, { once: true });
      window.print();
    });
    sync();
  }
  window.T4PDF = Object.freeze({ open, profile, DEFINITIONS });
})();
