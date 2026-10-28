-- Showcase: websites and apps that design galleries feature. Names, links and labels
-- only; gallery screenshots and descriptions are never stored. Public read; rows are
-- added by migrations and scripts/refresh-showcase.ts (which never deletes).

create table public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  platform text not null check (platform in ('web', '3d', 'ios', 'android', 'mobile')),
  tags text[] not null default '{}',
  first_seen date not null default current_date,
  created_at timestamptz not null default now(),
  unique nulls not distinct (name, url)
);

create table public.showcase_features (
  item_id uuid not null references public.showcase_items (id) on delete cascade,
  gallery text not null,
  source_url text not null,
  first_seen date not null default current_date,
  primary key (item_id, gallery)
);

create index showcase_features_gallery_idx on public.showcase_features (gallery);

alter table public.showcase_items enable row level security;
alter table public.showcase_features enable row level security;

revoke all on public.showcase_items, public.showcase_features from anon, authenticated;
grant select on public.showcase_items, public.showcase_features to anon, authenticated;

create policy "Anyone can read showcase items" on public.showcase_items
  for select to anon, authenticated using (true);
create policy "Anyone can read showcase features" on public.showcase_features
  for select to anon, authenticated using (true);
