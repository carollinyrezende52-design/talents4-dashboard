/* Tradução do sistema. O idioma é uma configuração do sistema inteiro (não
   por pessoa): fica em public.t4_system_settings, editável só por
   administradores em Configurações → Idioma.

   Dois mecanismos coexistem aqui, para dois momentos diferentes da página:

   1) Menu lateral (áreas do sistema, espaços de cada área, "Mais espaços")
      é montado de forma SÍNCRONA em t4-v2-core.js, antes de qualquer
      leitura ao Supabase ser possível — por isso é marcado com atributos
      (data-i18n-switch/-view/-module-label/-static) e traduzido como uma
      segunda passada no DOM (applyChrome), depois que t4:ready confirma a
      sessão: os rótulos aparecem em português por um instante e trocam
      para o idioma configurado assim que ele é lido.

   2) Todo o resto da interface (botões, tabelas, formulários, filtros,
      mensagens de cada tela) é gerado por funções que só rodam DEPOIS de
      D.init() resolver — para essas, T4I18n.ready() garante que o idioma
      já está carregado antes da primeira renderização (ver W.start() em
      t4-v2-ui.js), então cada tela chama T4I18n.t(texto) diretamente ao
      montar o HTML: o texto já nasce no idioma certo, sem segunda passada.

   Escopo: texto fixo da interface. Conteúdo digitado por pessoas (descrição
   de talentos, observações, notas) permanece no idioma em que foi escrito —
   traduzir isso exigiria um serviço externo de tradução automática, uma
   decisão à parte (custo e risco de precisão em informação profissional). */
(function () {
  'use strict';

  const SWITCH_LABELS_DE = {
    talents: 'Talente', organization: 'Organisation', contacts: 'Kontakte',
    german: 'Deutsch', documentation: 'Dokumentation', settings: 'Einstellungen'
  };

  // Os ids de "view" se repetem entre módulos com sentidos diferentes
  // (ex.: "opportunities" é "Mercado" em Talentos mas "Oportunidades" em
  // Organizacional) — por isso o dicionário é aninhado por módulo.
  const VIEW_LABELS_DE = {
    talents: {
      overview: 'Mein Tag', talents: 'Talente', processes: 'Auswahlverfahren', presentation: 'Präsentationen',
      agenda: 'Integrierter Kalender', opportunities: 'Marktplatz', mapping: 'Talentverfolgung',
      manual: 'Benutzerhandbuch', archived: 'Talentarchiv'
    },
    organization: {
      overview: 'Mein Tag', employers: 'Arbeitgeber', pipeline: 'Auswahlverfahren', opportunities: 'Chancen',
      calendar: 'Kalender', planning: 'Monatsplanung', meetings: 'Besprechungen', operations: 'Aufgabenplan',
      summary: 'Gesamtübersicht', history: 'Vorheriges Archiv'
    },
    contacts: {
      all: 'Kontaktverzeichnis', people: 'Personen', organizations: 'Organisationen',
      followups: 'Nächste Schritte', categories: 'Kategorien', duplicates: 'Duplikate prüfen'
    },
    german: {
      overview: 'Mein Tag', classes: 'Kurse', students: 'Einschreibungen',
      attention: 'Zu beobachten', history: 'Verlaufshistorie'
    },
    documentation: { home: 'Dokumentation' },
    settings: { language: 'Sprache', users: 'Benutzer' }
  };

  const STATIC_LABELS_DE = {
    moreSpaces: 'Weitere Bereiche',
    systemAreas: 'Systembereiche'
  };

  // Dicionário plano do texto fixo da interface (fora do menu lateral, que
  // já tem seu próprio mecanismo acima, aplicado por atributo depois da
  // primeira renderização). Cada tela chama T4I18n.t(texto) NO MOMENTO de
  // montar o HTML — como W.start() (t4-v2-ui.js) agora espera o idioma
  // carregar antes da primeira renderização de qualquer módulo, o texto já
  // nasce no idioma certo, sem precisar de uma segunda passada no DOM.
  // Chave = texto em português exatamente como aparece no código-fonte;
  // valor ausente = mantém o português (degradação segura para texto ainda
  // não traduzido nesta etapa incremental).
  const DICT_DE = {
    // t4-v2-core.js — casca compartilhada por todas as telas
    'Ir para o conteúdo': 'Zum Inhalt springen',
    'Recrutamento internacional': 'Internationale Personalvermittlung',
    'Recolher menu': 'Menü einklappen',
    'Expandir menu': 'Menü ausklappen',
    'Sair': 'Abmelden',
    'Validando sessão…': 'Sitzung wird geprüft…',
    'Fechar menu': 'Menü schließen',
    'Abrir menu': 'Menü öffnen',
    'Busca nesta área': 'Suche in diesem Bereich',
    'Buscar…': 'Suchen…',
    'Limpar busca': 'Suche löschen',
    'Ações': 'Aktionen',
    'Abrir ações rápidas': 'Schnellaktionen öffnen',
    'Conectando': 'Verbindung wird hergestellt',
    'Novo': 'Neu',
    'Meu dia': 'Mein Tag',
    'Demonstração': 'Demo',
    'Homologação': 'Staging',
    'Ambiente de homologação': 'Staging-Umgebung',
    'Dados fictícios; alterações não são persistidas.': 'Beispieldaten; Änderungen werden nicht gespeichert.',
    'Ações rápidas': 'Schnellaktionen',
    'Navegue, busque e crie sem perder o contexto.': 'Navigieren, suchen und erstellen, ohne den Kontext zu verlieren.',
    'Buscar nesta área.': 'Suche in diesem Bereich.',
    'Use a busca global para encontrar pessoas, empresas ou ações.': 'Nutzen Sie die globale Suche, um Personen, Unternehmen oder Aktionen zu finden.',
    'Abrir a criação rápida deste espaço.': 'Schnellerstellung für diesen Bereich öffnen.',
    'Abrir espaço de trabalho': 'Arbeitsbereich öffnen',
    'Esc fecha · / vai para a busca': 'Esc schließt · / öffnet die Suche',
    'Fechar': 'Schließen',
    'Detalhes': 'Details',
    'Janela': 'Fenster',
    'Confirmar ação': 'Aktion bestätigen',
    'Revise antes de continuar.': 'Bitte prüfen Sie dies, bevor Sie fortfahren.',
    'Cancelar': 'Abbrechen',
    'Confirmar': 'Bestätigen',
    'Há alterações não salvas. Deseja descartá-las?': 'Es gibt ungespeicherte Änderungen. Möchten Sie diese verwerfen?',
    'Sim': 'Ja',
    'Não': 'Nein',
    'Usuário': 'Benutzer',
    'Usuário autenticado': 'Angemeldeter Benutzer',
    'Sincronizado': 'Synchronisiert',
    'Sincronizando': 'Wird synchronisiert',
    'Falha de sincronização': 'Synchronisierung fehlgeschlagen',
    'Não foi possível abrir esta ação. Atualize a tela.': 'Diese Aktion konnte nicht geöffnet werden. Aktualisieren Sie die Seite.',
    'Sem data': 'Kein Datum',
    // Papel do usuário: exibido antes de t4:ready disparar (ver data-i18n-text acima)
    'Administrador': 'Administrator',
    'Recrutador': 'Personalvermittler',
    'Visualizador': 'Betrachter',
    // t4-v2-ui.js — componentes de trabalho compartilhados (tabelas, formulários, filtros, alertas)
    'Não informado': 'Nicht angegeben',
    'Visões rápidas': 'Schnellansichten',
    'Buscar': 'Suchen',
    'Todos': 'Alle',
    'Filtrar': 'Filtern',
    'Buscar em': 'Suchen in',
    'Buscar opção…': 'Option suchen…',
    'Limpar': 'Zurücksetzen',
    'Nenhuma opção disponível.': 'Keine Option verfügbar.',
    'Mês atual': 'Aktueller Monat',
    'Buscar mês ou ano…': 'Monat oder Jahr suchen…',
    'Nenhum outro período disponível.': 'Kein weiterer Zeitraum verfügbar.',
    'Outros': 'Sonstige',
    'O registro mudou, foi removido ou você não tem permissão. Atualize a ficha antes de salvar novamente.': 'Der Datensatz wurde geändert, entfernt, oder Ihnen fehlt die Berechtigung. Aktualisieren Sie die Ansicht, bevor Sie erneut speichern.',
    'Já existe um registro com essa identificação. Confira os dados; nenhuma duplicidade foi criada.': 'Es existiert bereits ein Datensatz mit dieser Kennung. Prüfen Sie die Angaben; es wurde kein Duplikat erstellt.',
    'O vínculo informado não existe mais. Atualize os dados e selecione um registro válido.': 'Die angegebene Verknüpfung existiert nicht mehr. Aktualisieren Sie die Daten und wählen Sie einen gültigen Datensatz.',
    'Seu perfil não tem permissão para esta operação. Solicite revisão ao administrador.': 'Ihr Profil hat keine Berechtigung für diesen Vorgang. Bitten Sie einen Administrator um Prüfung.',
    'Falha de conexão com o servidor. Verifique sua internet e tente novamente; nada foi salvo.': 'Verbindungsfehler zum Server. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut; es wurde nichts gespeichert.',
    'Não foi possível concluir esta ação no banco agora. Nenhuma alteração parcial foi salva; tente novamente em instantes.': 'Diese Aktion konnte gerade nicht in der Datenbank abgeschlossen werden. Es wurde keine Teiländerung gespeichert; versuchen Sie es in Kürze erneut.',
    'Nenhum registro neste recorte.': 'Keine Einträge in dieser Ansicht.',
    'Nenhum registro encontrado': 'Keine Einträge gefunden',
    'Confortável': 'Komfortabel',
    'Compacto': 'Kompakt',
    'Colunas': 'Spalten',
    'Anterior': 'Zurück',
    'Próxima': 'Weiter',
    'Nenhum usuário disponível.': 'Kein Benutzer verfügbar.',
    'Salvar alterações': 'Änderungen speichern',
    'Campos não alterados serão preservados.': 'Unveränderte Felder bleiben erhalten.',
    'Salvando…': 'Wird gespeichert…',
    'Atualize e confira a gravação': 'Aktualisieren und Speicherung prüfen',
    'A resposta não confirmou o resultado. Feche e atualize a lista antes de repetir, para evitar duplicidade.': 'Die Antwort hat das Ergebnis nicht bestätigt. Schließen Sie das Fenster und aktualisieren Sie die Liste, bevor Sie es erneut versuchen, um Duplikate zu vermeiden.',
    'Registro salvo no Supabase.': 'Datensatz gespeichert.',
    ' Os dados anteriores foram mantidos.': ' Die vorherigen Daten wurden beibehalten.',
    ': ainda não foi importado; a fila principal continua disponível.': ': wurde noch nicht importiert; die Hauptliste bleibt verfügbar.',
    'Dados complementares aguardando importação': 'Ergänzende Daten warten auf Import',
    'Há um conjunto complementar que ainda não foi carregado.': 'Ein ergänzender Datensatz wurde noch nicht geladen.',
    'conjuntos complementares ainda não foram carregados.': 'ergänzende Datensätze wurden noch nicht geladen.',
    'Use <b>Centro de dados</b> para importar os dois modelos oficiais quando quiser enriquecer o mapeamento.': 'Nutzen Sie das <b>Datencenter</b>, um die beiden offiziellen Vorlagen zu importieren, wenn Sie das Mapping erweitern möchten.',
    ' Os dados anteriores foram mantidos onde possível.': ' Die vorherigen Daten wurden nach Möglichkeit beibehalten.',
    'Ver detalhes': 'Details anzeigen',
    'Atualizando dados': 'Daten werden aktualisiert',
    'Leitura parcial · veja os avisos': 'Teilweise geladen · Hinweise beachten',
    'Atualizado': 'Aktualisiert',
    'Tentar novamente': 'Erneut versuchen',
    'Abrir login do CRM': 'CRM-Anmeldung öffnen',
    'Acesso indisponível': 'Zugriff nicht verfügbar',
    'Filtros ativos': 'Aktive Filter',
    'Remover filtro': 'Filter entfernen',
    'Limpar tudo': 'Alle zurücksetzen',
    'Nenhum registro nas etapas acompanhadas.': 'Keine Einträge in den verfolgten Phasen.',
    'Sem registros agora: ': 'Aktuell keine Einträge: '
  };

  const state = { language: 'pt', ready: null };

  function t(text) {
    if (state.language !== 'de') return text;
    return Object.prototype.hasOwnProperty.call(DICT_DE, text) ? DICT_DE[text] : text;
  }

  async function loadLanguage() {
    if (window.T4_DEMO || !window.T4Data) { state.language = 'pt'; return state.language; }
    try {
      const result = await window.T4Data.optionalSelect(window.T4Data.TABLES.systemSettings, 'key,value', (query) => query.eq('key', 'language'));
      if (result.available) {
        const row = (result.data || []).find((item) => item.key === 'language');
        if (row?.value === 'de') state.language = 'de';
      }
    } catch (_) { /* Sem a migração 54 aplicada, o idioma padrão (pt) permanece. */ }
    document.documentElement.lang = state.language === 'de' ? 'de' : 'pt-BR';
    return state.language;
  }

  function applyChrome(root = document) {
    if (state.language !== 'de') return;
    root.querySelectorAll('[data-i18n-switch]').forEach((node) => {
      const label = SWITCH_LABELS_DE[node.dataset.i18nSwitch];
      if (label) node.textContent = label;
    });
    root.querySelectorAll('[data-i18n-module-label]').forEach((node) => {
      const label = SWITCH_LABELS_DE[node.dataset.i18nModuleLabel];
      if (label) node.textContent = label;
    });
    root.querySelectorAll('[data-i18n-view]').forEach((node) => {
      const [moduleId, viewId] = (node.dataset.i18nView || '').split(':');
      const label = VIEW_LABELS_DE[moduleId]?.[viewId];
      if (label) node.textContent = label;
    });
    root.querySelectorAll('[data-i18n-static]').forEach((node) => {
      const label = STATIC_LABELS_DE[node.dataset.i18nStatic];
      if (label) node.textContent = label;
    });
    // Para texto calculado ANTES do idioma ser conhecido (o rótulo de papel
    // do usuário, escrito por D.init() antes de t4:ready disparar este
    // mecanismo) — traduz pelo próprio texto já exibido no dicionário
    // plano, igual T4I18n.t(), mas como correção posterior no DOM.
    root.querySelectorAll('[data-i18n-text]').forEach((node) => {
      const translated = DICT_DE[node.textContent];
      if (translated) node.textContent = translated;
    });
    // Mesma ideia, para atributos (aria-label, data-tooltip, placeholder,
    // title): a casca do shell (mount(), em t4-v2-core.js) monta a sidebar e
    // a topbar de forma síncrona, antes de t4:ready — os T4I18n.t(...)
    // chamados ali sempre caem no fallback em português na primeira
    // renderização. Corrige aqui, lendo o valor atual de cada atributo
    // listado e traduzindo pelo mesmo dicionário plano, se houver entrada.
    root.querySelectorAll('[data-i18n-attrs]').forEach((node) => {
      (node.dataset.i18nAttrs || '').split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => {
        const current = node.getAttribute(name);
        const translated = current && DICT_DE[current];
        if (translated) node.setAttribute(name, translated);
      });
    });
  }

  function start() {
    state.ready = loadLanguage().then(() => applyChrome(document));
    return state.ready;
  }

  document.addEventListener('t4:ready', start, { once: true });
  window.T4I18n = Object.freeze({
    get language() { return state.language; },
    loadLanguage,
    applyChrome,
    t,
    ready: () => state.ready || Promise.resolve('pt')
  });
})();
