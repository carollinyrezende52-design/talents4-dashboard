import fs from 'node:fs';
import vm from 'node:vm';

const pages = ['index.html', 'organizacional.html', 'alemao.html', 'talents.html'];
const required = [
  ...pages,
  'assets/t4-ui.css',
  'assets/t4-ui.js',
  'supabase/migrations/202608130001_german_course_module.sql'
];

let failures = 0;
const check = (condition, message) => {
  console.log(`${condition ? 'OK' : 'FALHA'}: ${message}`);
  if (!condition) failures++;
};

for (const file of required) check(fs.existsSync(file), `${file} existe`);

for (const file of pages) {
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  try {
    inlineScripts.forEach((source, index) => new vm.Script(source, { filename:`${file}#script-${index + 1}` }));
    check(true, `${file} possui JavaScript sintaticamente válido (${inlineScripts.length} bloco(s))`);
  } catch (error) {
    check(false, `${file}: ${error.message}`);
  }

  const staticMarkup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const ids = [...staticMarkup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  check(new Set(ids).size === ids.length, `${file} não possui IDs duplicados no HTML estático`);
}

const index = fs.readFileSync('index.html', 'utf8');
const organizational = fs.readFileSync('organizacional.html', 'utf8');
const german = fs.readFileSync('alemao.html', 'utf8');
check(/data-t4-module="crm"/.test(index), 'CRM usa a identidade visual compartilhada');
check(/data-t4-module="organizacional"/.test(organizational), 'Organizacional usa a identidade visual compartilhada');
check(/data-t4-module="alemao"/.test(german), 'Curso de alemão usa a identidade visual compartilhada');
check(!/data-v="(?:tickets|employer)"/.test(index), 'abas Tickets e Employer não voltaram à navegação');
check(/href='alemao\.html'|href="alemao\.html"/.test(index), 'CRM mantém o switch para alemão');
const lazyLibraries = [
  ['Mammoth', /<script[^>]+src=["'][^"']*mammoth\.browser\.min\.js/i],
  ['SheetJS', /<script[^>]+src=["'][^"']*xlsx\.full\.min\.js/i],
  ['html2pdf', /<script[^>]+src=["'][^"']*html2pdf\.bundle\.min\.js/i],
  ['PDF.js', /<script[^>]+src=["'][^"']*pdf\.min\.js/i],
  ['Google Identity', /<script[^>]+src=["']https:\/\/accounts\.google\.com\/gsi\/client/i]
];
for (const [name, eagerTag] of lazyLibraries) {
  check(!eagerTag.test(index), `${name} não bloqueia a abertura da página`);
}
check(index.includes("await loadRuntimeScript('googleIdentity')"), 'Google Identity é carregado somente ao conectar o Drive');
check(index.includes("await loadRuntimeScript('xlsx')"), 'SheetJS é carregado somente ao exportar Excel');
check(index.includes("await loadRuntimeScript('mammoth')"), 'Mammoth é carregado somente ao importar DOCX');
check(index.includes("await loadRuntimeScript('html2pdf')"), 'html2pdf é carregado somente ao gerar PDF');
check(index.includes("await loadRuntimeScript('pdfjs')"), 'PDF.js é carregado somente ao importar currículo PDF');
check(!organizational.includes('rows.push({act,entry:null})'), 'Planejamento mensal não cria linhas vazias');
check(organizational.includes('plan-empty-state'), 'Planejamento mensal possui estado vazio orientado à ação');
check(organizational.includes('openPlanForEmployer'), 'Planejamento mantém inclusão rápida por empregador');
check(organizational.includes('readStoredSessionSnapshot'), 'Organizacional inicia pela sessão local sem travar a interface');
check(organizational.includes('readCrmProfileSession'), 'Organizacional reconhece a sessão de perfil criada pelo CRM');
check(/\^sb-\.\+-auth-token\$/.test(organizational), 'Organizacional localiza a chave real de autenticação do Supabase');
check(/getSession\(\),2500/.test(organizational), 'Organizacional limita a espera da autenticação');
check(/if\(!storedSession && !crmProfileSession\)\{\s*redirectToInstitutional\(\);\s*return false;/.test(organizational), 'Organizacional redireciona imediatamente quando não existe login');
check(organizational.includes("document.readyState==='loading'"), 'Organizacional inicia mesmo quando o DOM já está pronto');
check(organizational.includes("ensureOrganizationalStarted('failsafe')"), 'Organizacional possui salvaguarda contra perda do evento inicial');
check(organizational.includes('if(_organizationalSyncStarted) return;'), 'Organizacional evita sincronizações duplicadas');
check(organizational.includes('Estado local incompatível; usando base segura'), 'Organizacional recupera estado local incompatível');
const startupSync = organizational.match(/async function syncOrganizationalOnce\(storedSession\)\{([\s\S]*?)\n\}\n\nfunction startOrganizational/)?.[1] || '';
check(!startupSync.includes('loadRemoteState'), 'Abertura não carrega o snapshot completo');
check((startupSync.match(/orgHybridLoadRelationalSlices/g) || []).length === 1, 'Abertura possui uma única carga relacional principal');
check(!startupSync.includes('loadCrmCandidateCatalog'), 'Abertura não carrega o catálogo pesado de candidatos');
check(!startupSync.includes('orgBootstrapCanonicalLayer'), 'Abertura não carrega dossiês canônicos');
check(!organizational.includes("await window.loadRemoteState();\n        const res = await window.orgHybridLoadRelationalSlices();"), 'Organizacional não duplica a carga principal no hardening');
check(!organizational.includes("setTimeout(() => { loadCrmCandidateCatalog(false); }, 0)"), 'Catálogo de candidatos não carrega na abertura');
check(organizational.includes('t4OrgLoadCanonicalDossiersOnDemand'), 'Dossiês canônicos carregam sob demanda');
check(organizational.includes('_orgCanonicalBootDone = false;\n      console.warn'), 'Dossiês canônicos permitem nova tentativa após falha');
check(organizational.includes(".limit(500),\n        7000,\n        'Leitura candidatos CRM'"), 'Catálogo de candidatos possui limite de segurança');
check((organizational.match(/localStorage\.setItem\('t4crm_v2'/g) || []).length === 0, 'Organizacional não duplica o cache legado');
check(organizational.includes('window.__t4OrgHydrating'), 'Hidratação evita gravações locais repetidas');
const sharedCss = fs.readFileSync('assets/t4-ui.css', 'utf8');
check(sharedCss.includes('@media(max-height:980px)'), 'Barra lateral responde à altura e ao zoom');
check(sharedCss.includes('@media(max-width:1100px) and (min-width:721px)'), 'Barra lateral mantém os textos em janela reduzida');
check(sharedCss.includes('@media(max-width:720px)'), 'Barra lateral usa ícones somente em tela estreita');
check(/overflow-y:auto!important/.test(sharedCss), 'Barra lateral permanece rolável');

const legacy = fs.readFileSync('talents.html', 'utf8');
check(!legacy.includes('docs.google.com/spreadsheets'), 'painel legado não expõe planilha pública');
check(/location\.replace\(['"]index\.html['"]\)/.test(legacy), 'painel legado preserva o caminho com redirecionamento');

const migration = fs.readFileSync('supabase/migrations/202608130001_german_course_module.sql', 'utf8');
check((migration.match(/enable row level security/gi) || []).length === 3, 'migration habilita RLS nas três tabelas do curso');
check((migration.match(/from anon;/gi) || []).length === 3, 'migration revoga acesso direto de anon nas três tabelas');

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nTodas as verificações estáticas foram aprovadas.');
