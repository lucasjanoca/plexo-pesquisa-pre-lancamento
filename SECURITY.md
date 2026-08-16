# Política de Segurança

A pesquisa Plexo é publicada como frontend estático. Credenciais privadas nunca devem ser adicionadas ao repositório ou entregues ao navegador.

## Permitido no frontend

- Project URL do Supabase;
- chave publishable/anon destinada ao cliente;
- configurações públicas necessárias ao funcionamento da aplicação.

## Nunca publicar

- `sb_secret_...`;
- `service_role`;
- senha do banco;
- senha de administrador;
- access token ou refresh token de usuário;
- arquivos `.env` com segredos;
- backups de dados reais.

## Pesquisa pública

Visitantes anônimos recebem somente o privilégio necessário para inserir uma resposta válida. RLS, constraints, limite do campo aberto, deduplicação e o fusível global de capacidade continuam sendo barreiras no banco.

## Painel administrativo

O endereço do painel não é tratado como segredo. A proteção real fica no Supabase:

- login via Supabase Auth;
- `SELECT` não é concedido a `anon`;
- `SELECT` para `authenticated` depende de RLS;
- a política exige `app_metadata.plexo_survey_admin = true`;
- `user_metadata` não é usado para autorização;
- o navegador recebe apenas o token da própria sessão autenticada, nunca `service_role` ou chave secreta.

Ao remover ou adicionar a permissão administrativa, a sessão do usuário deve ser renovada para atualizar as claims do JWT.

Se uma credencial privada for exposta, ela deve ser revogada ou rotacionada imediatamente.
