create table if not exists public.database_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('dan', 'kyu', 'award', 'school')),
  status text not null check (status in ('success', 'error')),
  original_file_name text not null,
  importable_rows integer not null default 0 check (importable_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  supabase_imported_rows integer not null default 0 check (supabase_imported_rows >= 0),
  synced_profiles integer check (synced_profiles is null or synced_profiles >= 0),
  supabase_strategy text,
  skip_reasons jsonb not null default '[]'::jsonb,
  error_message text,
  uploaded_at timestamptz not null default now()
);

alter table public.database_import_runs enable row level security;

create index if not exists idx_database_import_runs_source_uploaded_at
  on public.database_import_runs (source, uploaded_at desc);

grant select, insert on public.database_import_runs to service_role;
