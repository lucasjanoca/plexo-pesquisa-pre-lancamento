# Plexo — Pesquisa Pré-Lançamento

Pesquisa pública e responsiva da Plexo para entender hábitos e necessidades relacionadas à experiência local, com painel administrativo privado para análise das respostas.

## 🌐 Projeto ao vivo

**[Acessar plexoplace.com.br](https://plexoplace.com.br/)**

Painel administrativo: `https://plexoplace.com.br/admin.html`

## Produção

- Frontend estático compatível com GitHub Pages.
- Respostas persistidas no Supabase.
- Nenhum nome, e-mail, telefone ou cadastro é solicitado ao participante.
- A tabela pública aceita somente `INSERT` anônimo; leitura, edição e exclusão não são expostas ao visitante.
- O painel administrativo usa Supabase Auth e só lê respostas quando o JWT contém `app_metadata.plexo_survey_admin = true`.
- RLS habilitado e valores esperados validados também no banco.
- Um identificador aleatório do navegador é transformado em SHA-256 e usado apenas para reduzir respostas duplicadas acidentais.
- Campo aberto limitado a 220 caracteres no frontend e no banco.
- Sem dependências JavaScript externas.
- CSP, política de referrer e `noindex` configurados nas páginas públicas e administrativas.

## Painel administrativo

O painel em `admin.html` foi criado para visualizar as respostas sem abrir `SELECT` para visitantes.

Recursos:

- login por e-mail e senha via Supabase Auth;
- cards com total de respostas, interesse positivo, prioridade mais citada e tempo médio;
- distribuição por alternativa em todas as perguntas fechadas;
- lista das respostas abertas;
- busca nos comentários;
- filtros por período;
- tabela dos envios mais recentes;
- exportação CSV;
- atualização manual e logout;
- layout responsivo para desktop e celular.

### Autorizar outro administrador

Crie ou escolha a conta no Supabase Auth e adicione esta informação em **App Metadata**:

```json
{
  "plexo_survey_admin": true
}
```

Não use `user_metadata` para autorização. A política de leitura consulta apenas `app_metadata` do JWT.

Depois de alterar a permissão, a conta deve entrar novamente para receber um token atualizado.

## Arquivos

- `index.html` — estrutura e metadados da pesquisa.
- `styles.css` — interface responsiva da pesquisa.
- `app.js` — fluxo da pesquisa e envio ao Supabase.
- `admin.html` — estrutura do painel administrativo.
- `admin.css` — visual do painel alinhado à identidade da pesquisa.
- `admin.js` — autenticação, leitura, filtros, métricas e CSV.
- `config.js` — URL do projeto e chave **publishable** do Supabase.
- `assets/fundo-plexo.webp` — imagem de fundo otimizada.
- `supabase/migrations/20260815_create_plexo_survey_responses.sql` — schema, constraints, grants, RLS e fusível de capacidade.
- `supabase/migrations/20260816_add_plexo_survey_admin_read_access.sql` — leitura administrativa protegida por Auth + RLS.

## Configuração do Supabase

1. Use o projeto Supabase da Plexo/Sites De Clientes, separado da InfoTech.io.
2. Aplique as migrations da pasta `supabase/migrations/` na ordem.
3. Obtenha a Project URL e uma chave `sb_publishable_...`.
4. Mantenha esses valores públicos em `config.js`.
5. Nunca coloque `sb_secret_...`, `service_role`, senha de banco ou credenciais de conta no frontend ou no GitHub.
6. Para o painel, mantenha a leitura bloqueada para `anon` e autorize somente contas administrativas por `app_metadata.plexo_survey_admin`.

A chave publishable é destinada ao uso no cliente. A segurança dos dados depende dos grants mínimos, constraints, Auth e RLS configurados no banco.

## Publicação

O projeto está publicado pelo GitHub Pages usando domínio personalizado.

O workflow `.github/workflows/pages.yml` valida os três arquivos JavaScript, procura chaves privadas por engano e publica somente os arquivos necessários do site. As migrations e a documentação não entram no artefato do Pages.

## Testes recomendados antes do lançamento

- Responder a pesquisa no celular e no desktop.
- Confirmar que uma resposta cria exatamente uma linha em `plexo_survey_responses`.
- Confirmar que uma segunda tentativa no mesmo navegador não cria duplicata.
- Confirmar que visitantes anônimos não conseguem fazer `SELECT`, `UPDATE` ou `DELETE` na tabela.
- Confirmar que um usuário autenticado sem `plexo_survey_admin = true` não consegue ler respostas.
- Confirmar que o administrador consegue abrir `admin.html`, filtrar dados e exportar CSV.
- Executar Supabase Security Advisor e Performance Advisor após alterações de banco.

## Isolamento

A pesquisa usa somente objetos com prefixo `plexo_` ou o schema privado `plexo_private`. Não altera tabelas da InfoTech.io, Empilhadores, Checklist ou RASS.
