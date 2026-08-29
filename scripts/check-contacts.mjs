import fs from 'node:fs';
import vm from 'node:vm';

const files = [
  'contatos.html',
  'assets/contacts.css',
  'assets/contacts.js',
  'scripts/contacts-preflight.sql',
  'scripts/contacts-postflight.sql',
  'scripts/contacts-rollback.sql',
  'supabase/migrations/202608290001_contacts_module.sql'
];

let failures = 0;
const check = (condition, message) => {
  console.log(`${condition ? 'OK' : 'FALHA'}: ${message}`);
  if (!condition) failures += 1;
};

files.forEach(file => check(fs.existsSync(file), `${file} existe`));
if (failures) process.exit(1);

const html = fs.readFileSync('contatos.html', 'utf8');
const css = fs.readFileSync('assets/contacts.css', 'utf8');
const js = fs.readFileSync('assets/contacts.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/202608290001_contacts_module.sql', 'utf8');
const preflight = fs.readFileSync('scripts/contacts-preflight.sql', 'utf8');
const postflight = fs.readFileSync('scripts/contacts-postflight.sql', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const organizational = fs.readFileSync('organizacional.html', 'utf8');
const german = fs.readFileSync('alemao.html', 'utf8');

try {
  new vm.Script(js, { filename: 'assets/contacts.js' });
  check(true, 'JavaScript do módulo possui sintaxe válida');
} catch (error) {
  check(false, `JavaScript inválido: ${error.message}`);
}

const staticMarkup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
const htmlIds = [...staticMarkup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const referencedIds = [...js.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
check(new Set(htmlIds).size === htmlIds.length, 'contatos.html não possui IDs duplicados');
check(referencedIds.every(id => htmlIds.includes(id)), 'todos os IDs usados pelo JavaScript existem no HTML');
check(/data-t4-module="contatos"/.test(html), 'página declara a identidade visual de Contatos');
check(/assets\/contacts\.css/.test(html) && /assets\/contacts\.js/.test(html), 'CSS e JavaScript permanecem em arquivos separados');
check(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html), 'contatos.html não contém JavaScript monolítico inline');
check(css.includes('@media(max-width:640px)'), 'layout possui adaptação para telas pequenas');

check((index.match(/data-v="contatos_switch"/g) || []).length === 1, 'CRM Institucional possui um switch Contatos');
check((organizational.match(/window\.location\.href='contatos\.html'/g) || []).length === 1, 'Organizacional possui um switch Contatos');
check((german.match(/href="contatos\.html"/g) || []).length === 1, 'Curso de Alemão possui um switch Contatos');

const expectedTables = [
  'contact_records',
  'contact_categories',
  'contact_record_categories',
  'contact_relationships',
  'contact_interactions',
  'contact_followups'
];
expectedTables.forEach(table => {
  check(new RegExp(`create table if not exists public\\.${table}\\b`, 'i').test(migration), `migration cria ${table}`);
  check(new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(migration), `RLS habilitado em ${table}`);
  check(new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i').test(migration), `privilégios são reconstruídos de forma explícita em ${table}`);
});
check(/public\.current_app_role\(\)/.test(migration) && /public\.can_edit_crm\(\)/.test(migration), 'migration reutiliza os controles de papel existentes');
check(!/grant select, insert, update, delete on public\.(?:contact_records|contact_categories|contact_interactions|contact_followups) to authenticated/i.test(migration), 'hard delete não é concedido nas tabelas de histórico e cadastro');
check(/raise exception 'Acesso anon indevido/.test(migration), 'migration cancela a transação se anon conservar leitura');
check(/begin;[\s\S]*commit;/i.test(migration), 'migration é transacional');

const preflightWithoutComments = preflight.replace(/--.*$/gm, '');
check(!/\b(create|alter|insert|update|delete|drop|grant|revoke|truncate)\b/i.test(preflightWithoutComments), 'preflight contém somente leitura');
check(postflight.includes("then 'OK'"), 'postflight produz resultado objetivo OK/REVISAR');
check(postflight.includes('authenticated_delete'), 'postflight confirma proteção contra hard delete');

check(!/service_role|client_secret|BEGIN PRIVATE KEY/i.test(`${html}\n${js}\n${css}`), 'frontend não contém credencial privilegiada');
check(!/localStorage\./.test(js), 'módulo não persiste dados de contatos no localStorage');
check(/escapeHtml/.test(js), 'conteúdo dinâmico passa por escape de HTML');
check(/\.channel\('t4-contacts-live'\)/.test(js), 'alterações são sincronizadas em tempo real');
check(/status: 'Arquivado', archived_at:/.test(js), 'arquivamento preserva o histórico');
check(!/from\(TABLES\.(?:contacts|categories|interactions|followups)\)\.delete\(/.test(js), 'frontend não executa hard delete em registros de negócio');

if (failures) {
  console.error(`\n${failures} verificação(ões) do módulo Contatos falharam.`);
  process.exit(1);
}
console.log('\nTodas as verificações do módulo Contatos foram aprovadas.');
