create schema if not exists plexo_private;

revoke all on schema plexo_private from public, anon, authenticated;

create table if not exists public.plexo_survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  survey_version integer not null default 1,
  submission_hash text not null,
  discovery text not null,
  promotions text not null,
  services text not null,
  events text not null,
  priority text not null,
  open_feedback text,
  interest text not null,
  duration_seconds integer,

  constraint plexo_survey_version_check check (survey_version = 1),
  constraint plexo_survey_hash_check check (submission_hash ~ '^[0-9a-f]{64}$'),
  constraint plexo_survey_discovery_check check (discovery in (
    'Instagram', 'WhatsApp', 'Google', 'Amigos / conhecidos', 'Nem sei onde procurar'
  )),
  constraint plexo_survey_promotions_check check (promotions in (
    'Sempre procuro', 'Às vezes', 'Só quando vejo por acaso', 'Quase nunca'
  )),
  constraint plexo_survey_services_check check (services in (
    'Pergunto para conhecidos', 'Procuro nas redes sociais', 'Pesquiso no Google',
    'Procuro em grupos / WhatsApp', 'Normalmente dá trabalho encontrar'
  )),
  constraint plexo_survey_events_check check (events in (
    'Normalmente já sei antes', 'Descubro em cima da hora', 'Às vezes descubro depois',
    'Quase nunca fico sabendo'
  )),
  constraint plexo_survey_priority_check check (priority in (
    'Promoções', 'Serviços e profissionais', 'Eventos', 'Compra e venda', 'Informações da cidade'
  )),
  constraint plexo_survey_feedback_check check (open_feedback is null or char_length(open_feedback) <= 220),
  constraint plexo_survey_interest_check check (interest in (
    'Com certeza', 'Quero conhecer primeiro', 'Talvez', 'Provavelmente não'
  )),
  constraint plexo_survey_duration_check check (
    duration_seconds is null or duration_seconds between 1 and 3600
  ),
  constraint plexo_survey_submission_unique unique (survey_version, submission_hash)
);

alter table public.plexo_survey_responses enable row level security;

revoke all on table public.plexo_survey_responses from anon, authenticated;
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

drop policy if exists "plexo_anonymous_visitors_can_submit" on public.plexo_survey_responses;
create policy "plexo_anonymous_visitors_can_submit"
on public.plexo_survey_responses
for insert
to anon
with check (
  survey_version = 1
  and submission_hash ~ '^[0-9a-f]{64}$'
  and char_length(coalesce(open_feedback, '')) <= 220
);

create index if not exists plexo_survey_responses_created_at_idx
  on public.plexo_survey_responses (created_at desc);

create index if not exists plexo_survey_responses_priority_idx
  on public.plexo_survey_responses (priority);

create or replace function plexo_private.enforce_survey_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  submissions_last_minute integer;
  submissions_last_hour integer;
begin
  select count(*) into submissions_last_minute
  from public.plexo_survey_responses
  where created_at >= now() - interval '1 minute';

  if submissions_last_minute >= 120 then
    raise exception 'survey temporarily busy' using errcode = 'P0001';
  end if;

  select count(*) into submissions_last_hour
  from public.plexo_survey_responses
  where created_at >= now() - interval '1 hour';

  if submissions_last_hour >= 2000 then
    raise exception 'survey temporarily busy' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function plexo_private.enforce_survey_capacity() from public, anon, authenticated;

drop trigger if exists plexo_survey_capacity_guard on public.plexo_survey_responses;
create trigger plexo_survey_capacity_guard
before insert on public.plexo_survey_responses
for each row execute function plexo_private.enforce_survey_capacity();

comment on table public.plexo_survey_responses is
  'Pesquisa pré-lançamento Plexo. Não solicita nome, e-mail, telefone nem conta de usuário.';

comment on function plexo_private.enforce_survey_capacity() is
  'Fusível global contra rajadas de abuso na pesquisa pública da Plexo.';
