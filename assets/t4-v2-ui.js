/* Componentes de trabalho: tabelas, formulários, leitura parcial e ações comuns. */
(function () {
  'use strict';
  const U = window.T4V2, D = window.T4Data, M = window.T4Models;
  // Referência tardia (não capturada no carregamento do script): t4-v2-ui.js
  // carrega antes de t4-i18n.js, mas t()/language só são chamados dentro de
  // funções executadas bem depois, quando todos os scripts já rodaram.
  const t = (text) => window.T4I18n?.t ? window.T4I18n.t(text) : text;
  const tableStates = new Map();
  // The page re-renders after each checkbox change. Keep the active menu and
  // its search term outside the HTML so multi-select filters do not collapse
  // or lose the user's place while selecting several values.
  let multiOpenKey = '';
  const multiSearch = new Map();
  const e = U.esc, a = U.attr;
  const button = (label, action, id = '', options = {}) => `<button type="button" class="t4-btn ${a(options.className || '')}" data-action="${a(action)}" data-id="${a(id)}" ${options.disabled ? 'disabled' : ''} ${options.title ? `title="${a(options.title)}"` : ''}>${options.icon ? U.icon(options.icon) : ''}${e(label)}</button>`;
  const link = (label, href, icon = '') => `<a class="t4-btn sm" href="${a(href)}">${icon ? U.icon(icon) : ''}${e(label)}</a>`;
  const external = (label, url) => M.safeUrl(url) ? `<a class="t4-text-link" href="${a(M.safeUrl(url))}" target="_blank" rel="noopener noreferrer">${e(label)}${U.icon('external')}</a>` : `<span class="t4-muted">${t('Não informado')}</span>`;
  const normalizedOptions = (options) => options.map((o) => typeof o === 'object' ? o : { value: o, label: U.term(o) });
  const optionsHtml = (options, value, placeholder = null) => {
    const opts = normalizedOptions(options);
    if (M.present(value) && !opts.some((o) => String(o.value) === String(value))) opts.unshift({ value, label: U.term(value) });
    return `${placeholder === null ? '' : `<option value="">${e(placeholder)}</option>`}${opts.map((o) => `<option value="${a(o.value)}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${e(o.label)}</option>`).join('')}`;
  };
  // Selects com dezenas de registros não podem depender de rolagem. O select
  // nativo continua sendo a fonte do valor (preserva teclado, acessibilidade
  // e o contrato de gravação); a busca apenas oculta opções que não batem.
  const searchableSelect = (name, options, value = '', settings = {}) => {
    const list = Array.isArray(options) ? options : [], searchable = settings.searchable === true || list.length > 12;
    const label = settings.label || name, placeholder = settings.placeholder === undefined ? null : settings.placeholder;
    const selectAttrs = settings.attrs || '';
    const native = `<select ${selectAttrs}${searchable ? ` data-searchable-value="${a(name)}"` : ''}>${optionsHtml(list, value, placeholder)}</select>`;
    if (!searchable) return native;
    const searchPlaceholder = settings.searchPlaceholder || `${t('Buscar')} ${String(label).toLocaleLowerCase('pt-BR')}…`;
    return `<span class="t4-searchable-select" data-searchable-select="${a(name)}"><span class="t4-select-search"><span class="t4-sr-only">${t('Buscar')} ${a(label)}</span><input type="search" data-select-search="${a(name)}" placeholder="${a(searchPlaceholder)}" aria-label="${t('Buscar')} ${a(label)}" autocomplete="off"></span>${native}</span>`;
  };
  const filter = (name, label, values, value = '') => `<label class="t4-filter"><span>${e(label)}</span><select data-filter="${a(name)}" aria-label="${a(label)}">${optionsHtml(values, value, `${t('Todos')} · ${label.toLowerCase()}`)}</select></label>`;
  const normalizedMultiOptions = (values) => values.map((o) => {
    const option = typeof o === 'object' ? o : { value: o, label: U.term(o) };
    return { ...option, value: option.value ?? '', label: option.label ?? U.term(option.value) };
  });
  const multiFilter = (name, label, values, selected = []) => {
    const picked = Array.isArray(selected) ? selected.map(String) : M.present(selected) ? [String(selected)] : [];
    const options = normalizedMultiOptions(values);
    const query = multiSearch.get(String(name)) || '';
    const pickedLabel = picked.length ? (window.T4I18n?.language === 'de' ? `${picked.length} ausgewählt` : `${picked.length} selecionado${picked.length > 1 ? 's' : ''}`) : t('Todos');
    return `<details class="t4-multi-filter" data-multi-filter-menu="${a(name)}" ${multiOpenKey === String(name) ? 'open' : ''}><summary aria-label="${t('Filtrar')} ${a(label)}"><span>${e(label)}</span><strong>${pickedLabel}</strong><span class="t4-multi-chevron">${U.icon('chevron')}</span></summary><div class="t4-multi-options"><div class="t4-multi-option-actions"><label class="t4-multi-search"><span class="t4-sr-only">${t('Buscar em')} ${e(label)}</span><input type="search" data-multi-filter-search="${a(name)}" value="${a(query)}" placeholder="${t('Buscar opção…')}" autocomplete="off"></label><button type="button" class="t4-btn ghost sm" data-action="multi-filter-clear" data-id="${a(name)}">${t('Limpar')}</button></div>${options.map((o) => `<label data-multi-filter-option="${a(name)}"><input type="checkbox" data-multi-filter="${a(name)}" value="${a(o.value)}" ${picked.includes(String(o.value)) ? 'checked' : ''}><span>${e(o.label)}</span></label>`).join('') || `<span class="t4-muted">${t('Nenhuma opção disponível.')}</span>`}</div></details>`;
  };
  // Períodos precisam de uma hierarquia própria: o mês corrente fica sempre
  // visível no topo e os demais são agrupados por ano. Os mesmos atributos do
  // multiFilter mantêm teclado, seleção múltipla, busca e o contrato de
  // atualização das telas existentes.
  const periodFilter = (name, label, values, selected = []) => {
    const picked = Array.isArray(selected) ? selected.map(String) : M.present(selected) ? [String(selected)] : [];
    const options = normalizedMultiOptions(values);
    const query = multiSearch.get(String(name)) || '';
    const current = options.find((o) => o.current === true);
    const rest = options.filter((o) => o !== current);
    const groups = new Map();
    rest.forEach((o) => {
      const group = String(o.group || String(o.value).slice(0, 4) || t('Outros'));
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(o);
    });
    const groupEntries = [...groups.entries()].sort(([left], [right]) => String(right).localeCompare(String(left), 'pt-BR', { numeric: true }));
    const optionHtml = (o, className = '') => `<label class="t4-period-option ${a(className)}" data-multi-filter-option="${a(name)}" data-period-year="${a(o.group || String(o.value).slice(0, 4))}" ${o.current ? 'data-period-current="true"' : ''}><input type="checkbox" data-multi-filter="${a(name)}" value="${a(o.value)}" ${picked.includes(String(o.value)) ? 'checked' : ''}><span class="t4-period-option-copy"><strong>${e(o.label)}</strong>${o.secondary ? `<small>${e(o.secondary)}</small>` : ''}</span></label>`;
    const currentHtml = current ? `<section class="t4-period-current"><span class="t4-period-section-label">${t('Mês atual')}</span>${optionHtml(current, 'is-current')}</section>` : '';
    const groupsHtml = groupEntries.map(([year, yearOptions]) => `<section class="t4-period-year"><h4>${e(year)}</h4>${yearOptions.map((o) => optionHtml(o)).join('')}</section>`).join('');
    const pickedLabel = picked.length ? (window.T4I18n?.language === 'de' ? `${picked.length} ausgewählt` : `${picked.length} selecionado${picked.length > 1 ? 's' : ''}`) : t('Todos');
    return `<details class="t4-multi-filter t4-period-filter" data-multi-filter-menu="${a(name)}" ${multiOpenKey === String(name) ? 'open' : ''}><summary aria-label="${t('Filtrar')} ${a(label)}"><span>${e(label)}</span><strong>${pickedLabel}</strong><span class="t4-multi-chevron">${U.icon('chevron')}</span></summary><div class="t4-multi-options t4-period-options"><div class="t4-multi-option-actions"><label class="t4-multi-search"><span class="t4-sr-only">${t('Buscar em')} ${e(label)}</span><input type="search" data-multi-filter-search="${a(name)}" value="${a(query)}" placeholder="${t('Buscar mês ou ano…')}" autocomplete="off"></label><button type="button" class="t4-btn ghost sm" data-action="multi-filter-clear" data-id="${a(name)}">${t('Limpar')}</button></div>${currentHtml}${groupsHtml || `<span class="t4-muted">${t('Nenhum outro período disponível.')}</span>`}</div></details>`;
  };
  const chips = (items, current, action = 'quick') => `<div class="t4-quickfilters" aria-label="${t('Visões rápidas')}">${items.map((x) => `<button type="button" class="t4-quickfilter ${x.id === current ? 'active' : ''}" data-action="${a(action)}" data-id="${a(x.id)}" aria-pressed="${x.id === current}">${x.icon ? U.icon(x.icon) : ''}${e(x.label)}${x.count == null ? '' : `<span>${e(x.count)}</span>`}</button>`).join('')}</div>`;
  const note = (text, tone = 'info') => `<div class="t4-alert ${a(tone)}">${U.icon(tone === 'error' || tone === 'warning' ? 'warning' : 'note')}<div>${e(text)}</div></div>`;
  const section = (title, body, actions = '', subtitle = '') => `<section class="t4-panel"><div class="t4-panel-head"><div><h2>${e(title)}</h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div><div class="t4-panel-actions">${actions}</div></div><div class="t4-panel-body">${body}</div></section>`;
  const person = (name, meta = '', tone = '', action = '', id = '') => `<div class="t4-inline-person"><span class="t4-avatar-sm ${a(tone)}">${e(U.initials(name))}</span><span class="t4-inline-person-copy">${action ? `<button class="t4-row-link" type="button" data-action="${a(action)}" data-id="${a(id)}">${e(name)}</button>` : `<strong>${e(name)}</strong>`}<small>${e(meta)}</small></span></div>`;
  const stack = (title, subtitle = '') => `<span class="t4-cell-primary">${e(title || '—')}</span>${subtitle ? `<span class="t4-cell-secondary">${e(subtitle)}</span>` : ''}`;
  // Use only with HTML generated by a trusted renderer (for example the
  // employer color token). User/database text must continue through stack().
  const stackHtml = (titleHtml, subtitle = '') => `<span class="t4-cell-primary">${titleHtml || '<span class="t4-muted">—</span>'}</span>${subtitle ? `<span class="t4-cell-secondary">${e(subtitle)}</span>` : ''}`;
  const status = (value) => U.badge(value, U.toneForStatus(value));
  const unique = (rows, field) => [...new Set(rows.map((r) => r[field]).filter(M.present))].sort((x, y) => String(x).localeCompare(String(y), 'pt-BR'));
  const find = (rows, id) => rows?.find((r) => M.same(r.id, id));
  // Fonte única para detectar falha de conectividade: usada tanto para
  // escolher a mensagem amigável quanto para decidir se o resultado da
  // gravação ficou incerto (ver saveRecord). Antes disso o segundo uso lia
  // o texto já traduzido por formatError, o que quebrou quando a tradução
  // deixou de repetir a palavra técnica original — checar o erro bruto.
  const isConnectivityError = (error) => error?.message === 'Failed to fetch'
    || (error?.name === 'TypeError' && /fetch|network/i.test(error?.message || ''))
    || /timeout|excedeu/i.test(error?.message || '');
  function formatError(error) {
    if (error?.code === 'PGRST116') return t('O registro mudou, foi removido ou você não tem permissão. Atualize a ficha antes de salvar novamente.');
    if (error?.code === '23505') return t('Já existe um registro com essa identificação. Confira os dados; nenhuma duplicidade foi criada.');
    if (error?.code === '23503') return t('O vínculo informado não existe mais. Atualize os dados e selecione um registro válido.');
    if (error?.code === '42501') return t('Seu perfil não tem permissão para esta operação. Solicite revisão ao administrador.');
    if (isConnectivityError(error)) {
      console.error('[Talents4]', error);
      return t('Falha de conexão com o servidor. Verifique sua internet e tente novamente; nada foi salvo.');
    }
    // error.code sem estar na lista acima só acontece com o formato de erro
    // do Postgres/Supabase (PGRST*, 23xxx, 42xxx…) — a mensagem original é
    // SQL técnico, então não deve ir para a tela; fica só no console do
    // navegador, que é o log técnico disponível nesta pilha sem backend.
    if (error?.code) {
      console.error('[Talents4]', error);
      return t('Não foi possível concluir esta ação no banco agora. Nenhuma alteração parcial foi salva; tente novamente em instantes.');
    }
    return error?.message || String(error);
  }
  function table({ id, rows, columns, empty = t('Nenhum registro neste recorte.'), pageSize = 40, groupBy = null }) {
    const prev = tableStates.get(id) || { page: 0, sort: '', direction: 1, hidden: new Set(), dense: false };
    Object.assign(prev, { rows, columns, empty, pageSize, groupBy });
    tableStates.set(id, prev);
    return `<div class="t4-data-grid" data-table="${a(id)}">${tableBody(id)}</div>`;
  }
  function tableBody(id) {
    const s = tableStates.get(id);
    const col = s.columns.find((c) => c.key === s.sort);
    const rows = col ? [...s.rows].sort((x, y) => {
      const left = col.value?.(x) ?? x[col.key] ?? '', right = col.value?.(y) ?? y[col.key] ?? '';
      return s.direction * (typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'pt-BR', { numeric: true }));
    }) : s.rows;
    const columns = s.columns.filter((c) => !s.hidden.has(c.key));
    const pages = Math.max(1, Math.ceil(rows.length / s.pageSize));
    s.page = Math.max(0, Math.min(s.page, pages - 1));
    const start = s.page * s.pageSize, slice = rows.slice(start, start + s.pageSize);
    let previousGroup = null;
    const lang = window.T4I18n?.language;
    const rowsNoun = lang === 'de' ? (rows.length === 1 ? 'Eintrag' : 'Einträge') : `registro${rows.length === 1 ? '' : 's'}`;
    const rangeLabel = rows.length ? `${start + 1}–${Math.min(start + s.pageSize, rows.length)}` : '0';
    const totalLabel = lang === 'de' ? `${rangeLabel} von ${rows.length}` : `${rangeLabel} de ${rows.length}`;
    const pageLabel = lang === 'de' ? `Seite ${s.page + 1} von ${pages}` : `Página ${s.page + 1} de ${pages}`;
    return `<div class="t4-grid-tools"><span><strong>${rows.length}</strong> ${rowsNoun}</span><div><button type="button" class="t4-btn ghost sm" data-grid-density="${a(id)}" aria-pressed="${s.dense}">${U.icon('list')}${s.dense ? t('Confortável') : t('Compacto')}</button><details class="t4-columns-menu"><summary>${U.icon('columns')}${t('Colunas')}</summary><div>${s.columns.filter((c) => c.label).map((c) => `<label><input type="checkbox" data-grid-column="${a(c.key)}" data-grid-id="${a(id)}" ${s.hidden.has(c.key) ? '' : 'checked'} ${c.required ? 'disabled' : ''}>${e(c.label)}</label>`).join('')}</div></details></div></div>
      ${slice.length ? `<div class="t4-table-wrap"><table class="t4-table ${s.dense ? 'compact' : ''}"><thead><tr>${columns.map((c) => `<th ${s.sort === c.key ? `aria-sort="${s.direction === 1 ? 'ascending' : 'descending'}"` : ''}>${c.sort === false || !c.label ? (c.ariaLabel ? `<span class="t4-sr-only">${e(c.ariaLabel)}</span>` : e(c.label || '')) : `<button type="button" data-grid-sort="${a(c.key)}" data-grid-id="${a(id)}">${e(c.label)}<span aria-hidden="true">${s.sort === c.key ? s.direction === 1 ? '↑' : '↓' : '↕'}</span></button>`}</th>`).join('')}</tr></thead><tbody>${slice.map((r) => {
        const group = s.groupBy?.(r);
        const header = group != null && group !== previousGroup ? `<tr class="t4-group-row"><th colspan="${columns.length}">${e(group)}</th></tr>` : '';
        previousGroup = group;
        return header + `<tr>${columns.map((c) => `<td class="${a(c.className || '')}">${c.render ? c.render(r) : e(r[c.key] ?? '—')}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table></div>` : U.emptyState(t('Nenhum registro encontrado'), s.empty)}
      <div class="t4-pagination"><span>${totalLabel}</span><div><button type="button" class="t4-btn sm" data-grid-page="${s.page - 1}" data-grid-id="${a(id)}" ${s.page === 0 ? 'disabled' : ''}>${t('Anterior')}</button><span>${pageLabel}</span><button type="button" class="t4-btn sm" data-grid-page="${s.page + 1}" data-grid-id="${a(id)}" ${s.page >= pages - 1 ? 'disabled' : ''}>${t('Próxima')}</button></div></div>`;
  }
  function refreshTable(id) {
    const node = document.querySelector(`[data-table="${CSS.escape(id)}"]`);
    if (node) node.innerHTML = tableBody(id);
  }
  document.addEventListener('click', (event) => {
    const sort = event.target.closest('[data-grid-sort]'), page = event.target.closest('[data-grid-page]'), density = event.target.closest('[data-grid-density]');
    if (sort) {
      const s = tableStates.get(sort.dataset.gridId);
      s.direction = s.sort === sort.dataset.gridSort ? -s.direction : 1;
      s.sort = sort.dataset.gridSort; s.page = 0; refreshTable(sort.dataset.gridId);
    } else if (page) { tableStates.get(page.dataset.gridId).page = Number(page.dataset.gridPage); refreshTable(page.dataset.gridId); }
    else if (density) { const s = tableStates.get(density.dataset.gridDensity); s.dense = !s.dense; refreshTable(density.dataset.gridDensity); }
  });
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!target.matches('[data-grid-column]')) return;
    const s = tableStates.get(target.dataset.gridId);
    target.checked ? s.hidden.delete(target.dataset.gridColumn) : s.hidden.add(target.dataset.gridColumn);
    refreshTable(target.dataset.gridId);
  });
  function inputField(f, row) {
    if (f.section) return `<h3 class="t4-form-section">${e(f.section)}</h3>`;
    let value = row[f.name] ?? f.default ?? '';
    if (f.type === 'datetime-local' && value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } else if (f.type === 'date') value = M.dateOnly(value);
    const common = `name="${a(f.name)}" ${f.required ? 'required' : ''} ${f.readonly ? 'disabled' : ''} ${f.min != null ? `min="${a(f.min)}"` : ''} ${f.max != null ? `max="${a(f.max)}"` : ''} ${f.step != null ? `step="${a(f.step)}"` : ''}`;
    const selectOptions = f.options || [];
    const isSearchable = f.type === 'select' && (f.searchable === true || selectOptions.length > 12);
    const isMulti = f.type === 'multi-select';
    const picked = Array.isArray(value) ? value.map(String) : M.present(value) ? [String(value)] : [];
    const multiOptions = normalizedOptions(selectOptions).concat(picked.filter((item) => !selectOptions.some((option) => String(typeof option === 'object' ? option.value : option) === item)).map((item) => ({ value: item, label: U.term(item) })));
    const multiControl = `<div class="t4-form-multi-select" role="group" aria-label="${a(f.label)}">${multiOptions.map((option) => `<label class="t4-form-multi-option"><input type="checkbox" name="${a(f.name)}" value="${a(option.value)}" ${picked.includes(String(option.value)) ? 'checked' : ''} ${f.readonly ? 'disabled' : ''}><span>${e(option.label)}</span></label>`).join('') || `<span class="t4-muted">${t('Nenhum usuário disponível.')}</span>`}</div>`;
    const control = f.type === 'textarea' ? `<textarea ${common} rows="${f.rows || 3}">${e(value)}</textarea>`
      : f.type === 'select' ? searchableSelect(f.name, selectOptions, value, { label: f.label, placeholder: f.placeholder === undefined ? t('Não informado') : f.placeholder, searchable: isSearchable, searchPlaceholder: f.searchPlaceholder, attrs: common })
      : isMulti ? multiControl
      : f.type === 'checkbox' ? `<input type="checkbox" ${common} ${value === true ? 'checked' : ''}>`
      : `<input type="${a(f.type || 'text')}" ${common} value="${a(value)}" ${f.placeholder ? `placeholder="${a(f.placeholder)}"` : ''}>`;
    const tag = isSearchable || isMulti ? 'div' : 'label';
    // Validação em tempo real (pedido explícito): campos de texto/número/
    // data/select simples ganham um espaço para o ícone de check/alerta,
    // preenchido por bindFieldValidation() (chamado dentro de form()) —
    // sem isto o navegador só reclamava na hora de tentar salvar. Campos
    // desabilitados, checkbox e select com busca (não é um <input> simples
    // que o usuário edita direto) ficam de fora: não faz sentido validar
    // "ao vivo" o que não se digita.
    const validatable = !f.readonly && f.type !== 'checkbox' && !isSearchable && !isMulti;
    const controlHtml = validatable ? `<span class="t4-field-control">${control}<span class="t4-field-validity" aria-hidden="true"></span></span>` : control;
    return `<${tag} class="t4-field ${f.wide ? 't4-span-2' : ''} ${f.type === 'checkbox' ? 't4-check-field' : ''}"><span class="t4-field-label">${e(f.label)}${f.required ? ' *' : ''}</span>${controlHtml}${f.help ? `<span class="t4-field-help">${e(f.help)}</span>` : ''}</${tag}>`;
  }
  function bindSearchableSelects(root) {
    root.querySelectorAll?.('[data-select-search]').forEach((search) => {
      const key = search.dataset.selectSearch;
      const select = root.querySelector(`[data-searchable-value="${CSS.escape(key)}"]`);
      if (!select) return;
      const options = [...select.options];
      search.addEventListener('input', () => {
        const query = U.normalize(search.value), selected = String(select.value || '');
        options.forEach((option) => {
          const keep = !query || String(option.value) === selected || U.normalize(option.textContent).includes(query);
          option.hidden = !keep;
        });
      });
    });
  }
  // Ícone de check verde / alerta vermelho ao lado do campo, atualizado a
  // cada tecla — mas só depois que o campo foi tocado (blur) uma vez, para
  // não pintar tudo de vermelho antes do usuário sequer começar a
  // preencher o formulário. Reaproveita a validação nativa do navegador
  // (required/min/max/step/type já vêm nos atributos do <input>, ver
  // inputField) em vez de reimplementar regra por campo.
  function bindFieldValidation(root) {
    root.querySelectorAll('.t4-field-control input, .t4-field-control select, .t4-field-control textarea').forEach((el) => {
      const wrap = el.closest('.t4-field');
      const icon = wrap?.querySelector('.t4-field-validity');
      if (!wrap || !icon) return;
      const paint = () => {
        if (wrap.dataset.touched !== 'true') return;
        const hasValue = String(el.value ?? '').trim() !== '';
        const valid = el.checkValidity();
        wrap.classList.toggle('is-invalid', !valid);
        wrap.classList.toggle('is-valid', valid && hasValue);
        icon.innerHTML = !valid ? U.icon('warning') : hasValue ? U.icon('check') : '';
      };
      el.addEventListener('blur', () => { wrap.dataset.touched = 'true'; paint(); });
      el.addEventListener('input', paint);
      el.addEventListener('change', paint);
    });
  }
  function form({ title, subtitle = '', fields, row = {}, submitLabel = t('Salvar alterações'), onSubmit, notice = '', body = '' }) {
    const modal = U.openModal({ title, subtitle, wide: true,
      body: `${notice ? note(notice) : ''}<form data-editor><div class="t4-form-grid">${fields.map((f) => inputField(f, row)).join('')}</div>${body}<div data-form-error role="alert" hidden></div></form>`,
      footer: `<span class="t4-save-hint">${t('Campos não alterados serão preservados.')}</span><button type="button" class="t4-btn" data-cancel>${t('Cancelar')}</button><button type="submit" class="t4-btn primary" data-save>` + e(submitLabel) + '</button>' });
    const editor = modal.querySelector('form'), backdrop = modal.parentElement, save = modal.querySelector('[data-save]');
    bindSearchableSelects(modal);
    bindFieldValidation(modal);
    const read = () => Object.fromEntries(fields.filter((f) => f.name && !f.readonly).map((f) => {
      const el = editor.elements.namedItem(f.name);
      const value = f.type === 'multi-select'
        ? [...(editor.querySelectorAll?.('input[type="checkbox"]') || [])].filter((node) => node.name === f.name && node.checked).map((node) => node.value)
        : f.type === 'checkbox' ? el.checked : f.type === 'number' ? M.number(el.value) : String(el.value).trim() || null;
      return [f.name, f.type === 'datetime-local' && value ? new Date(value).toISOString() : value];
    }));
    const sameValue = (left, right) => Array.isArray(left) && Array.isArray(right)
      ? left.length === right.length && left.every((value, index) => String(value) === String(right[index]))
      : left === right;
    const initial = read();
    editor.addEventListener('input', () => { backdrop.dataset.dirty = 'true'; });
    editor.addEventListener('change', () => { backdrop.dataset.dirty = 'true'; });
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    save.addEventListener('click', () => editor.requestSubmit());
    editor.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (save.disabled || !editor.reportValidity()) return;
      const values = read(), changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => !sameValue(value, initial[key])));
      const errorBox = modal.querySelector('[data-form-error]');
      errorBox.hidden = true; save.disabled = true; backdrop.dataset.saving = 'true';
      save.textContent = t('Salvando…');
      try {
        await onSubmit(values, changes, { editor, modal });
        backdrop.dataset.dirty = 'false'; backdrop.dataset.saving = 'false'; U.closeModal();
      } catch (error) {
        errorBox.hidden = false; errorBox.innerHTML = note(formatError(error), 'error');
        backdrop.dataset.saving = 'false';
        const uncertain = error.partial || isConnectivityError(error);
        save.disabled = uncertain; save.textContent = uncertain ? t('Atualize e confira a gravação') : submitLabel;
        if (uncertain) errorBox.insertAdjacentHTML('beforeend', note(t('A resposta não confirmou o resultado. Feche e atualize a lista antes de repetir, para evitar duplicidade.'), 'warning'));
      }
    });
    return modal;
  }
  async function saveRecord(table, row, values, changes, id = null) {
    if (row?.id) {
      if (!Object.keys(changes).length) return row;
      return D.update(table, row.id, changes, row.updated_at ? { expectedUpdatedAt: row.updated_at } : {});
    }
    return D.insert(table, { ...values, id: id || D.uuid() });
  }
  function recordForm(options) {
    const newId = D.uuid();
    return form({ ...options, onSubmit: async (values, changes, ui) => {
      if (options.prepare) await options.prepare(values, changes, ui);
      const saved = await saveRecord(options.table, options.row, values, changes, newId);
      U.toast(options.success || t('Registro salvo no Supabase.'), 'success');
      await options.after?.(saved);
    } });
  }
  function sourceAlerts(state, names = Object.keys(state.sources || {})) {
    const warnings = names.flatMap((key) => state.sources?.[key]?.warnings || []);
    const unavailable = names.filter((key) => state.sources?.[key]?.available === false);
    const failed = names.filter((key) => state.sources?.[key]?.error);
    const visibleWarnings = [...(D.readWarnings || []), ...warnings].map((message) => note(message, 'warning')).join('');
    const errors = failed.map((key) => {
      const src = state.sources[key];
      return note(`${src.label || key}: ${formatError(src.error)}${src.stale ? t(' Os dados anteriores foram mantidos.') : ''}`, 'error');
    }).join('');
    if (!unavailable.length) return visibleWarnings + errors;
    const labels = unavailable.map((key) => state.sources[key]?.label || key);
    const stale = names.some((key) => state.sources?.[key]?.stale);
    const details = unavailable.map((key) => `<li>${e(state.sources[key]?.label || key)}${t(': ainda não foi importado; a fila principal continua disponível.')}</li>`).join('');
    const unavailableCopy = labels.length === 1 ? t('Há um conjunto complementar que ainda não foi carregado.') : `${labels.length} ${t('conjuntos complementares ainda não foram carregados.')}`;
    return `${visibleWarnings}${errors}<div class="t4-source-status" role="status"><span class="t4-source-status-icon">${U.icon('info')}</span><div><strong>${t('Dados complementares aguardando importação')}</strong><p>${e(unavailableCopy)} ${t('Use <b>Centro de dados</b> para importar os dois modelos oficiais quando quiser enriquecer o mapeamento.')}${stale ? t(' Os dados anteriores foram mantidos onde possível.') : ''}</p><details><summary>${t('Ver detalhes')}</summary><ul>${details}</ul></details></div></div>`;
  }
  function loader(app, state, sources, render) {
    let pending = null, again = false;
    state.sources = {};
    async function load(background = false) {
      if (pending) { again = true; return pending; }
      app.setSync('loading', t('Atualizando dados'));
      pending = (async () => {
        // T4I18n.ready() já está em andamento desde t4:ready (dentro de
        // D.init, que chamou esta função) — aguardar aqui, ao lado da busca
        // dos dados do próprio módulo em vez de antes dela, garante que
        // T4I18n.t(...) chamado dentro de render() já nasce traduzido, sem
        // atrasar a primeira renderização além do que a própria leitura de
        // dados já levaria (as duas ficam em paralelo, não em fila).
        await Promise.all([
          Promise.all(Object.entries(sources).map(async ([key, spec]) => {
            try {
              const result = await spec.load();
              const wrapped = result && typeof result === 'object' && !Array.isArray(result) && 'available' in result;
              if (wrapped && !result.available) { state.sources[key] = { label: spec.label, available: false }; return; }
              state[key] = wrapped ? result.data : result;
              state.sources[key] = { label: spec.label, available: true, warnings: result?.warnings || [] };
            } catch (error) { state.sources[key] = { label: spec.label, error, stale: state.loaded === true }; }
          })),
          window.T4I18n?.ready?.() ?? Promise.resolve()
        ]);
        state.loaded = true;
        render();
        const issues = D.readWarnings?.length || Object.values(state.sources).some((s) => s.error || s.available === false || s.warnings?.length);
        app.setSync(issues ? 'error' : 'ok', issues ? t('Leitura parcial · veja os avisos') : `${t('Atualizado')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
      })().finally(() => { pending = null; if (again) { again = false; load(true); } });
      return pending;
    }
    return load;
  }
  function bind(app, { action, change }) {
    // Native <details> is intentionally used for keyboard and screen-reader
    // support. Remembering the key makes a rerender feel like one continuous
    // filter interaction instead of closing the popover after every click.
    document.addEventListener('toggle', (event) => {
      const menu = event.target.closest?.('details.t4-multi-filter');
      if (!menu) return;
      const key = menu.dataset.multiFilterMenu || '';
      if (menu.open) multiOpenKey = key;
      else if (multiOpenKey === key) multiOpenKey = '';
    }, true);
    document.addEventListener('click', (event) => {
      const route = event.target.closest?.('[data-route]');
      if (route) { multiOpenKey = ''; multiSearch.clear(); return; }
      if (!event.target.closest?.('details.t4-multi-filter')) multiOpenKey = '';
    }, true);
    document.addEventListener('click', async (event) => {
      const el = event.target.closest('[data-action]');
      if (!el || el.disabled) return;
      if (el.dataset.action === 'clear') {
        multiOpenKey = '';
        multiSearch.clear();
      }
      if (el.dataset.action === 'multi-filter-clear') {
        multiOpenKey = el.dataset.id || '';
        multiSearch.delete(el.dataset.id || '');
      }
      try { await action?.(el.dataset.action, el.dataset.id || '', el, event); }
      catch (error) { U.toast(formatError(error), 'error', 7500); }
    });
    app.pageRoot.addEventListener('input', (event) => {
      if (event.target.matches('[data-multi-filter-search]')) {
        const key = event.target.dataset.multiFilterSearch || '';
        const query = event.target.value.trim().toLocaleLowerCase('pt-BR');
        multiSearch.set(key, event.target.value);
        app.pageRoot.querySelectorAll('[data-multi-filter-option]').forEach((option) => {
          if (option.dataset.multiFilterOption !== key) return;
          option.hidden = Boolean(query) && !option.textContent.toLocaleLowerCase('pt-BR').includes(query);
        });
        return;
      }
      // searchableSelect() (linha ~24) sempre renderizou este campo de
      // busca junto do <select> nativo quando a lista passa de 12 opções,
      // mas nada escutava o input — digitar não filtrava nada. O <select>
      // continua sendo a fonte de valor/acessibilidade; só escondemos as
      // <option> que não combinam, igual ao filtro multi-seleção acima.
      if (event.target.matches('[data-select-search]')) {
        const key = event.target.dataset.selectSearch || '';
        const query = event.target.value.trim().toLocaleLowerCase('pt-BR');
        const select = key && app.pageRoot.querySelector(`select[data-searchable-value="${CSS.escape(key)}"]`);
        if (!select) return;
        [...select.options].forEach((option) => {
          if (!option.value) return;
          option.hidden = Boolean(query) && !option.textContent.toLocaleLowerCase('pt-BR').includes(query);
        });
      }
    });
    app.pageRoot.addEventListener('change', (event) => {
      if (event.target.matches('[data-filter]')) change?.(event.target.dataset.filter, event.target.value);
      if (event.target.matches('[data-multi-filter]')) {
        const key = event.target.dataset.multiFilter;
        multiOpenKey = key;
        const selected = [...app.pageRoot.querySelectorAll('[data-multi-filter]')].filter((node) => node.dataset.multiFilter === key && node.checked).map((node) => node.value);
        change?.(key, selected);
      }
    });
  }
  function start(app, load, tables) {
    let unsubscribe;
    D.init(app).then(async () => {
      await load();
      unsubscribe = D.subscribe(tables, U.debounce(() => load(true), 500));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
    }).catch((error) => {
      app.setSync('error', t('Acesso indisponível'));
      app.pageRoot.innerHTML = note(formatError(error), 'error') + button(t('Tentar novamente'), 'reload', '', { icon: 'refresh' }) + link(t('Abrir login do CRM'), './index.html');
    });
    window.addEventListener('pagehide', () => { unsubscribe?.(); D.dispose(); });
    window.addEventListener('beforeunload', (event) => {
      if (document.querySelector('[data-t4-modal-backdrop][data-dirty="true"]')) { event.preventDefault(); event.returnValue = ''; }
    });
  }
  // Barra agregada de filtros ativos (padrão Airtable — sempre indicar
  // filtro ativo mesmo quando o dropdown que o define está fechado; ver
  // docs/design/REFERENCIAS_UIUX.md). `state` e `keys` vêm da tela que
  // chama; cada chip remove só aquele valor (o filtro continua com os
  // outros valores da mesma categoria, se houver).
  function activeFiltersBar(state, keys, labels, valueLabel = (key, value) => value) {
    const entries = keys.flatMap((key) => (Array.isArray(state[key]) ? state[key] : []).map((value) => ({ key, value })));
    if (!entries.length) return '';
    return `<div class="t4-active-filters" role="status"><span class="t4-af-label">${t('Filtros ativos')}</span>${entries.map(({ key, value }) => `<span class="t4-af-chip">${e(labels[key] || key)}: ${e(valueLabel(key, value))}<button type="button" data-action="active-filter-remove" data-id="${a(JSON.stringify([key, value]))}" aria-label="${t('Remover filtro')} ${a(labels[key] || key)}: ${a(valueLabel(key, value))}">×</button></span>`).join('')}<button type="button" class="t4-af-clear" data-action="clear">${t('Limpar tudo')}</button></div>`;
  }
  // Visualização pensada para os dashboards "Meu dia" — a auditoria de
  // UI/UX encontrou zero visualização de dado em telas que só mostravam
  // números soltos em cartões (ver docs/design/REFERENCIAS_UIUX.md).
  // Funil de progressão: uma barra única, segmentada proporcionalmente por
  // etapa. Etapas com zero registros viram uma nota curta abaixo, para não
  // diluir a leitura das etapas que de fato têm gente.
  function funnelChart(title, subtitle, meta, buckets) {
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    const shown = buckets.filter((b) => b.count > 0);
    const empty = buckets.filter((b) => b.count === 0);
    const top = shown.reduce((best, b) => (!best || b.count > best.count ? b : best), null);
    const header = `<header><div><span class="t4-dist-eyebrow">${e(subtitle)}</span><h3>${e(title)}</h3></div><span class="t4-dist-meta">${e(meta)}</span></header>`;
    if (!shown.length) return `<section class="t4-dist t4-funnel" aria-label="${a(title)}">${header}<p class="t4-funnel-empty">${t('Nenhum registro nas etapas acompanhadas.')}</p></section>`;
    const pct = (b) => total > 0 ? Math.round(b.count / total * 100) : 0;
    const tip = (b) => `${b.label} · ${b.count} · ${pct(b)}%`;
    return `<section class="t4-dist t4-funnel" aria-label="${a(title)}">${header}
      <div class="t4-funnel-bar" role="img" aria-label="${a(shown.map((b) => `${b.label}: ${b.count}`).join(', '))}">${shown.map((b, i) => `<span class="t4-funnel-seg ${a(b.tone || '')} ${b === top ? 'is-top' : ''}" data-bucket="${i}" data-count="${b.count}" style="--seg-width:${Math.round(b.count / total * 1000) / 10}%; --i:${i}" data-tooltip="${a(tip(b))}"></span>`).join('')}</div>
      <ul class="t4-funnel-legend">${shown.map((b, i) => `<li style="--i:${i}"><button type="button" class="t4-funnel-legend-toggle ${a(b.tone || '')} ${b === top ? 'is-top' : ''}" data-bucket="${i}" data-tooltip="${a(tip(b))}" aria-pressed="true"><i aria-hidden="true"></i><span>${e(b.label)}</span><strong>${e(b.count)}</strong></button></li>`).join('')}</ul>
      ${empty.length ? `<p class="t4-funnel-empty">${t('Sem registros agora: ')}${e(empty.map((b) => b.label).join(', '))}.</p>` : ''}</section>`;
  }
  function bindFunnelInteractivity() {
    const closestFunnel = (el) => el.closest?.('.t4-funnel') || null;
    const setHover = (funnel, bucket) => {
      const bar = funnel.querySelector('.t4-funnel-bar');
      const legend = funnel.querySelector('.t4-funnel-legend');
      bar?.classList.toggle('is-active', bucket != null);
      legend?.classList.toggle('is-active', bucket != null);
      bar?.querySelectorAll('.t4-funnel-seg').forEach((seg) => seg.classList.toggle('is-hovered', seg.dataset.bucket === bucket));
      legend?.querySelectorAll('.t4-funnel-legend-toggle').forEach((btn) => btn.classList.toggle('is-hovered', btn.dataset.bucket === bucket));
    };
    const recompute = (bar) => {
      if (!bar) return;
      const segs = [...bar.querySelectorAll('.t4-funnel-seg')];
      const visible = segs.filter((seg) => !seg.classList.contains('is-excluded'));
      const total = visible.reduce((sum, seg) => sum + (Number(seg.dataset.count) || 0), 0);
      visible.forEach((seg) => {
        const pct = total > 0 ? Math.round((Number(seg.dataset.count) || 0) / total * 1000) / 10 : 0;
        seg.style.setProperty('--seg-width', `${pct}%`);
      });
    };
    document.addEventListener('mouseover', (event) => {
      const target = event.target.closest?.('.t4-funnel-seg, .t4-funnel-legend-toggle');
      const funnel = target && closestFunnel(target);
      if (funnel) setHover(funnel, target.dataset.bucket);
    });
    document.addEventListener('mouseout', (event) => {
      const target = event.target.closest?.('.t4-funnel-seg, .t4-funnel-legend-toggle');
      const funnel = target && closestFunnel(target);
      if (funnel && !funnel.contains(event.relatedTarget)) setHover(funnel, null);
    });
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest?.('.t4-funnel-legend-toggle');
      const funnel = toggle && closestFunnel(toggle);
      if (!funnel) return;
      const bar = funnel.querySelector('.t4-funnel-bar');
      const seg = bar?.querySelector(`.t4-funnel-seg[data-bucket="${toggle.dataset.bucket}"]`);
      const excluding = toggle.getAttribute('aria-pressed') !== 'false';
      toggle.setAttribute('aria-pressed', excluding ? 'false' : 'true');
      seg?.classList.toggle('is-excluded', excluding);
      recompute(bar);
    });
  }
  bindFunnelInteractivity();
  // A versão antiga chamava o mesmo componente de distributionChart.
  const distributionChart = funnelChart;
  window.T4Work = Object.freeze({ button, link, external, optionsHtml, searchableSelect, bindSearchableSelects, filter, multiFilter, periodFilter, chips, note, section, person, stack, stackHtml, status, unique, find,
    formatError, table, form, inputField, recordForm, saveRecord, sourceAlerts, loader, bind, start, activeFiltersBar, distributionChart, funnelChart });
})();
