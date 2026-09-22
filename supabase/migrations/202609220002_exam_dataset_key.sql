alter table public.exams
  add column if not exists dataset_key text;

create unique index if not exists exams_dataset_key_unique
  on public.exams(dataset_key);

alter table public.questions
  alter column max_score drop not null;
