-- Repair remote schema drift from an already-applied tournament migration.
-- Some linked dev databases applied 202606040001 before divisions.sort_order was present
-- in the local migration file. The app now orders and mutates divisions by this column.

alter table public.divisions
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_divisions_tournament_sort
  on public.divisions(tournament_id, sort_order, created_at);
