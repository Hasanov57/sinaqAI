alter table public.exams
  add column if not exists subject_order jsonb not null default '[]'::jsonb
    check (jsonb_typeof(subject_order) = 'array');

create table if not exists public.passages (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  canonical_id text not null,
  title text not null,
  passage_text text,
  passage_image_url text,
  sort_order integer not null check (sort_order > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (exam_id, canonical_id),
  check (passage_text is not null or passage_image_url is not null)
);

alter table public.questions
  add column if not exists passage_id uuid references public.passages(id) on delete set null;

alter table public.student_answers
  add column if not exists solution_image_path text;

alter type public.question_type add value if not exists 'handwritten_solution';

create or replace view public.published_questions
with (security_barrier = true)
as
select
  q.id,
  q.exam_id,
  q.subject_id,
  q.topic_id,
  q.canonical_id,
  q.canonical_order,
  q.question_type,
  q.question_text,
  q.question_text_latex,
  q.question_image_url,
  q.audio_url,
  q.grade_level,
  q.alt_standard,
  q.max_score,
  q.metadata,
  q.passage_id
from public.questions q
join public.exams e on e.id = q.exam_id
where e.status = 'published' and e.visibility = 'public';

create index if not exists passages_exam_order_idx
  on public.passages(exam_id, sort_order);
create index if not exists questions_passage_order_idx
  on public.questions(passage_id, canonical_order);

alter table public.passages enable row level security;

create policy "published_passages_are_public" on public.passages for select
  to anon, authenticated using (
    exists (
      select 1 from public.exams
      where exams.id = passages.exam_id
        and exams.status = 'published'
        and exams.visibility = 'public'
    ) or public.current_user_is_admin()
  );
create policy "admins_manage_passages" on public.passages for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-solutions', 'student-solutions', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "students_read_own_solution_images" on storage.objects for select
  to authenticated using (
    bucket_id = 'student-solutions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "students_upload_own_solution_images" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'student-solutions'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy "students_update_own_solution_images" on storage.objects for update
  to authenticated using (
    bucket_id = 'student-solutions'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'student-solutions'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy "students_delete_own_solution_images" on storage.objects for delete
  to authenticated using (
    bucket_id = 'student-solutions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.ai_explanation_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.ai_explanation_rate_limits enable row level security;
revoke all on public.ai_explanation_rate_limits from anon, authenticated;
grant all on public.ai_explanation_rate_limits to service_role;

create or replace function public.consume_ai_explanation_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ai_explanation_rate_limits as limits (user_id, window_started_at, request_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when limits.window_started_at <= now() - interval '1 minute' then now()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= now() - interval '1 minute' then 1
        else limits.request_count + 1
      end;

  return (select request_count <= 8 from public.ai_explanation_rate_limits where user_id = p_user_id);
end;
$$;
revoke all on function public.consume_ai_explanation_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_explanation_quota(uuid) to service_role;
