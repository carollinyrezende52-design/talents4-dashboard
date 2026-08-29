# Talents 4 — publicação da Central de Contatos

Esta entrega cria uma agenda profissional independente para pessoas e organizações. Ela não copia candidatos ou empregadores, não altera `agenda` e não contém integração com Google Drive.

Base validada antes da implementação: branch `main`, commit `c14f07a34ad7c33c26563802becc7aff5714f018`.

## Conteúdo funcional

- Pessoas e organizações no mesmo cadastro mestre.
- Categorias múltiplas e categorias personalizadas.
- Filtros por tipo, categoria, status, responsável e busca geral.
- Vínculos entre contatos e organização principal.
- Linha do tempo de interações.
- Próximas ações com prazo, prioridade e responsável.
- Alertas de duplicidade por nome, e-mail ou telefone normalizados.
- Arquivamento sem exclusão física.
- Atualização em tempo real entre usuários conectados.
- `viewer` em modo somente leitura; `admin` e `recrutador` com edição.

## Arquivos da entrega

```text
contatos.html
assets/contacts.css
assets/contacts.js
index.html
organizacional.html
alemao.html
scripts/check-contacts.mjs
scripts/contacts-preflight.sql
scripts/contacts-postflight.sql
scripts/contacts-rollback.sql
supabase/migrations/202608290001_contacts_module.sql
```

## Ordem segura de publicação

1. No SQL Editor do Supabase, execute somente `scripts/contacts-preflight.sql`.
2. Continue apenas se `ready_to_apply = true`, `existing_module_tables = 0` e `old_prototype_tables = 0`.
3. Execute o arquivo inteiro `supabase/migrations/202608290001_contacts_module.sql`.
4. Em uma nova consulta, execute `scripts/contacts-postflight.sql`.
5. Confirme seis linhas com `resultado = OK` e `category_count >= 10`.
6. Envie os arquivos web e os scripts para o GitHub.
7. Aguarde o GitHub Pages e teste `contatos.html` com um recrutador e um visualizador.

Não execute `crm_contatos_supabase.sql` do pacote anterior. Ele cria uma estrutura paralela (`crm_*`) incompatível com esta entrega.

## Teste local antes do commit

```bash
node --check assets/contacts.js
node scripts/check-contacts.mjs
node scripts/check-contacts-runtime.mjs
CONTACTS_TEST_ROLE=viewer node scripts/check-contacts-runtime.mjs
```

## Checklist funcional após publicar

- [ ] Os switches Contatos aparecem no CRM, Organizacional e Curso de Alemão.
- [ ] O usuário autenticado abre `contatos.html` sem novo login.
- [ ] Admin/recrutador cria uma pessoa e uma organização.
- [ ] O mesmo contato aceita mais de uma categoria.
- [ ] É possível vincular uma pessoa à organização principal.
- [ ] Uma interação aparece na linha do tempo.
- [ ] Uma próxima ação aparece na fila e pode ser concluída.
- [ ] Um cadastro com e-mail ou telefone repetido exibe alerta de duplicidade.
- [ ] Arquivar preserva o registro e o histórico.
- [ ] Viewer não vê ações de escrita e recebe bloqueio do RLS em tentativa direta.
- [ ] Nenhuma tabela retorna dados usando somente a role `anon`.

## Reversão

`scripts/contacts-rollback.sql` remove todo o módulo e seus dados. Ele é destrutivo e só deve ser executado se a migration acabou de ser instalada sem uso real, ou depois de exportar os dados e autorizar formalmente a remoção.
