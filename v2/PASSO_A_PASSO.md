# Passo a passo — V2 isolada

## O que não fazer agora

- Não substitua `index.html`, `organizacional.html`, `contatos.html` ou `alemao.html` da raiz.
- Não execute `01_v2_integration.sql` em produção.
- Não execute `99_rollback_emergency.sql`.
- Não envie a branch diretamente para `main`.
- Não adicione Google Planilhas, Drive ou backup por planilha.

## 1. Descompactar

Descompacte o pacote mantendo a pasta `v2` inteira. O resultado deve ser:

```text
talents4/
├── index.html                 ← atual, não alterar
├── organizacional.html        ← atual, não alterar
├── contatos.html              ← atual, não alterar
├── alemao.html                ← atual, não alterar
└── v2/                        ← nova pasta completa
```

Se os arquivos da V2 aparecerem soltos na raiz, pare e corrija antes de enviar.

## 2. Criar branch no GitHub

No GitHub:

1. abra o repositório `talents4/talents4`;
2. clique no seletor de branch que mostra `main`;
3. digite `homologacao-v2`;
4. escolha **Create branch: homologacao-v2 from main**;
5. confirme que a branch selecionada agora é `homologacao-v2`.

## 3. Enviar somente a pasta V2

1. na branch `homologacao-v2`, clique em **Add file**;
2. escolha **Upload files**;
3. arraste a pasta `v2` completa;
4. confira se os caminhos começam com `v2/`;
5. use a mensagem `feat: adiciona CRM V2 isolado`;
6. confirme o commit na branch `homologacao-v2`.

Não abra merge para `main` nesta etapa.

## 4. Entender o status do GitHub Actions

O workflow atual do repositório executa `scripts/check-static.mjs` sobre os arquivos da raiz. O log anterior mostrou 18 falhas já existentes no commit-base `4b1ae39`.

Portanto:

- essas falhas não são criadas pela pasta `v2`;
- a V2 possui seu próprio verificador em `v2/scripts/check-v2.mjs`;
- não altere o workflow para esconder o vermelho;
- trate a correção do CI atual em uma atividade separada.

Para validar a V2 em uma cópia local do repositório:

```bash
node v2/scripts/check-v2.mjs
```

O final precisa ser:

```text
V2 aprovada: arquivos isolados, shell padronizado e Supabase-only.
```

## 5. Abrir uma prévia HTTP

Na pasta do repositório:

```bash
python3 -m http.server 8000
```

Abra:

```text
http://localhost:8000/v2/index.html
```

Não abra com duplo clique usando `file://`.

## 6. Validar antes da migration

Faça login pela versão atual e teste a V2 com os mesmos usuários:

1. abra os quatro switches;
2. confirme o mesmo menu e cabeçalho em todos;
3. confirme Talentos existentes;
4. confirme empregadores e oportunidades;
5. confirme que Contatos exibe Talentos e empregadores sem duplicá-los;
6. confirme turmas e matrículas de alemão;
7. confirme que agenda V2 e compatibilidade por vaga mostram **Modo compatível**;
8. confirme que nenhuma chamada de Google aparece no navegador.

Nesta fase, não execute SQL.

## 7. Homologar o Supabase

Somente em ambiente de homologação:

1. execute `v2/supabase/00_preflight.sql`;
2. pare se qualquer linha mostrar `BLOQUEIA_MIGRATION`;
3. com tudo aprovado, execute o arquivo inteiro `01_v2_integration.sql`;
4. em outra consulta, execute `02_postflight.sql`;
5. exija `OK`, `anon_select = false` e `authenticated_delete = false`;
6. teste com um `viewer` e com um `recrutador`/`admin`;
7. use apenas registros fictícios para o primeiro teste de escrita.

## 8. Testar a integração

1. crie um Talento fictício;
2. abra-o em Contatos;
3. matricule-o em Alemão;
4. altere o nível e confira a ficha em Talentos;
5. crie um empregador fictício;
6. abra-o em Contatos;
7. crie uma oportunidade;
8. vincule o Talento à oportunidade;
9. confirme o mesmo processo em Talentos e Organizacional;
10. agende um follow-up e confirme a atividade central.

## 9. Decidir o próximo passo

Depois dos testes, escolha entre:

- manter `/v2/` como homologação;
- liberar `/v2/` para poucos usuários;
- planejar uma migração controlada para a raiz.

Nenhuma dessas decisões é executada automaticamente por este pacote.
