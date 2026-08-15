# Plexo — Pesquisa Pré-Lançamento

Pesquisa pública e responsiva da Plexo para entender hábitos e necessidades relacionadas à experiência local.

## 🌐 Projeto ao vivo

**[Acessar plexoplace.com.br](https://plexoplace.com.br/)**

## Produção

- Frontend estático compatível com GitHub Pages.
- Respostas persistidas no Supabase.
- Nenhum nome, e-mail, telefone ou cadastro é solicitado.
- A tabela pública aceita somente `INSERT` anônimo; leitura, edição e exclusão não são expostas ao visitante.
- RLS habilitado e valores esperados validados também no banco.
- Um identificador aleatório do navegador é transformado em SHA-256 e usado apenas para reduzir respostas duplicadas acidentais.
- Campo aberto limitado a 220 caracteres no frontend e no banco.
- Sem dependências JavaScript externas.
- CSP, política de referrer e `noindex` configurados no HTML.

## Arquivos

- `index.html` — estrutura e metadados.
- `styles.css` — interface responsiva.
- `app.js` — fluxo da pesquisa e envio ao Supabase.
- `config.js` — URL do projeto e chave **publishable** do Supabase.
- `assets/fundo-plexo.webp` — imagem de fundo otimizada.
- `supabase/migrations/20260815_create_plexo_survey_responses.sql` — schema, constraints, grants, RLS e fusível de capacidade.

## Configuração do Supabase

1. Use um projeto Supabase separado da InfoTech.io. Neste ambiente, a Plexo fica isolada por nomes `plexo_...` no projeto Sites De Clientes!.
2. Aplique a migration em `supabase/migrations/20260815_create_plexo_survey_responses.sql`.
3. Obtenha a Project URL e uma chave `sb_publishable_...`.
4. Substitua os placeholders em `config.js`.
5. Nunca coloque `sb_secret_...`, `service_role`, senha de banco ou credenciais de conta no frontend ou no GitHub.

A chave publishable é destinada ao uso no cliente. A segurança dos dados depende dos grants mínimos, constraints e RLS configurados no banco.

## Publicação

O projeto está publicado pelo GitHub Pages usando domínio personalizado.

## Testes recomendados antes do lançamento

- Responder a pesquisa no celular e no desktop.
- Confirmar que uma resposta cria exatamente uma linha em `plexo_survey_responses`.
- Confirmar que uma segunda tentativa no mesmo navegador não cria duplicata.
- Confirmar que visitantes anônimos não conseguem fazer `SELECT`, `UPDATE` ou `DELETE` na tabela.
- Executar Supabase Security Advisor e revisar qualquer alerta antes de divulgar o link.

## Isolamento

A pesquisa usa somente objetos com prefixo `plexo_` ou o schema privado `plexo_private`. Não altera tabelas da InfoTech.io, Empilhadores, Checklist ou RASS.

## GitHub Pages

O repositório inclui `.github/workflows/pages.yml`. A cada push na `main`, o workflow valida o JavaScript, verifica se nenhuma chave secreta foi colocada no frontend e publica somente os arquivos necessários do site. A pasta `supabase/` e a documentação não entram no artefato público do Pages.
