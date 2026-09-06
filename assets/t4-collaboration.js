/* Colaboração transversal do CRM: notificações, lembrete de P.O. e chat interno. */
(function () {
  'use strict';
  const U = window.T4V2, D = window.T4Data;
  const e = U.esc, a = U.attr;
  const state = { started: false, notifications: [], notificationsAvailable: false, chatAvailable: false, chatDock: null, chatData: null, activeConversation: '', reminder: null, interval: null, notificationSubscription: null, chatSubscription: null, lastReminderAt: 0, reminderLockAt: 0 };
  const REMINDER_INTERVAL = 45 * 60 * 1000;
  const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const active = (value) => value == null || !/^(false|0|nao|no|inativo|cancelado|concluido|concluida|pronto)$/i.test(norm(value));
  const currentUser = () => String(D.profile?.username || '').trim();
  const displayUser = (username, users = []) => users.find((row) => norm(row.username) === norm(username))?.nome || username || 'Usuário';
  const formatError = (error) => error?.code === '42501' ? 'Seu perfil não tem permissão para esta colaboração.'
    : error?.code === '42703' ? 'Este recurso ainda não foi migrado no Supabase (coluna ausente). Aplique a migração 53 antes de encerrar ou editar uma conversa.'
    : error?.message || 'Não foi possível carregar a colaboração agora.';

  function injectShellActions() {
    const topbar = document.querySelector('.t4-topbar');
    if (!topbar || topbar.querySelector('[data-collab-notifications]')) return;
    topbar.insertAdjacentHTML('beforeend', `<div class="t4-collab-actions" aria-label="Colaboração"><button type="button" class="t4-icon-btn t4-collab-notification-button" data-collab-notifications data-collab-action="notifications" aria-label="Notificações" title="Notificações">${U.icon('bell')}<span class="t4-collab-count" data-collab-count hidden>0</span></button><button type="button" class="t4-btn ghost sm t4-collab-chat-button" data-collab-action="chat" aria-expanded="false" aria-controls="t4-chat-dock">${U.icon('people')}<span>Chat</span></button></div>`);
    paintNotificationButton();
  }

  function notificationBody() {
    const unread = state.notifications.filter((row) => !row.read_at);
    if (!state.notificationsAvailable) return '<div class="t4-collab-empty"><strong>Notificações ainda não configuradas</strong><span>Peça ao administrador do sistema para ativar este recurso.</span></div>';
    if (!state.notifications.length) return '<div class="t4-collab-empty"><strong>Nenhuma notificação</strong><span>Novas agendas, reuniões, resumos e compartilhamentos aparecerão aqui.</span></div>';
    return `<div class="t4-notification-summary"><strong>${unread.length}</strong><span>não lida${unread.length === 1 ? '' : 's'} · últimas 30 notificações preservadas</span></div><div class="t4-notification-list">${state.notifications.map((row) => `<article class="t4-notification-item ${row.read_at ? '' : 'is-unread'}"><div><span class="t4-notification-type">${e(row.type || 'CRM')}</span><h3>${e(row.title || 'Atualização no CRM')}</h3><p>${e(row.body || '')}</p><small>${e(U.formatDate(row.created_at, true))}</small></div>${row.read_at ? '' : `<button type="button" class="t4-btn ghost sm" data-collab-action="notification-read" data-collab-id="${a(row.id)}">Marcar como lida</button>`}</article>`).join('')}</div>`;
  }

  function paintNotificationButton() {
    const button = document.querySelector('[data-collab-notifications]') || document.querySelector('[data-collab-action="notifications"]');
    const count = document.querySelector('[data-collab-count]');
    if (!button || !count) return;
    const unread = state.notifications.filter((row) => !row.read_at).length;
    count.textContent = unread > 99 ? '99+' : String(unread);
    count.hidden = unread === 0;
    button.setAttribute('aria-label', unread ? `Notificações · ${unread} não lidas` : 'Notificações');
  }

  async function loadNotifications(silent = false) {
    try {
      const result = await D.optionalSelect(D.TABLES.notifications, '*', (query) => query.eq('recipient_username', currentUser()).order('created_at', { ascending: false }).limit(30));
      if (!result.available) { state.notificationsAvailable = false; paintNotificationButton(); return; }
      const previous = new Set(state.notifications.map((row) => String(row.id)));
      state.notificationsAvailable = true;
      state.notifications = result.data || [];
      paintNotificationButton();
      if (!silent && previous.size) state.notifications.filter((row) => !previous.has(String(row.id)) && !row.read_at).slice(0, 2).forEach((row) => U.toast(`${row.title || 'Nova atualização'}${row.body ? ` · ${row.body}` : ''}`, 'info', 6000));
    } catch (error) {
      console.warn('[Talents4] notificações indisponíveis:', formatError(error));
    }
  }

  async function openNotifications() {
    await loadNotifications(true);
    const drawer = U.openDrawer({ title: 'Notificações', subtitle: 'Agenda, P.O. compartilhado, reuniões e resumos do CRM.', body: notificationBody() });
    drawer.querySelector('.t4-drawer-body')?.setAttribute('data-collab-notification-body', 'true');
  }

  async function markNotificationRead(id) {
    if (!state.notificationsAvailable || !id) return;
    try {
      await D.update(D.TABLES.notifications, id, { read_at: new Date().toISOString() });
      await loadNotifications(true);
      const body = document.querySelector('[data-collab-notification-body]');
      if (body) body.innerHTML = notificationBody();
    } catch (error) { U.toast(formatError(error), 'error', 6500); }
  }

  async function poOpenTasks() {
    const [tasks, responsibilities] = await Promise.all([
      D.optionalSelect(D.TABLES.tasks, 'id,title,status,due_date,owner_user_key,assigned_user_key,deleted_at', (query) => query.is('deleted_at', null).order('due_date', { ascending: true }).limit(100)),
      D.optionalSelect(D.TABLES.taskResponsibles, 'task_id,username,deleted_at', (query) => query.eq('username', currentUser()).is('deleted_at', null))
    ]);
    if (!tasks.available) return [];
    const assigned = new Set((responsibilities.data || []).filter((row) => !row.deleted_at).map((row) => String(row.task_id)));
    return tasks.data.filter((row) => active(row.status) && (assigned.has(String(row.id)) || norm(row.owner_user_key || row.assigned_user_key) === norm(currentUser())));
  }

  function reminderLockAvailable() {
    const now = Date.now();
    if (state.reminderLockAt && now - state.reminderLockAt < 5 * 60 * 1000) return false;
    state.reminderLockAt = now;
    return true;
  }

  function reminderDue() {
    return !state.lastReminderAt || Date.now() - state.lastReminderAt >= REMINDER_INTERVAL;
  }

  function closeReminder() { state.reminder?.remove(); state.reminder = null; }
  function showReminder(rows) {
    closeReminder();
    const items = rows.slice(0, 5).map((row) => `<li><strong>${e(row.title || 'Tarefa sem título')}</strong><span>${e(row.due_date ? `Prazo: ${U.formatDate(row.due_date)}` : 'Sem prazo definido')}</span></li>`).join('');
    const node = document.createElement('aside');
    node.className = 't4-collab-reminder';
    node.setAttribute('role', 'status');
    node.innerHTML = `<div class="t4-collab-reminder-head"><div><span class="t4-notification-type">P.O. OPERACIONAL</span><h2>${rows.length} pendência${rows.length === 1 ? '' : 's'} em aberto</h2></div><button type="button" class="t4-icon-btn" data-collab-action="close-reminder" aria-label="Dispensar">${U.icon('close')}</button></div><ul>${items}</ul>${rows.length > 5 ? `<small>+ ${rows.length - 5} pendência${rows.length - 5 === 1 ? '' : 's'} no P.O.</small>` : ''}<footer><button type="button" class="t4-btn primary sm" data-collab-action="open-po">Abrir P.O.</button><button type="button" class="t4-btn ghost sm" data-collab-action="close-reminder">Depois</button></footer>`;
    document.body.append(node); state.reminder = node;
    state.lastReminderAt = Date.now();
  }

  async function checkPOReminder() {
    if (!currentUser() || !reminderDue() || !reminderLockAvailable()) return;
    try {
      const rows = await poOpenTasks();
      if (rows.length) showReminder(rows);
    } catch (error) { console.warn('[Talents4] lembrete de P.O. indisponível:', formatError(error)); }
  }

  async function loadUsers() {
    try {
      const result = await D.optionalSelect(D.TABLES.users, D.SELECTS.users || '*');
      return result.available ? result.data.filter((row) => active(row.ativo)) : [];
    } catch (_) { return []; }
  }

  async function loadChatData() {
    const mine = await D.optionalSelect(D.TABLES.chatParticipants, '*', (query) => query.eq('username', currentUser()).is('deleted_at', null));
    if (!mine.available) { state.chatAvailable = false; return { conversations: [], participants: [], users: [] }; }
    const ids = [...new Set(mine.data.map((row) => String(row.conversation_id)))];
    const conversations = ids.length ? await D.optionalSelect(D.TABLES.chatConversations, '*', (query) => query.in('id', ids).is('deleted_at', null).order('updated_at', { ascending: false })) : { available: true, data: [] };
    const participants = ids.length ? await D.optionalSelect(D.TABLES.chatParticipants, '*', (query) => query.in('conversation_id', ids).is('deleted_at', null)) : { available: true, data: [] };
    if (!conversations.available || !participants.available) { state.chatAvailable = false; return { conversations: [], participants: [], users: [] }; }
    state.chatAvailable = true;
    return { conversations: conversations.data || [], participants: participants.data || [], users: await loadUsers() };
  }

  function conversationTitle(conversation, data) {
    const names = data.participants.filter((row) => String(row.conversation_id) === String(conversation.id)).map((row) => displayUser(row.username, data.users)).filter((name) => norm(name) !== norm(displayUser(currentUser(), data.users)));
    return names.length ? `${conversation.title || 'Conversa'} · ${names.join(', ')}` : conversation.title || 'Conversa sem título';
  }

  // O criador ou um participante com role 'owner' pode renomear a conversa,
  // ajustar participantes e encerrar — mesmo critério das policies do banco
  // (t4_collab_conversation_manage), só que avaliado no lado do cliente para
  // decidir o que mostrar. A aplicação real continua sendo do RLS.
  function canManage(conversation, data) {
    if (!conversation) return false;
    if (norm(conversation.created_by) === norm(currentUser())) return true;
    return data.participants.some((row) => String(row.conversation_id) === String(conversation.id) && !row.deleted_at && row.role === 'owner' && norm(row.username) === norm(currentUser()));
  }

  function chatConversationItem(conversation, data) {
    const closed = Boolean(conversation.closed_at);
    return `<button type="button" class="t4-chat-conversation ${String(conversation.id) === String(state.activeConversation) ? 'is-active' : ''} ${closed ? 'is-closed' : ''}" data-collab-action="chat-select" data-collab-id="${a(conversation.id)}">${closed ? `<span class="t4-chat-conversation-flag">${U.icon('archive')}</span>` : ''}<strong>${e(conversation.title || 'Conversa sem título')}</strong><span>${e(conversationTitle(conversation, data).replace(`${conversation.title || 'Conversa'} · `, ''))}</span></button>`;
  }

  function chatList(data) {
    const open = data.conversations.filter((row) => !row.closed_at);
    const closed = data.conversations.filter((row) => row.closed_at);
    return `<aside class="t4-chat-list"><div class="t4-chat-list-head"><div><span class="t4-notification-type">CONVERSAS</span><h3>Chat interno</h3></div><button type="button" class="t4-btn primary sm" data-collab-action="chat-new">Nova conversa</button></div>${open.length ? open.map((row) => chatConversationItem(row, data)).join('') : '<div class="t4-collab-empty"><strong>Nenhuma conversa ativa</strong><span>Abra a primeira conversa com um título e participantes.</span></div>'}${closed.length ? `<div class="t4-chat-list-group-label">Arquivadas</div>${closed.map((row) => chatConversationItem(row, data)).join('')}` : ''}</aside>`;
  }

  async function renderConversation(dock, data, id) {
    state.activeConversation = String(id || '');
    const body = dock.querySelector('.t4-chat-dock-body');
    const conversation = data.conversations.find((row) => String(row.id) === String(id));
    if (!conversation) { body.innerHTML = `${chatList(data)}<div class="t4-chat-empty"><strong>Selecione uma conversa</strong><span>As mensagens permanecem armazenadas por conversa.</span></div>`; return; }
    let messages = [];
    try {
      const result = await D.optionalSelect(D.TABLES.chatMessages, '*', (query) => query.eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(300));
      if (result.available) messages = result.data || [];
    } catch (error) { U.toast(formatError(error), 'error', 6000); }
    const messageHtml = messages.map((message) => `<article class="t4-chat-message ${norm(message.sender_username) === norm(currentUser()) ? 'is-mine' : ''}"><strong>${e(displayUser(message.sender_username, data.users))}</strong><p>${e(message.body || '')}</p><small>${e(U.formatDate(message.created_at, true))}</small></article>`).join('');
    const closed = Boolean(conversation.closed_at);
    const manage = canManage(conversation, data);
    // Editar e encerrar somem para quem não gerencia e para conversas já
    // encerradas — encerrar é definitivo (mesma regra do banco: a policy de
    // update só aceita linhas com closed_at ainda nulo).
    const headerActions = `${!closed && manage ? `<button type="button" class="t4-icon-btn" data-collab-action="chat-edit" data-collab-id="${a(conversation.id)}" aria-label="Editar título e participantes" title="Editar título e participantes">${U.icon('edit')}</button>` : ''}${!closed && manage ? `<button type="button" class="t4-icon-btn" data-collab-action="chat-close-conversation" data-collab-id="${a(conversation.id)}" aria-label="Encerrar conversa" title="Encerrar conversa">${U.icon('archive')}</button>` : ''}<button type="button" class="t4-btn ghost sm" data-collab-action="chat-refresh">Atualizar</button>`;
    const closedBanner = closed ? `<div class="t4-chat-closed-banner">${U.icon('archive')}<span>Encerrada em ${e(U.formatDate(conversation.closed_at, true))}${conversation.closed_by ? ` por ${e(displayUser(conversation.closed_by, data.users))}` : ''} · somente leitura.</span></div>` : '';
    const composer = closed ? '' : `<form class="t4-chat-compose" data-collab-chat-form data-collab-id="${a(conversation.id)}"><textarea name="body" rows="2" required placeholder="Escreva uma mensagem para a equipe…"></textarea><button type="submit" class="t4-btn primary sm">Enviar</button></form>`;
    body.innerHTML = `<div class="t4-chat-layout">${chatList(data)}<section class="t4-chat-thread ${closed ? 'is-closed' : ''}"><header><div><span class="t4-notification-type">CONVERSA</span><h3>${e(conversation.title || 'Conversa sem título')}</h3><p>${e(conversationTitle(conversation, data))}</p></div><div class="t4-chat-thread-actions">${headerActions}</div></header>${closedBanner}<div class="t4-chat-messages">${messageHtml || '<div class="t4-chat-empty"><strong>Conversa criada</strong><span>Envie a primeira mensagem para registrar o contexto.</span></div>'}</div>${composer}</section></div>`;
    const messagesNode = body.querySelector('.t4-chat-messages');
    if (messagesNode) messagesNode.scrollTop = messagesNode.scrollHeight;
  }

  // Painel retrátil (dock) fixado no canto — substitui o modal bloqueante
  // anterior. O elemento persiste no DOM e só alterna `hidden`, preservando
  // conversa/scroll ao reabrir; pedido explícito do usuário, no mesmo
  // espírito de um widget de chat flutuante já comum em produtos B2B.
  function ensureChatDock() {
    let dock = document.getElementById('t4-chat-dock');
    if (dock) return dock;
    dock = document.createElement('aside');
    dock.id = 't4-chat-dock';
    dock.className = 't4-chat-dock';
    dock.hidden = true;
    dock.setAttribute('aria-label', 'Chat interno');
    dock.innerHTML = `<div class="t4-chat-dock-head"><h2>Chat interno</h2><button type="button" class="t4-icon-btn" data-collab-action="chat-close" aria-label="Fechar chat">${U.icon('close')}</button></div><div class="t4-chat-dock-body"><div class="t4-skeleton"></div></div>`;
    document.body.append(dock);
    return dock;
  }

  function setChatOpen(open) {
    const dock = ensureChatDock();
    dock.hidden = !open;
    document.querySelector('[data-collab-action="chat"]')?.setAttribute('aria-expanded', String(open));
    return dock;
  }

  async function toggleChat() {
    const dock = ensureChatDock();
    if (!dock.hidden) { setChatOpen(false); return; }
    setChatOpen(true);
    state.chatDock = dock;
    const data = await loadChatData();
    state.chatData = data;
    const body = dock.querySelector('.t4-chat-dock-body');
    if (!state.chatAvailable) { body.innerHTML = '<div class="t4-collab-empty"><strong>Chat ainda não configurado</strong><span>Peça ao administrador do sistema para ativar este recurso.</span></div>'; return; }
    const fallback = data.conversations.find((row) => !row.closed_at)?.id || data.conversations[0]?.id || '';
    await renderConversation(dock, data, state.activeConversation || fallback);
  }

  async function newConversation(dock) {
    const users = state.chatData?.users?.length ? state.chatData.users : await loadUsers();
    const options = users.filter((row) => norm(row.username) !== norm(currentUser())).map((row) => `<label class="t4-chat-user-option"><input type="checkbox" name="participant" value="${a(row.username)}"><span><strong>${e(row.nome || row.username)}</strong><small>${e(row.username)}</small></span></label>`).join('');
    dock.querySelector('.t4-chat-dock-body').innerHTML = `<form class="t4-chat-new" data-collab-new-chat-form><div class="t4-alert info">Dê um título claro para o assunto. Você participa automaticamente; selecione quem mais poderá acompanhar.</div><label><span>Título da conversa</span><input name="title" required maxlength="120" placeholder="Ex.: Ajustes da seleção de março"></label><fieldset><legend>Participantes</legend><div class="t4-chat-user-grid">${options || '<span class="t4-muted">Nenhum outro usuário ativo encontrado.</span>'}</div></fieldset><div class="t4-chat-new-actions"><button type="button" class="t4-btn ghost" data-collab-action="chat-back">Voltar</button><button type="submit" class="t4-btn primary">Criar conversa</button></div></form>`;
  }

  async function createConversation(form, dock) {
    const title = String(form.elements.title.value || '').trim();
    const participants = [...form.querySelectorAll('input[name="participant"]:checked')].map((input) => input.value);
    if (!title) return;
    const id = D.uuid();
    const conversation = { id, title, created_by: currentUser(), updated_at: new Date().toISOString(), deleted_at: null };
    try {
      // A conversa ainda não possui participante no momento da criação.
      // Usar RETURNING aqui faz a policy de SELECT avaliar uma linha que
      // ainda não é visível para o criador e transforma uma inclusão válida
      // em erro 42501/PGRST116.
      await D.insert(D.TABLES.chatConversations, conversation, { select: false });
      await D.insert(D.TABLES.chatParticipants, [...new Set([currentUser(), ...participants])].map((username) => ({ id: D.uuid(), conversation_id: id, username, role: username === currentUser() ? 'owner' : 'member', deleted_at: null })), { single: false, select: false });
    } catch (error) {
      // Se a segunda operação falhar, não deixe uma conversa sem membros
      // aparecendo posteriormente nem force a equipe a limpar o banco.
      try { await D.update(D.TABLES.chatConversations, id, { deleted_at: new Date().toISOString() }, { select: false }); } catch (_) { /* a primeira inclusão pode ter sido recusada */ }
      throw error;
    }
    U.toast('Conversa criada e armazenada no CRM.', 'success');
    const data = await loadChatData(); state.chatData = data; state.activeConversation = id; await renderConversation(dock, data, id);
  }

  // Reaproveita a mesma tela de "Nova conversa", pré-preenchida — o usuário
  // atual nunca aparece na lista de participantes (já está incluído por
  // padrão), então não há como se remover sem querer por esta tela.
  async function editConversation(dock, id) {
    const data = state.chatData;
    const conversation = data?.conversations.find((row) => String(row.id) === String(id));
    if (!conversation) return;
    const currentUsernames = new Set((data.participants || []).filter((row) => String(row.conversation_id) === String(id) && !row.deleted_at).map((row) => norm(row.username)));
    const users = data.users?.length ? data.users : await loadUsers();
    const options = users.filter((row) => norm(row.username) !== norm(currentUser())).map((row) => `<label class="t4-chat-user-option"><input type="checkbox" name="participant" value="${a(row.username)}" ${currentUsernames.has(norm(row.username)) ? 'checked' : ''}><span><strong>${e(row.nome || row.username)}</strong><small>${e(row.username)}</small></span></label>`).join('');
    dock.querySelector('.t4-chat-dock-body').innerHTML = `<form class="t4-chat-new" data-collab-edit-chat-form data-collab-id="${a(id)}"><div class="t4-alert info">Ajuste o título e quem acompanha esta conversa. Você continua participando automaticamente.</div><label><span>Título da conversa</span><input name="title" required maxlength="120" value="${a(conversation.title || '')}"></label><fieldset><legend>Participantes</legend><div class="t4-chat-user-grid">${options || '<span class="t4-muted">Nenhum outro usuário ativo encontrado.</span>'}</div></fieldset><div class="t4-chat-new-actions"><button type="button" class="t4-btn ghost" data-collab-action="chat-back">Cancelar</button><button type="submit" class="t4-btn primary">Salvar alterações</button></div></form>`;
  }

  async function saveConversationEdit(form, dock) {
    const id = form.dataset.collabId;
    const title = String(form.elements.title.value || '').trim();
    const desired = [...form.querySelectorAll('input[name="participant"]:checked')].map((input) => input.value);
    if (!title || !id) return;
    const data = state.chatData;
    const conversation = data?.conversations.find((row) => String(row.id) === String(id));
    const currentRows = (data?.participants || []).filter((row) => String(row.conversation_id) === String(id) && !row.deleted_at);
    const currentUsernames = new Set(currentRows.map((row) => norm(row.username)));
    const desiredUsernames = new Set(desired.map(norm));
    const removed = currentRows.filter((row) => norm(row.username) !== norm(currentUser()) && !desiredUsernames.has(norm(row.username)));
    const added = desired.filter((username) => !currentUsernames.has(norm(username)));
    if (conversation && title !== conversation.title) await D.update(D.TABLES.chatConversations, id, { title, updated_at: new Date().toISOString() }, { select: false });
    await Promise.all(removed.map((row) => D.update(D.TABLES.chatParticipants, row.id, { deleted_at: new Date().toISOString() }, { select: false })));
    if (added.length) await D.insert(D.TABLES.chatParticipants, added.map((username) => ({ id: D.uuid(), conversation_id: id, username, role: 'member', deleted_at: null })), { single: false, select: false });
    U.toast('Conversa atualizada.', 'success');
    const fresh = await loadChatData(); state.chatData = fresh; state.activeConversation = id; await renderConversation(dock, fresh, id);
  }

  async function closeConversation(dock, id) {
    const confirmed = await U.confirm({
      title: 'Encerrar conversa',
      subtitle: 'Esta ação não pode ser desfeita.',
      message: 'A conversa vai para o arquivo e não poderá mais ser editada nem receber novas mensagens. O histórico continua disponível para consulta.',
      confirmLabel: 'Encerrar conversa',
      danger: true
    });
    if (!confirmed) return;
    await D.update(D.TABLES.chatConversations, id, { closed_at: new Date().toISOString(), closed_by: currentUser() }, { select: false });
    U.toast('Conversa encerrada e movida para o arquivo.', 'success');
    const data = await loadChatData(); state.chatData = data; await renderConversation(dock, data, id);
  }

  async function sendMessage(form, dock) {
    const body = String(form.elements.body.value || '').trim();
    const id = form.dataset.collabId;
    if (!body || !id) return;
    await D.insert(D.TABLES.chatMessages, { id: D.uuid(), conversation_id: id, sender_username: currentUser(), body, created_at: new Date().toISOString() });
    form.elements.body.value = '';
    const data = await loadChatData(); state.chatData = data; await renderConversation(dock, data, id);
  }

  async function handleClick(event) {
    const element = event.target.closest?.('[data-collab-action]');
    if (!element) return;
    const action = element.dataset.collabAction, id = element.dataset.collabId || '';
    try {
      if (action === 'notifications') return openNotifications();
      if (action === 'notification-read') return markNotificationRead(id);
      if (action === 'close-reminder') return closeReminder();
      if (action === 'open-po') { location.href = './organizacional.html?view=operations'; return; }
      if (action === 'chat') return toggleChat();
      if (action === 'chat-close') { setChatOpen(false); return; }
      if (action === 'chat-new' && state.chatDock) return newConversation(state.chatDock);
      if (action === 'chat-edit' && state.chatDock && id) return editConversation(state.chatDock, id);
      if (action === 'chat-close-conversation' && state.chatDock && id) return closeConversation(state.chatDock, id);
      if (action === 'chat-back' && state.chatDock) return renderConversation(state.chatDock, state.chatData || { conversations: [], participants: [], users: [] }, state.activeConversation);
      if (action === 'chat-select' && state.chatDock) return renderConversation(state.chatDock, state.chatData, id);
      if (action === 'chat-refresh' && state.chatDock) { const data = await loadChatData(); state.chatData = data; return renderConversation(state.chatDock, data, state.activeConversation); }
    } catch (error) { U.toast(formatError(error), 'error', 7000); }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (form.matches('[data-collab-chat-form]')) { event.preventDefault(); try { await sendMessage(form, state.chatDock); } catch (error) { U.toast(formatError(error), 'error', 7000); } }
    if (form.matches('[data-collab-new-chat-form]')) { event.preventDefault(); try { await createConversation(form, state.chatDock); } catch (error) { U.toast(formatError(error), 'error', 7000); } }
    if (form.matches('[data-collab-edit-chat-form]')) { event.preventDefault(); try { await saveConversationEdit(form, state.chatDock); } catch (error) { U.toast(formatError(error), 'error', 7000); } }
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape') return;
    const dock = document.getElementById('t4-chat-dock');
    if (dock && !dock.hidden) setChatOpen(false);
  }

  function subscribe() {
    try {
      state.notificationSubscription = D.subscribe([D.TABLES.notifications], () => loadNotifications(false), { name: 'collaboration-notifications' });
      state.chatSubscription = D.subscribe([D.TABLES.chatMessages, D.TABLES.chatConversations, D.TABLES.chatParticipants], async () => {
        if (!state.chatDock?.isConnected || state.chatDock.hidden) return;
        const data = await loadChatData(); state.chatData = data; await renderConversation(state.chatDock, data, state.activeConversation);
      }, { name: 'collaboration-chat' });
    } catch (_) { /* As tabelas novas são opcionais até a migração ser aplicada. */ }
  }

  function start() {
    if (state.started || window.T4_DEMO || !D.session || !D.profile) return;
    state.started = true;
    injectShellActions();
    loadNotifications(false);
    checkPOReminder();
    state.interval = window.setInterval(checkPOReminder, REMINDER_INTERVAL);
    subscribe();
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('pagehide', () => { window.clearInterval(state.interval); state.notificationSubscription?.(); state.chatSubscription?.(); });
  }

  document.addEventListener('t4:ready', start, { once: true });
  window.T4Collaboration = Object.freeze({ start, openChat: toggleChat, openNotifications, refresh: () => loadNotifications(true) });
})();
