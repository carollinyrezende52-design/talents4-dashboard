(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data;
  const e = U.esc, a = U.attr;

  // Mesma URL pública já embutida em t4-v2-data.js (a chave anônima é
  // pública por design; não é segredo). O caminho /functions/v1/<nome> é o
  // padrão do Supabase para invocar uma Edge Function via fetch.
  const FUNCTIONS_URL = 'https://xcxqtjzlqmncwnhbolnl.supabase.co/functions/v1/admin-users';
  const ROLE_LABELS = { admin: 'Administrador', recrutador: 'Recrutador', viewer: 'Visualizador' };
  const ROLE_OPTIONS = [
    { value: 'admin', label: 'Administrador' },
    { value: 'recrutador', label: 'Recrutador' },
    { value: 'viewer', label: 'Visualizador' }
  ];

  const app = U.mount({
    module: 'settings',
    moduleLabel: 'Configurações',
    defaultView: 'language',
    views: [
      { id: 'language', label: 'Idioma', title: 'Idioma do sistema', subtitle: 'Uma única preferência para todo mundo — só administradores podem alterar.', icon: 'globe' },
      { id: 'users', label: 'Usuários', title: 'Usuários e permissões', subtitle: 'Papel, acesso e contas de login de cada pessoa do sistema.', icon: 'users' }
    ]
  });

  const state = { users: [], settings: [], loaded: false };

  const sources = {
    users: { label: 'Usuários', load: () => D.optionalAll(D.TABLES.users, 'username,nome,role,ativo,auth_uid', (q) => q.order('nome', { ascending: true })) },
    settings: { label: 'Configurações do sistema', load: () => D.optionalAll(D.TABLES.systemSettings, 'key,value,updated_at,updated_by', null, { orderKeys: ['key'] }) }
  };

  const isActive = (row) => !row?.ativo || String(row.ativo).toUpperCase() === 'SIM';
  const settingValue = (key) => state.settings.find((row) => row.key === key)?.value;
  const usersAvailable = () => state.sources?.users?.available === true;
  const settingsAvailable = () => state.sources?.settings?.available === true;

  async function callAdminUsers(action, payload) {
    if (!D.session?.access_token) throw new Error('Sessão ausente. Atualize a página e tente de novo.');
    let response;
    try {
      response = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${D.session.access_token}` },
        body: JSON.stringify({ action, ...payload })
      });
    } catch (_) {
      throw new Error('Não foi possível falar com a função de administração (admin-users). Confirme que ela foi publicada no Supabase.');
    }
    let body = null;
    try { body = await response.json(); } catch (_) { /* resposta sem corpo JSON */ }
    if (!response.ok) throw new Error(body?.error || `Falha na função de administração (HTTP ${response.status}).`);
    return body;
  }

  function languageView() {
    const current = settingsAvailable() ? (settingValue('language') || 'pt') : 'pt';
    if (!settingsAvailable()) {
      return W.section('Idioma do sistema', U.emptyState('Recurso ainda não configurado', 'Aplique a migração 54_settings_users_admin.sql no Supabase para ativar a troca de idioma.'));
    }
    const canManage = D.canAdmin();
    const options = [{ value: 'pt', label: 'Português' }, { value: 'de', label: 'Deutsch (Alemão)' }];
    const picker = canManage
      ? `<form data-language-form class="t4-form-grid"><label class="t4-field"><span class="t4-field-label">Idioma ativo para todo o sistema</span><select name="language">${options.map((o) => `<option value="${a(o.value)}" ${o.value === current ? 'selected' : ''}>${e(o.label)}</option>`).join('')}</select><span class="t4-field-help">Afeta o menu lateral de todas as pessoas imediatamente. Cobertura desta etapa: navegação e rótulos globais — o conteúdo de cada tela ainda está em português.</span></label><button type="submit" class="t4-btn primary">Salvar idioma</button></form>`
      : `<div class="t4-alert info">${U.icon('note')}<div>Idioma atual: <strong>${e(options.find((o) => o.value === current)?.label || current)}</strong>. Só administradores podem alterar.</div></div>`;
    return W.section('Idioma do sistema', picker);
  }

  function userRow(row) {
    const active = isActive(row);
    const canManage = D.canAdmin();
    return `<tr class="${active ? '' : 'is-inactive'}"><td><strong>${e(row.nome || row.username)}</strong><span class="t4-cell-secondary">${e(row.username)}</span></td><td>${U.badge(ROLE_LABELS[row.role] || row.role || 'Visualizador', row.role === 'admin' ? 'info' : '')}</td><td>${active ? U.badge('Ativo', 'success') : U.badge('Desativado', 'warning')}</td><td class="t4-users-actions">${canManage ? `
      <button type="button" class="t4-btn ghost sm" data-action="edit-user-role" data-id="${a(row.username)}">Editar</button>
      ${active
        ? `<button type="button" class="t4-btn ghost sm" data-action="deactivate-user" data-id="${a(row.username)}">Desativar</button>`
        : `<button type="button" class="t4-btn ghost sm" data-action="reactivate-user" data-id="${a(row.username)}">Reativar</button>`}
      <button type="button" class="t4-btn ghost sm danger" data-action="delete-user" data-id="${a(row.username)}">Excluir</button>
    ` : ''}</td></tr>`;
  }

  function usersView() {
    if (!usersAvailable()) return W.section('Usuários', U.emptyState('Sem acesso à lista de usuários', 'Sua conta não tem permissão para ver outros usuários, ou a base ainda não está pronta.'));
    const canManage = D.canAdmin();
    const rows = state.users;
    const table = rows.length
      ? `<div class="t4-table-wrap"><table class="t4-table t4-users-table"><thead><tr><th>Pessoa</th><th>Papel</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${rows.map(userRow).join('')}</tbody></table></div>`
      : U.emptyState('Nenhum usuário encontrado', 'A lista aparece aqui assim que houver contas cadastradas.');
    const newButton = canManage ? W.button('Novo usuário', 'new-user', '', { className: 'sm', icon: 'plus' }) : '';
    return W.section('Usuários e permissões', table, newButton, canManage ? 'Convide, edite o papel ou desative o acesso de quem trabalha no sistema.' : 'Somente administradores podem criar, editar ou desativar contas.');
  }

  function render() {
    const html = { language: languageView, users: usersView }[app.view] || languageView;
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html();
    window.T4I18n?.applyChrome?.(app.pageRoot);
  }

  function newUserForm() {
    return U.openModal({
      title: 'Novo usuário',
      subtitle: 'Um convite por e-mail é enviado para a pessoa definir a própria senha.',
      body: `<form data-new-user-form class="t4-form-grid">
        <label class="t4-field"><span class="t4-field-label">Nome</span><input name="nome" required maxlength="120" placeholder="Nome completo"></label>
        <label class="t4-field"><span class="t4-field-label">E-mail</span><input name="email" type="email" required placeholder="pessoa@exemplo.com"></label>
        <label class="t4-field"><span class="t4-field-label">Identificador (usuário)</span><input name="username" maxlength="40" placeholder="Gerado a partir do e-mail se deixado em branco"></label>
        <label class="t4-field"><span class="t4-field-label">Papel</span><select name="role">${ROLE_OPTIONS.map((o) => `<option value="${a(o.value)}">${e(o.label)}</option>`).join('')}</select></label>
        <div data-form-error role="alert" hidden></div>
      </form>`,
      footer: '<button type="button" class="t4-btn" data-cancel>Cancelar</button><button type="submit" form="" class="t4-btn primary" data-save>Enviar convite</button>'
    });
  }

  function editRoleForm(row) {
    return U.openModal({
      title: `Editar ${row.nome || row.username}`,
      subtitle: 'Nome e papel dentro do sistema.',
      body: `<form data-edit-user-form data-username="${a(row.username)}" class="t4-form-grid">
        <label class="t4-field"><span class="t4-field-label">Nome</span><input name="nome" required maxlength="120" value="${a(row.nome || '')}"></label>
        <label class="t4-field"><span class="t4-field-label">Papel</span><select name="role">${ROLE_OPTIONS.map((o) => `<option value="${a(o.value)}" ${o.value === row.role ? 'selected' : ''}>${e(o.label)}</option>`).join('')}</select></label>
        <div data-form-error role="alert" hidden></div>
      </form>`,
      footer: '<button type="button" class="t4-btn" data-cancel>Cancelar</button><button type="submit" form="" class="t4-btn primary" data-save>Salvar</button>'
    });
  }

  function bindModalForm(modal, formSelector, onSubmit) {
    const form = modal.querySelector(formSelector);
    const errorBox = modal.querySelector('[data-form-error]');
    modal.querySelector('[data-cancel]').addEventListener('click', U.closeModal);
    const save = modal.querySelector('[data-save]');
    save.addEventListener('click', () => form.requestSubmit());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.hidden = true;
      save.disabled = true;
      const originalLabel = save.textContent;
      save.textContent = 'Salvando…';
      try {
        await onSubmit(form);
        U.closeModal();
      } catch (error) {
        errorBox.hidden = false;
        errorBox.textContent = error?.message || 'Não foi possível salvar.';
      } finally {
        save.disabled = false;
        save.textContent = originalLabel;
      }
    });
  }

  async function action(actionName, id) {
    if (actionName === 'new-user') {
      const modal = newUserForm();
      bindModalForm(modal, '[data-new-user-form]', async (form) => {
        await callAdminUsers('create', {
          nome: form.elements.nome.value.trim(),
          email: form.elements.email.value.trim(),
          username: form.elements.username.value.trim(),
          role: form.elements.role.value
        });
        U.toast('Convite enviado. A pessoa recebe um e-mail para definir a senha.', 'success');
        await load(true);
      });
      return;
    }
    if (actionName === 'edit-user-role') {
      const row = state.users.find((item) => item.username === id);
      if (!row) return;
      const modal = editRoleForm(row);
      bindModalForm(modal, '[data-edit-user-form]', async (form) => {
        await D.update(D.TABLES.users, id, { nome: form.elements.nome.value.trim(), role: form.elements.role.value }, { idColumn: 'username', select: false });
        U.toast('Usuário atualizado.', 'success');
        await load(true);
      });
      return;
    }
    if (actionName === 'deactivate-user') {
      const confirmed = await U.confirm({ title: 'Desativar usuário', message: 'A pessoa perde o acesso ao sistema imediatamente. É possível reativar depois.', confirmLabel: 'Desativar', danger: true });
      if (!confirmed) return;
      await callAdminUsers('deactivate', { username: id });
      U.toast('Usuário desativado.', 'success');
      return load(true);
    }
    if (actionName === 'reactivate-user') {
      await callAdminUsers('reactivate', { username: id });
      U.toast('Usuário reativado.', 'success');
      return load(true);
    }
    if (actionName === 'delete-user') {
      const confirmed = await U.confirm({ title: 'Excluir usuário permanentemente', message: 'O login é apagado e não pode ser recuperado. O histórico com o nome desta pessoa continua preservado nos registros existentes.', confirmLabel: 'Excluir permanentemente', danger: true });
      if (!confirmed) return;
      await callAdminUsers('delete', { username: id });
      U.toast('Usuário excluído.', 'success');
      return load(true);
    }
  }

  document.addEventListener('submit', async (event) => {
    if (!event.target.matches('[data-language-form]')) return;
    event.preventDefault();
    const language = event.target.elements.language.value;
    try {
      await D.update(D.TABLES.systemSettings, 'language', { value: language, updated_at: new Date().toISOString(), updated_by: D.profile?.username || null }, { idColumn: 'key', select: false });
      U.toast('Idioma atualizado para todo o sistema.', 'success');
      await load(true);
    } catch (error) { U.toast(error?.message || 'Não foi possível salvar o idioma.', 'error', 7000); }
  });

  const load = W.loader(app, state, sources, render);
  W.bind(app, { action });
  app.onRoute(render);
  W.start(app, () => load(), [D.TABLES.users, D.TABLES.systemSettings]);
})();
