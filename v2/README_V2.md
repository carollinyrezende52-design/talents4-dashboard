# Talents 4 CRM V2 — versão isolada

## Estado desta entrega

Esta V2 está integralmente dentro da pasta `v2/`. Os quatro arquivos publicados na raiz do repositório não foram substituídos nem editados.

- Ambiente atual: continua nos arquivos da raiz.
- V2: abre pelo caminho `v2/index.html`.
- Banco: somente Supabase.
- Google Planilhas: não existe nesta V2.
- Google Drive: não existe nesta V2.
- Backups em planilha: não existem nesta V2.
- Migration V2: preparada, mas não aplicada por esta entrega.

## O problema que a V2 resolve

O sistema atual cresceu por telas e patches. Isso gerou abas redundantes, estados locais paralelos, agendas diferentes e vínculos que nem sempre representam o mesmo registro nos quatro módulos.

A V2 aplica um modelo de CRM profissional:

1. um cadastro canônico para cada entidade;
2. listas filtráveis para trabalho diário;
3. ficha 360 sem sair da lista;
4. relações explícitas entre registros;
5. atividade com responsável, prazo e contexto;
6. visão em tabela para localizar e comparar;
7. visão em quadro apenas quando existe processo por etapa;
8. histórico preservado, sem esconder falhas em cópias locais.

Esses padrões são coerentes com os modelos documentados por CRM modernos:

- HubSpot organiza a base em registros, propriedades, atividades e associações: https://knowledge.hubspot.com/get-started/manage-your-crm-database
- HubSpot mantém associações entre registros em ambas as direções: https://knowledge.hubspot.com/records/associate-records
- Pipedrive usa a lista para filtrar, ordenar e trabalhar registros: https://support.pipedrive.com/en/article/list-view
- Pipedrive relaciona atividades a pessoas, organizações e negócios: https://support.pipedrive.com/en/article/activities
- Attio separa objetos, listas e visões configuráveis: https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views
- Attio usa filtros e ordenações salvas em visões tabulares: https://attio.com/help/reference/managing-your-data/views/create-and-manage-table-views

## Quatro switches padronizados

Os quatro módulos usam exatamente o mesmo shell, criado em `assets/t4-v2-core.js` e `assets/t4-v2.css`.

| Padrão | Talentos | Organizacional | Contatos | Alemão |
|---|---|---|---|---|
| Menu lateral | Mesmo componente | Mesmo componente | Mesmo componente | Mesmo componente |
| Cabeçalho e busca | Mesmo componente | Mesmo componente | Mesmo componente | Mesmo componente |
| Lista e filtros | Mesmo componente | Mesmo componente | Mesmo componente | Mesmo componente |
| Ficha lateral 360 | Mesmo componente | Mesmo componente | Mesmo componente | Mesmo componente |
| Formulários e alertas | Mesmo componente | Mesmo componente | Mesmo componente | Mesmo componente |
| Cor de acento | Vermelho | Laranja | Roxo | Amarelo |

### Identidade visual

A interface usa a definição RGB do manual `SYN_talents4_colordefinition_V04 _ v2 (1).pdf`:

- azul-marinho `#002A4A`;
- cinza quente `#DCD0C3`;
- vermelho `#D50C2F`;
- coral `#E63121`;
- laranja `#F07F00`;
- amarelo `#FBB900`;
- roxo `#1E1349`.

Não há fonte externa obrigatória. O sistema usa fontes do próprio dispositivo para reduzir falhas de carregamento.

## Como os módulos conversam

| Ação | Fonte canônica | Reflexo na V2 |
|---|---|---|
| Criar ou editar um Talento | `candidatos` | Talentos, Contatos e Alemão leem o mesmo registro |
| Criar ou editar empregador | `employers` | Organizacional e Contatos leem o mesmo registro |
| Criar oportunidade | `employer_openings` | Organizacional e compatibilidades de Talentos usam a mesma vaga |
| Editar nível numa matrícula | `german_course_enrollments` | A V2 também atualiza `candidatos.nivel_alemao` |
| Registrar follow-up em Contatos | `contact_followups` | Após a migration, trigger reflete o item em `crm_activities` |
| Criar atividade V2 | `crm_activities` | Aparece nos módulos correspondentes aos vínculos preenchidos |
| Relacionar Talento a vaga | `talent_opportunity_matches` | Talentos e Organizacional exibem o mesmo processo |

Contatos não cria uma segunda cópia de Talentos ou empregadores. Ele monta uma agenda unificada a partir de:

- `candidatos`;
- `employers`;
- `contact_records` para professores, funcionários, parceiros, fornecedores, prestadores, clientes, órgãos públicos ou qualquer outro contato.

Quando um registro canônico precisa de histórico de interação, `contact_records.source_system` e `source_record_id` mantêm o vínculo técnico sem duplicá-lo visualmente.

## Estrutura da informação

### Talentos

- visão de trabalho;
- lista única de Talentos;
- filtros de etapa, alemão, prioridade, documentação e prontidão;
- ficha 360;
- compatibilidade por oportunidade;
- processos em quadro;
- agenda integrada;
- arquivados.

### Organizacional

- visão de carteira;
- empregadores;
- oportunidades;
- pipeline por empregador;
- planejamento integrado.

### Contatos

- todas as pessoas e organizações;
- categorias profissionais;
- histórico de interações;
- acompanhamentos;
- possíveis duplicidades por e-mail ou telefone;
- edição do cadastro canônico quando a origem é Talento ou empregador.

### Alemão

- visão de trabalho;
- turmas;
- alunos e matrículas;
- evolução e frequência;
- histórico;
- alertas explicáveis;
- professor relacionado a Contatos após a migration V2.

## Referência da planilha enviada

O arquivo `Cópia de Mapeamento Talents 4 2026.08.31.xlsx` foi usado somente como referência funcional. Ele possui nove abas por pessoa, além de `Resumo BW` e `Radar NectaNet`.

A V2 preserva o que a planilha torna útil — leitura rápida por pessoa, resumo e radar — mas troca a organização por abas pessoais por registros filtráveis no Supabase. Nenhuma planilha é lida em tempo de execução, sincronizada, criada ou usada como backup.

## Arquivos

```text
v2/
├── index.html
├── organizacional.html
├── contatos.html
├── alemao.html
├── assets/
│   ├── t4-v2.css
│   ├── t4-v2-core.js
│   ├── t4-v2-data.js
│   ├── talents-v2.js
│   ├── organization-v2.js
│   ├── contacts-v2.js
│   └── german-v2.js
├── scripts/
│   └── check-v2.mjs
└── supabase/
    ├── 00_preflight.sql
    ├── 01_v2_integration.sql
    ├── 02_postflight.sql
    └── 99_rollback_emergency.sql
```

## Passo a passo seguro de homologação

### Etapa 1 — validar os arquivos, sem publicar

Na raiz do repositório:

```bash
node v2/scripts/check-v2.mjs
```

O resultado precisa terminar em `V2 aprovada` e zero falhas.

### Etapa 2 — criar uma branch de teste

Não substitua `main`. Crie uma branch de homologação e inclua somente a pasta `v2/`.

```bash
git switch -c homologacao-v2
git add v2
git commit -m "feat: adiciona CRM V2 isolado"
```

Não execute `git push` até decidir onde a prévia será hospedada.

### Etapa 3 — testar a interface em modo compatível

Sirva o repositório por HTTP; não abra os HTMLs com `file://`.

```bash
python3 -m http.server 8000
```

Abra `/v2/index.html`, faça login pela versão atual e confirme:

1. os quatro switches possuem o mesmo layout;
2. Talentos e empregadores existentes aparecem;
3. Contatos não duplica visualmente esses registros;
4. turmas e matrículas aparecem;
5. agenda e compatibilidade novas informam “modo compatível” antes da migration;
6. nenhuma página tenta acessar Google Planilhas ou Google Drive.

### Etapa 4 — executar somente o preflight

No SQL Editor do ambiente de homologação do Supabase, execute:

```text
v2/supabase/00_preflight.sql
```

Todos os pré-requisitos precisam retornar `OK`. Se existir `BLOQUEIA_MIGRATION`, pare. Não execute a migration.

### Etapa 5 — aplicar a migration somente em homologação

Com preflight aprovado, execute o arquivo inteiro:

```text
v2/supabase/01_v2_integration.sql
```

A migration é transacional. Qualquer falha cancela a operação inteira.

Ela:

- cria `crm_activities`;
- cria `talent_opportunity_matches`;
- adiciona campos opcionais às oportunidades;
- relaciona professor de alemão com Contatos;
- reflete `contact_followups` na agenda central por trigger;
- habilita RLS;
- bloqueia `anon`;
- mantém leitura para `viewer` e escrita para `admin`/`recrutador` via políticas existentes;
- não remove nem renomeia tabela atual.

### Etapa 6 — verificar o banco

Execute:

```text
v2/supabase/02_postflight.sql
```

Os resultados de tabelas e colunas precisam ser `OK`. Confirme também que:

- `anon_select = false`;
- `authenticated_select = true`;
- `authenticated_delete = false`;
- a contagem de follow-ups espelhados confere com a origem.

### Etapa 7 — testar os papéis

Faça os testes com duas contas:

1. `viewer`: lê os quatro módulos e não recebe botões de gravação;
2. `recrutador` ou `admin`: cria e edita em homologação.

Não use uma conta sem perfil ativo.

### Etapa 8 — testar a conversa entre módulos

Use registros fictícios no ambiente de homologação:

1. crie um Talento em Talentos;
2. localize o mesmo registro em Contatos;
3. matricule-o em Alemão e altere o nível;
4. confirme o nível atualizado na ficha do Talento;
5. crie um empregador no Organizacional;
6. confirme o mesmo empregador em Contatos;
7. crie uma oportunidade;
8. registre uma atividade ligada ao empregador;
9. confirme a atividade no planejamento;
10. registre um follow-up em Contatos e confirme o espelhamento em `crm_activities`.

### Etapa 9 — decidir a publicação

Somente depois de todos os testes, escolha uma destas opções:

- manter `/v2/` como prévia paralela;
- liberar `/v2/` para um grupo pequeno;
- planejar a substituição futura dos arquivos da raiz.

Esta entrega não faz nenhuma dessas ações automaticamente.

### Etapa 10 — rollback apenas em emergência

`99_rollback_emergency.sql` não é parte da instalação. Ele remove as duas novas tabelas e perde dados criados nelas. As colunas aditivas em tabelas existentes são deliberadamente preservadas para não apagar dados nem atingir colunas preexistentes.

Antes de qualquer rollback, exporte as duas tabelas novas pelo mecanismo de backup do próprio Supabase e obtenha autorização explícita.

## Limites conhecidos desta V2

- A migration não converte automaticamente todas as agendas legadas; só espelha `contact_followups`.
- Vínculos antigos por empregador aparecem em modo compatível até serem relacionados a uma oportunidade específica.
- Mesclagem de duplicidades é manual; a V2 apenas sinaliza.
- O gerador seletivo de PDF não foi misturado nesta branch V2. Ele deve entrar depois como componente isolado e testado.
- O Drive e a automação de currículos permanecem fora desta versão.
