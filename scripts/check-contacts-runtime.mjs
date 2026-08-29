import fs from 'node:fs';
import vm from 'node:vm';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach(name => this.values.add(name)); }
  remove(...names) { names.forEach(name => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name); else this.values.delete(name);
    return enabled;
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.innerHTML = '';
    this.textContent = '';
    this.className = '';
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.attributes = new Map();
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  dispatch(type, extra = {}) { return this.listeners.get(type)?.({ target: this, preventDefault() {}, ...extra }); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  focus() {}
  reset() {}
}

const html = fs.readFileSync('contatos.html', 'utf8');
const testRole = process.env.CONTACTS_TEST_ROLE === 'viewer' ? 'viewer' : 'recrutador';
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const elements = new Map(ids.map(id => [id, new FakeElement(id)]));
const modalIds = ['contact-modal', 'interaction-modal', 'followup-modal', 'relationship-modal', 'category-modal'];
modalIds.forEach(id => { elements.get(id).hidden = true; });

const navViews = ['all', 'people', 'organizations', 'followups', 'duplicates'].map(view => {
  const element = new FakeElement();
  element.dataset.contactView = view;
  return element;
});
const closeButtons = modalIds.map(id => {
  const element = new FakeElement();
  element.dataset.closeModal = id;
  return element;
});
const personOnly = [new FakeElement(), new FakeElement()];
const organizationOnly = [new FakeElement()];

const documentListeners = new Map();
globalThis.document = {
  readyState: 'complete',
  body: { style: {} },
  getElementById: id => elements.get(id) || null,
  querySelectorAll: selector => {
    if (selector === '[data-contact-view]') return navViews;
    if (selector === '[data-close-modal]') return closeButtons;
    if (selector === '.contacts-modal-overlay') return modalIds.map(id => elements.get(id));
    if (selector === '.person-only') return personOnly;
    if (selector === '.organization-only') return organizationOnly;
    return [];
  },
  addEventListener: (type, callback) => documentListeners.set(type, callback)
};
globalThis.window = globalThis;
globalThis.location = { replace() { throw new Error('Redirecionamento inesperado durante o teste.'); } };
globalThis.sessionStorage = {
  getItem: key => key === 't4_session' ? JSON.stringify({ user: 'carol', nome: 'Carolliny', role: testRole }) : null
};
globalThis.confirm = () => true;

const now = Date.now();
const mockData = {
  contact_records: [
    {
      id: '11111111-1111-4111-8111-111111111111', entity_type: 'Pessoa', display_name: 'Ana <Teste>',
      email: 'ana@example.com', phone: '+49 123 456789', status: 'Ativo', relationship_stage: 'Relacionamento',
      priority: 'Normal', owner_username: 'carol', last_interaction_at: new Date(now - 86400000).toISOString(),
      last_interaction_type: 'E-mail', next_followup_at: new Date(now + 3600000).toISOString(), archived_at: null,
      primary_organization_id: '22222222-2222-4222-8222-222222222222'
    },
    {
      id: '22222222-2222-4222-8222-222222222222', entity_type: 'Organização', display_name: 'Pizzaria Exemplo',
      email: 'contato@pizzaria.example', status: 'Ativo', relationship_stage: 'Novo', priority: 'Normal',
      owner_username: 'carol', archived_at: null
    },
    {
      id: '33333333-3333-4333-8333-333333333333', entity_type: 'Pessoa', display_name: 'Registro arquivado',
      email: 'arquivo@example.com', status: 'Arquivado', relationship_stage: 'Encerrado', priority: 'Baixa',
      archived_at: new Date(now - 86400000).toISOString()
    }
  ],
  contact_categories: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Parceiro', slug: 'parceiro', color: '#D97706', is_active: true, is_system: true, sort_order: 10 }
  ],
  contact_record_categories: [
    { contact_id: '11111111-1111-4111-8111-111111111111', category_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
  ],
  contact_followups: [
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', contact_id: '11111111-1111-4111-8111-111111111111', title: 'Retornar contato', due_at: new Date(now + 3600000).toISOString(), status: 'Pendente', priority: 'Alta', assigned_username: 'carol' }
  ],
  usuarios: [
    { username: 'carol', nome: 'Carolliny', role: 'recrutador', ativo: 'SIM' }
  ]
};

class FakeBuilder {
  constructor(table) { this.table = table; this.filters = []; }
  select() { return this; }
  order() { return this; }
  limit() { return this; }
  range(from, to) { return this.result(from, to); }
  eq(column, value) { this.filters.push([column, value]); return this; }
  result(from = 0, to = 9999) {
    let data = [...(mockData[this.table] || [])];
    this.filters.forEach(([column, value]) => { data = data.filter(row => row[column] === value); });
    return Promise.resolve({ data: data.slice(from, to + 1), error: null });
  }
  then(resolve, reject) { return this.result().then(resolve, reject); }
}

const realtimeTables = [];
const fakeClient = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1', email: 'carol@t4ops.crm', user_metadata: {} } } }, error: null }) },
  rpc: async name => ({ data: name === 'current_app_role' ? testRole : null, error: null }),
  from: table => new FakeBuilder(table),
  channel: () => ({
    on(_event, filter) { realtimeTables.push(filter.table); return this; },
    subscribe() { return this; }
  })
};
globalThis.supabase = { createClient: () => fakeClient };

vm.runInThisContext(fs.readFileSync('assets/contacts.js', 'utf8'), { filename: 'assets/contacts.js' });
await new Promise(resolve => setTimeout(resolve, 50));

const assertions = [
  [elements.get('contacts-loading').hidden, 'carregamento inicial termina'],
  [elements.get('contacts-user-name').textContent === 'Carolliny', 'perfil autenticado é exibido'],
  [elements.get('contacts-user-role').textContent === (testRole === 'viewer' ? 'Visualizador' : 'Recrutador'), 'papel do banco é aplicado'],
  [elements.get('nav-all-count').textContent === 2, 'arquivados não entram na contagem ativa'],
  [elements.get('nav-people-count').textContent === 1, 'pessoas são contadas'],
  [elements.get('nav-organizations-count').textContent === 1, 'organizações são contadas'],
  [elements.get('nav-followups-count').textContent === 1, 'follow-ups pendentes são contados'],
  [elements.get('contacts-result-count').textContent === 2, 'lista inicial contém os registros ativos'],
  [elements.get('contacts-table-body').innerHTML.includes('Ana &lt;Teste&gt;'), 'conteúdo recebido do banco é escapado'],
  [!elements.get('contacts-table-body').innerHTML.includes('Ana <Teste>'), 'HTML não recebe marcação bruta do usuário'],
  [realtimeTables.length === 6, 'seis tabelas participam da sincronização em tempo real']
];

if (testRole === 'recrutador') {
  elements.get('contacts-new-btn').dispatch('click');
  await new Promise(resolve => setTimeout(resolve, 10));
  assertions.push([elements.get('contact-modal').hidden === false, 'recrutador consegue abrir o cadastro']);
  assertions.push([personOnly.every(element => element.hidden === false), 'campos de pessoa aparecem no cadastro padrão']);
  assertions.push([organizationOnly.every(element => element.hidden === true), 'campos exclusivos de organização ficam ocultos para pessoa']);
} else {
  assertions.push([elements.get('contacts-new-btn').hidden === true, 'visualizador não recebe ação de novo contato']);
  assertions.push([elements.get('contacts-category-btn').hidden === true, 'visualizador não recebe gestão de categorias']);
}

let failures = 0;
assertions.forEach(([condition, label]) => {
  console.log(`${condition ? 'OK' : 'FALHA'}: ${label}`);
  if (!condition) failures += 1;
});
if (failures) {
  console.error(`\n${failures} teste(s) de execução falharam.`);
  process.exit(1);
}
console.log(`\nFluxo inicial simulado aprovado para ${testRole}.`);
