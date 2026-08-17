alter table public.plexo_survey_responses enable row level security;
alter table public.plexo_survey_responses force row level security;

revoke all on table public.plexo_survey_responses from anon, authenticated;

revoke all (
  id,
  created_at,
  survey_version,
  submission_hash,
  discovery,
  promotions,
  services,
  events,
  priority,
  open_feedback,
  interest,
  duration_seconds
) on table public.plexo_survey_responses from anon, authenticated;

grant insert (
  survey_version,
  submission_hash,
  discovery,
  promotions,
  services,
  events,
  priority,
  open_feedback,
  interest,
  duration_seconds
) on table public.plexo_survey_responses to anon;

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

revoke all on schema plexo_private from public, anon, authenticated;
revoke all on function plexo_private.enforce_survey_capacity() from public, anon, authenticated;

comment on table public.plexo_survey_responses is
  'Pesquisa pré-lançamento Plexo. RLS forçado; anon somente insere colunas permitidas e somente admins autenticados podem ler respostas.';
