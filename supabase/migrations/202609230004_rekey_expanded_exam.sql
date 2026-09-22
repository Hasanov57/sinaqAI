update public.exams
set dataset_key = '2025-03-02-graduation-11-az-incomplete',
    updated_at = now()
where dataset_key = '2025-03-02-graduation-11-az-test-15'
  and not exists (
    select 1
    from public.exams
    where dataset_key = '2025-03-02-graduation-11-az-incomplete'
  );
