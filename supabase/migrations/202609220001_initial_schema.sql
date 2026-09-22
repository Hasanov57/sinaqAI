create extension if not exists pgcrypto;

create type public.exam_type as enum (
  'graduation_9',
  'graduation_11',
  'admission_stage_1',
  'admission_stage_2',
  'mock_exam',
  'other'
);

create type public.exam_status as enum ('draft', 'published');
create type public.exam_visibility as enum ('private', 'unlisted', 'public');
create type public.question_type as enum (
  'multiple_choice',
  'short_answer',
  'constructed_response',
  'table',
  'essay',
  'listening',
  'other'
);
create type public.attempt_status as enum ('in_progress', 'submitted');
create type public.grading_method as enum (
  'exact',
  'official_match',
  'ai_assisted',
  'manual',
  'ungraded'
);
create type public.answer_source_type as enum ('official_dim', 'admin_added');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  year integer not null check (year between 2000 and 2100),
  exam_date date,
  exam_type public.exam_type not null,
  grade integer check (grade between 1 and 12),
  group_name text,
  language_section text not null default 'AZ' check (language_section in ('AZ', 'RU')),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  official_source_url text,
  source_pdf_url text,
  status public.exam_status not null default 'draft',
  visibility public.exam_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  topic_id uuid references public.topics(id) on delete set null,
  canonical_id text not null,
  canonical_order integer not null check (canonical_order > 0),
  question_type public.question_type not null,
  question_text text,
  question_text_latex text,
  question_image_url text,
  audio_url text,
  official_explanation text,
  official_answer_text text,
  grade_level integer check (grade_level is null or grade_level between 1 and 12),
  alt_standard text,
  max_score numeric(8, 3) not null check (max_score > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, canonical_id),
  unique (exam_id, canonical_order),
  check (question_text is not null or question_image_url is not null or audio_url is not null)
);

create table public.question_variant_numbers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  variant_name text not null,
  question_number integer not null check (question_number > 0),
  unique (question_id, variant_name)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_key text not null,
  option_text text,
  option_image_url text,
  is_correct boolean not null default false,
  sort_order integer not null check (sort_order > 0),
  unique (question_id, option_key),
  unique (question_id, sort_order),
  check (option_text is not null or option_image_url is not null)
);

create unique index one_correct_option_per_question
  on public.question_options(question_id)
  where is_correct;

create table public.accepted_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text not null,
  normalized_answer text,
  score numeric(8, 3) not null check (score >= 0),
  notes text,
  source_type public.answer_source_type not null,
  created_at timestamptz not null default now(),
  unique (question_id, answer_text, score)
);

create table public.scoring_rubrics (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions(id) on delete cascade,
  max_score numeric(8, 3) not null check (max_score > 0),
  rubric_json jsonb not null,
  official_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(rubric_json) = 'object')
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete restrict,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status public.attempt_status not null default 'in_progress',
  total_score numeric(8, 3),
  max_score numeric(8, 3),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  check (
    (status = 'in_progress' and submitted_at is null)
    or (status = 'submitted' and submitted_at is not null)
  )
);

create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_option_id uuid references public.question_options(id) on delete restrict,
  text_answer text,
  awarded_score numeric(8, 3) check (awarded_score is null or awarded_score >= 0),
  is_correct boolean,
  grading_method public.grading_method not null default 'ungraded',
  ai_confidence numeric(4, 3) check (ai_confidence is null or ai_confidence between 0 and 1),
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  check (selected_option_id is not null or text_answer is not null)
);

create table public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  student_answer_hash text,
  explanation_type text not null check (explanation_type in ('generic', 'personalized')),
  content text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (question_id, user_id, student_answer_hash, explanation_type),
  check (
    (explanation_type = 'generic' and user_id is null)
    or (explanation_type = 'personalized' and user_id is not null)
  )
);

create index exams_published_filter_idx on public.exams(status, visibility, year, exam_type);
create index questions_exam_order_idx on public.questions(exam_id, canonical_order);
create index questions_subject_topic_idx on public.questions(subject_id, topic_id);
create index exam_attempts_user_started_idx on public.exam_attempts(user_id, started_at desc);
create index student_answers_attempt_idx on public.student_answers(attempt_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before update on public.exams
for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before update on public.questions
for each row execute function public.set_updated_at();
create trigger scoring_rubrics_set_updated_at before update on public.scoring_rubrics
for each row execute function public.set_updated_at();
create trigger student_answers_set_updated_at before update on public.student_answers
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.current_user_is_admin() to anon, authenticated;

create or replace function public.prevent_submitted_answer_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.exam_attempts
    where id = coalesce(new.attempt_id, old.attempt_id)
      and status = 'submitted'
  ) then
    raise exception 'Submitted attempt answers cannot be changed';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger student_answers_lock_after_submit
before insert or update or delete on public.student_answers
for each row execute function public.prevent_submitted_answer_changes();

alter table public.profiles enable row level security;
alter table public.exams enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_variant_numbers enable row level security;
alter table public.question_options enable row level security;
alter table public.accepted_answers enable row level security;
alter table public.scoring_rubrics enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.ai_explanations enable row level security;

create policy "profiles_select_own" on public.profiles for select
  to authenticated using (id = auth.uid() or public.current_user_is_admin());
create policy "profiles_update_own" on public.profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid() and is_admin = false);

create policy "published_exams_are_public" on public.exams for select
  to anon, authenticated using (
    (status = 'published' and visibility = 'public') or public.current_user_is_admin()
  );
create policy "admins_manage_exams" on public.exams for all
  to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "subjects_are_public" on public.subjects for select to anon, authenticated using (true);
create policy "admins_manage_subjects" on public.subjects for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "topics_are_public" on public.topics for select to anon, authenticated using (true);
create policy "admins_manage_topics" on public.topics for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "published_questions_are_public" on public.questions for select
  to anon, authenticated using (
    exists (
      select 1 from public.exams
      where exams.id = questions.exam_id
        and exams.status = 'published'
        and exams.visibility = 'public'
    ) or public.current_user_is_admin()
  );
create policy "admins_manage_questions" on public.questions for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "published_variant_numbers_are_public" on public.question_variant_numbers for select
  to anon, authenticated using (
    exists (
      select 1 from public.questions
      join public.exams on exams.id = questions.exam_id
      where questions.id = question_variant_numbers.question_id
        and exams.status = 'published' and exams.visibility = 'public'
    ) or public.current_user_is_admin()
  );
create policy "admins_manage_variant_numbers" on public.question_variant_numbers for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "published_options_are_public" on public.question_options for select
  to anon, authenticated using (
    exists (
      select 1 from public.questions
      join public.exams on exams.id = questions.exam_id
      where questions.id = question_options.question_id
        and exams.status = 'published' and exams.visibility = 'public'
    ) or public.current_user_is_admin()
  );
create policy "admins_manage_options" on public.question_options for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "published_accepted_answers_are_public" on public.accepted_answers for select
  to anon, authenticated using (
    exists (
      select 1 from public.questions
      join public.exams on exams.id = questions.exam_id
      where questions.id = accepted_answers.question_id
        and exams.status = 'published' and exams.visibility = 'public'
    ) or public.current_user_is_admin()
  );
create policy "admins_manage_accepted_answers" on public.accepted_answers for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "published_rubrics_are_public" on public.scoring_rubrics for select
  to anon, authenticated using (
    exists (
      select 1 from public.questions
      join public.exams on exams.id = questions.exam_id
      where questions.id = scoring_rubrics.question_id
        and exams.status = 'published' and exams.visibility = 'public'
    ) or public.current_user_is_admin()
  );
create policy "admins_manage_rubrics" on public.scoring_rubrics for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "users_select_own_attempts" on public.exam_attempts for select
  to authenticated using (user_id = auth.uid() or public.current_user_is_admin());
create policy "users_create_own_attempts" on public.exam_attempts for insert
  to authenticated with check (user_id = auth.uid() and status = 'in_progress');
create policy "users_update_own_attempts" on public.exam_attempts for update
  to authenticated using (user_id = auth.uid() and status = 'in_progress')
  with check (user_id = auth.uid());

create policy "users_select_own_answers" on public.student_answers for select
  to authenticated using (
    exists (
      select 1 from public.exam_attempts
      where exam_attempts.id = student_answers.attempt_id
        and (exam_attempts.user_id = auth.uid() or public.current_user_is_admin())
    )
  );
create policy "users_insert_own_answers" on public.student_answers for insert
  to authenticated with check (
    exists (
      select 1 from public.exam_attempts
      where exam_attempts.id = student_answers.attempt_id
        and exam_attempts.user_id = auth.uid()
        and exam_attempts.status = 'in_progress'
    )
  );
create policy "users_update_own_answers" on public.student_answers for update
  to authenticated using (
    exists (
      select 1 from public.exam_attempts
      where exam_attempts.id = student_answers.attempt_id
        and exam_attempts.user_id = auth.uid()
        and exam_attempts.status = 'in_progress'
    )
  ) with check (
    exists (
      select 1 from public.exam_attempts
      where exam_attempts.id = student_answers.attempt_id
        and exam_attempts.user_id = auth.uid()
        and exam_attempts.status = 'in_progress'
    )
  );

create policy "explanations_follow_published_questions" on public.ai_explanations for select
  to authenticated using (
    user_id = auth.uid()
    or (
      explanation_type = 'generic'
      and exists (
        select 1 from public.questions
        join public.exams on exams.id = questions.exam_id
        where questions.id = ai_explanations.question_id
          and exams.status = 'published' and exams.visibility = 'public'
      )
    )
    or public.current_user_is_admin()
  );
create policy "admins_manage_explanations" on public.ai_explanations for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- Students must be able to load question content without receiving the answer
-- key. These views expose only fields needed before submission. Grading and
-- post-submission explanations should be served by trusted server code.
create view public.published_questions
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
  q.metadata
from public.questions q
join public.exams e on e.id = q.exam_id
where e.status = 'published' and e.visibility = 'public';

create view public.published_question_options
with (security_barrier = true)
as
select
  o.id,
  o.question_id,
  o.option_key,
  o.option_text,
  o.option_image_url,
  o.sort_order
from public.question_options o
join public.questions q on q.id = o.question_id
join public.exams e on e.id = q.exam_id
where e.status = 'published' and e.visibility = 'public';

revoke select on public.questions from anon, authenticated;
revoke select on public.question_options from anon, authenticated;
revoke select on public.accepted_answers from anon, authenticated;
revoke select on public.scoring_rubrics from anon, authenticated;
grant select on public.published_questions to anon, authenticated;
grant select on public.published_question_options to anon, authenticated;
