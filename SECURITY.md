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
- credenciais de contas;
- arquivos `.env` com segredos;
- tokens administrativos ou backups de dados reais.

A segurança do acesso público depende de RLS, grants mínimos, constraints e validações no servidor/banco. Se uma credencial privada for exposta, ela deve ser revogada ou rotacionada imediatamente.
