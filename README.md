# Talents 4 Operations

Aplicação estática publicada pelo GitHub Pages e conectada ao Supabase.

## Caminhos usados pelo time

| Arquivo | Função | URL |
| --- | --- | --- |
| `index.html` | CRM Institucional | `/talents4/` |
| `organizacional.html` | Planejamento e operação por empregador | `/talents4/organizacional.html` |
| `alemao.html` | Turmas e acompanhamento do curso de alemão | `/talents4/alemao.html` |
| `talents.html` | Compatibilidade com favoritos antigos; redireciona ao CRM | `/talents4/talents.html` |

Os estilos e comportamentos compartilhados ficam em `assets/`. O sistema visual mantém a navegação e os caminhos existentes, mas unifica tipografia, cores, barras laterais, cabeçalhos, botões, cartões, formulários, tabelas, modais, foco por teclado, transições e estado de conexão.

No Planejamento Mensal, a tabela mostra somente atividades realmente cadastradas. Empregadores e linhas sem atividade preenchida permanecem ocultos; uma nova linha é criada pelo botão **Nova Atividade** ou pelo botão **Adicionar** do empregador.

## Banco de dados

O frontend utiliza somente a chave pública `anon` do Supabase. Permissões efetivas devem continuar protegidas por RLS.

Migrations versionadas ficam em `supabase/migrations/`. Para conferir antes de aplicar:

```powershell
npx supabase@latest link --project-ref xcxqtjzlqmncwnhbolnl
npx supabase@latest migration list --linked
npx supabase@latest db push --linked --dry-run
```

Não use `migration repair` sem verificar primeiro a diferença entre o histórico local e remoto.

## Publicação

1. Validar as três páginas localmente.
2. Aplicar migrations pendentes antes de publicar uma tela que dependa delas.
3. Enviar os arquivos para a branch `main`.
4. Aguardar o GitHub Pages e testar as URLs acima com uma conta de cada perfil: administrador, recrutador e visualizador.

## Regras de manutenção

- Não renomear os três arquivos principais: os links entre módulos dependem desses caminhos.
- Não criar outro cliente Supabase na mesma página; reutilizar o inicializador existente.
- Bibliotecas pesadas de DOCX, XLSX e PDF são carregadas somente quando a função é usada.
- Não publicar planilhas com dados de candidatos nem chaves `service_role` no repositório.
- Não remover código de Employer ou Tickets apenas porque as abas não aparecem; indicadores e vínculos internos ainda podem consumir essas rotinas.
