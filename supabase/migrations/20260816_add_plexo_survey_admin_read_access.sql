-- A leitura das respostas continua fechada para visitantes anônimos.
-- Somente usuários autenticados com app_metadata.plexo_survey_admin = true podem ler.

revoke select on table public.plexo_survey_responses from anon;

grant select (
  id,
  created_at,
  survey_version,
  discovery,
  promotions,
  services,
  events,
  priority,
  open_feedback,
  interest,
  duration_seconds
) on table public.plexo_survey_responses to authenticated;

drop policy if exists "plexo_survey_admins_can_read" on public.plexo_survey_responses;
create policy "plexo_survey_admins_can_read"
on public.plexo_survey_responses
for select
to authenticated
using (
  coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'plexo_survey_admin', 'false') = 'true'
);

comment on policy "plexo_survey_admins_can_read" on public.plexo_survey_responses is
  'Permite leitura apenas a contas autenticadas com app_metadata.plexo_survey_admin=true.';
