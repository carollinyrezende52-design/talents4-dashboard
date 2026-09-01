import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const v2Root = path.resolve(here, '..');
const repoRoot = path.resolve(v2Root, '..');
let failures = 0;

function check(condition, message) {
  if (condition) console.log(`OK: ${message}`);
  else { console.error(`FALHA: ${message}`); failures += 1; }
}
function read(relative) { return fs.readFileSync(path.join(v2Root, relative), 'utf8'); }
function exists(relative) { return fs.existsSync(path.join(v2Root, relative)); }
function withoutSqlCommentsAndStrings(source) {
  return source
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
}

const required = [
  'index.html', 'organizacional.html', 'contatos.html', 'alemao.html', 'README_V2.md', 'PASSO_A_PASSO.md',
  'assets/t4-v2.css', 'assets/t4-v2-core.js', 'assets/t4-v2-data.js',
  'assets/talents-v2.js', 'assets/organization-v2.js', 'assets/contacts-v2.js', 'assets/german-v2.js',
  'supabase/00_preflight.sql', 'supabase/01_v2_integration.sql', 'supabase/02_postflight.sql', 'supabase/99_rollback_emergency.sql'
];
required.forEach((file) => check(exists(file), `${file} existe`));

const jsFiles = required.filter((file) => file.endsWith('.js'));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(v2Root, file)], { encoding: 'utf8' });
  check(result.status === 0, `${file} possui JavaScript sintaticamente válido`);
  if (result.status !== 0 && result.stderr) console.error(result.stderr.trim());
}

const runtimeContext = { console, setTimeout, clearTimeout, Intl, URL, URLSearchParams, crypto };
runtimeContext.window = runtimeContext;
vm.createContext(runtimeContext);
vm.runInContext(read('assets/t4-v2-core.js'), runtimeContext, { filename: 't4-v2-core.js' });
vm.runInContext(read('assets/t4-v2-data.js'), runtimeContext, { filename: 't4-v2-data.js' });
check(runtimeContext.T4V2.term('Novo candidato') === 'Novo Talento', 'interface converte a etapa legada para Novo Talento');
check(runtimeContext.T4V2.normalize('Ação MÉDICA') === 'acao medica', 'normalização de busca trata acentos e caixa');
check(runtimeContext.T4Data.activeValue('NÃO') === false && runtimeContext.T4Data.activeValue(true) === true, 'normalização de status ativo trata legado e booleano');
const legacyMatch = runtimeContext.T4Data.mapMatch({ id:'m1', candidato_id:'t1', empregador_id:'e1', status_vinculo:'Apresentado', match_strength:82 });
check(legacyMatch.talent_id === 't1' && legacyMatch.employer_id === 'e1' && legacyMatch.overall_score === 82 && legacyMatch.modern === false, 'compatibilidade converte vínculos legados sem perder contexto');
check(runtimeContext.T4Data.missingRelation({ code:'42P01' }) === true, 'modo compatível reconhece tabela V2 ausente');

const htmlFiles = ['index.html', 'organizacional.html', 'contatos.html', 'alemao.html'];
const expectedModules = { 'index.html':'talents', 'organizacional.html':'organization', 'contatos.html':'contacts', 'alemao.html':'german' };
for (const file of htmlFiles) {
  const html = read(file);
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  check(duplicateIds.length === 0, `${file} não possui IDs estáticos duplicados`);
  check(html.includes('href="./assets/t4-v2.css"'), `${file} usa o design system compartilhado`);
  check(html.includes('src="./assets/t4-v2-core.js"'), `${file} usa o shell compartilhado`);
  check(html.includes('src="./assets/t4-v2-data.js"'), `${file} usa a camada única do Supabase`);
  check(html.includes(`data-t4-module="${expectedModules[file]}"`), `${file} declara o módulo correto`);
  check(html.includes('Content-Security-Policy'), `${file} possui política de conteúdo`);
  check(html.includes('name="referrer" content="no-referrer"'), `${file} não envia URL de referência`);
  check((html.match(/@supabase\/supabase-js@2\.112\.3/g) || []).length === 1, `${file} fixa uma única versão do Supabase JS`);
  const supabaseAt = html.indexOf('@supabase/supabase-js@2.112.3');
  const coreAt = html.indexOf('t4-v2-core.js');
  const dataAt = html.indexOf('t4-v2-data.js');
  check(supabaseAt >= 0 && supabaseAt < coreAt && coreAt < dataAt, `${file} carrega dependências na ordem correta`);
}

const core = read('assets/t4-v2-core.js');
for (const link of ['./index.html', './organizacional.html', './contatos.html', './alemao.html']) {
  check(core.includes(`href: '${link}'`), `shell compartilhado contém o switch ${link}`);
}
check((core.match(/class=\"t4-switch-item/g) || []).length === 1, 'os switches são gerados por um único componente');

const css = read('assets/t4-v2.css');
for (const color of ['#002a4a', '#dcd0c3', '#d50c2f', '#e63121', '#f07f00', '#fbb900', '#1e1349']) {
  check(css.toLowerCase().includes(color), `identidade visual contém ${color.toUpperCase()}`);
}
check(css.includes('@media (max-width: 920px)') && css.includes('@media (max-width: 680px)'), 'layout possui adaptação responsiva');
check(css.includes('@media (prefers-reduced-motion: reduce)'), 'layout respeita redução de movimento');

const frontFiles = [...htmlFiles, 'assets/t4-v2-core.js', 'assets/t4-v2-data.js', 'assets/talents-v2.js', 'assets/organization-v2.js', 'assets/contacts-v2.js', 'assets/german-v2.js'];
const front = frontFiles.map((file) => `\n/* ${file} */\n${read(file)}`).join('\n');
const forbidden = [
  [/sheets\.googleapis\.com/i, 'Google Sheets API'],
  [/docs\.google\.com\/spreadsheets/i, 'links de Google Planilhas'],
  [/drive\.googleapis\.com/i, 'Google Drive API'],
  [/\bXLSX\b|\bSheetJS\b/i, 'biblioteca de planilhas'],
  [/client_secret/i, 'client_secret'],
  [/service_role/i, 'service_role no frontend'],
  [/localStorage\b/, 'persistência de dados no localStorage'],
  [/sessionStorage\b/, 'persistência de dados no sessionStorage']
];
for (const [pattern, label] of forbidden) check(!pattern.test(front), `frontend não contém ${label}`);
check(/createClient\(SUPABASE_URL, SUPABASE_ANON_KEY/.test(front), 'frontend usa somente o cliente público do Supabase');
check(!/fetch\s*\(\s*['"]https?:\/\//i.test(front), 'frontend não chama APIs externas por fetch');

const preflight = withoutSqlCommentsAndStrings(read('supabase/00_preflight.sql'));
const postflight = withoutSqlCommentsAndStrings(read('supabase/02_postflight.sql'));
const mutation = /\b(create|alter|insert|update|delete|drop|grant|revoke|truncate)\b/i;
check(!mutation.test(preflight), 'preflight é somente leitura');
check(!mutation.test(postflight), 'postflight é somente leitura');

const migration = read('supabase/01_v2_integration.sql');
check(/^begin;/im.test(migration) && /^commit;/im.test(migration), 'migration é transacional');
check(/create table if not exists public\.crm_activities/i.test(migration), 'migration cria a agenda integrada');
check(/create table if not exists public\.talent_opportunity_matches/i.test(migration), 'migration cria compatibilidade por oportunidade');
check(/enable row level security/gi.test(migration), 'migration habilita RLS');
check(/revoke all on public\.crm_activities from public, anon, authenticated/i.test(migration), 'agenda bloqueia privilégios anônimos');
check(/revoke all on public\.talent_opportunity_matches from public, anon, authenticated/i.test(migration), 'compatibilidades bloqueiam privilégios anônimos');
check(!/drop\s+table/i.test(migration), 'migration principal não remove tabelas');
check(!/alter\s+table[\s\S]{0,120}\bdrop\s+column/i.test(migration), 'migration principal não remove colunas');

const status = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
check(status.status === 0, 'estado do repositório pode ser verificado');
if (status.status === 0) {
  const changed = status.stdout.trim().split('\n').filter(Boolean);
  const outside = changed.filter((line) => !line.slice(3).startsWith('v2/'));
  check(outside.length === 0, 'esta branch isolada não altera arquivos publicados fora de v2/');
  if (outside.length) outside.forEach((line) => console.error(`  fora do escopo: ${line}`));
}

console.log('');
if (failures) {
  console.error(`${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('V2 aprovada: arquivos isolados, shell padronizado e Supabase-only.');
