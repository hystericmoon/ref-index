-- Curation for the showcase.
-- * Editors (listed in public.editors) review items: keep, feature (staff pick) or hide.
-- * Public views: 'top' (staff picks and sites featured by 2+ galleries), 'all' (every
--   listed item that isn't known dead) and 'archive' (sites whose screenshot failed:
--   gone, parked or blocking). Hidden items never show publicly.

create table public.editors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.editors enable row level security;
create policy "editors see their own row" on public.editors
  for select to authenticated using (user_id = (select auth.uid()));

-- The project's one account so far is the owner's.
insert into public.editors (user_id) select id from auth.users order by created_at limit 1;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.editors where user_id = (select auth.uid()));
$$;
grant execute on function public.is_editor() to authenticated;

alter table public.showcase_items
  add column status text not null default 'listed' check (status in ('listed', 'hidden')),
  add column staff_pick boolean not null default false,
  add column reviewed_at timestamptz,
  add column gallery_count int not null default 1;

update public.showcase_items i
set gallery_count = (select count(*) from public.showcase_features f where f.item_id = i.id);

-- Keep gallery_count current as the refresh adds features.
create or replace function public.showcase_features_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.showcase_items i
  set gallery_count = (select count(*) from public.showcase_features f where f.item_id = i.id)
  where i.id = coalesce(new.item_id, old.item_id);
  return null;
end;
$$;
create trigger showcase_features_count
  after insert or delete on public.showcase_features
  for each row execute function public.showcase_features_count();

create index showcase_items_top_idx on public.showcase_items (staff_pick, gallery_count) where status = 'listed';

-- An editor's decision on one item: keep, feature, unfeature or hide.
create or replace function public.review_showcase_item(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_editor() then
    raise exception 'Only editors can review the showcase' using errcode = '42501';
  end if;
  update public.showcase_items
  set status = case when p_action = 'hide' then 'hidden' else 'listed' end,
      staff_pick = case p_action when 'feature' then true when 'keep' then false when 'hide' then false else staff_pick end,
      reviewed_at = now()
  where id = p_id;
end;
$$;
revoke execute on function public.review_showcase_item(uuid, text) from public, anon;
grant execute on function public.review_showcase_item(uuid, text) to authenticated;

drop function public.search_showcase(text, text, text, int, int);

create function public.search_showcase(
  p_query text default null,
  p_medium text default 'all',
  p_gallery text default null,
  p_offset int default 0,
  p_limit int default 60,
  p_view text default 'top'
)
returns table (
  id uuid, name text, url text, platform text, tags text[], thumb_path text,
  staff_pick boolean, gallery_count int, featured jsonb, total bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select w from unnest(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+')) w where w <> ''
  ),
  matches as (
    select i.*
    from public.showcase_items i
    where i.status = 'listed'
      and case coalesce(p_view, 'top')
            when 'archive' then i.thumb_checked_at is not null and i.thumb_path is null
            when 'all' then not (i.thumb_checked_at is not null and i.thumb_path is null)
            else not (i.thumb_checked_at is not null and i.thumb_path is null) and (i.staff_pick or i.gallery_count >= 2)
          end
      and (coalesce(p_medium, 'all') = 'all'
           or (p_medium = 'mobile' and i.platform in ('ios', 'android', 'mobile'))
           or i.platform = p_medium)
      and (nullif(p_gallery, '') is null
           or exists (select 1 from public.showcase_features f where f.item_id = i.id and f.gallery = p_gallery))
      and not exists (
        select 1 from words
        where not (
          lower(i.name) like '%' || w || '%'
          or lower(coalesce(i.url, '')) like '%' || w || '%'
          or exists (select 1 from unnest(i.tags) t where lower(t) like '%' || w || '%')
          or exists (select 1 from public.showcase_features f where f.item_id = i.id and lower(f.gallery) like '%' || w || '%')
        )
      )
  )
  select m.id, m.name, m.url, m.platform, m.tags, m.thumb_path, m.staff_pick, m.gallery_count,
         coalesce((select jsonb_agg(jsonb_build_object('gallery', f.gallery, 'sourceUrl', f.source_url) order by f.first_seen, f.gallery)
                   from public.showcase_features f where f.item_id = m.id), '[]'::jsonb),
         count(*) over ()
  from matches m
  order by m.staff_pick desc, (m.thumb_path is null), m.gallery_count desc, m.first_seen desc, m.created_at desc, m.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 60), 1), 120);
$$;
grant execute on function public.search_showcase(text, text, text, int, int, text) to anon, authenticated;

-- How many items each public view holds, for the view switch.
create or replace function public.showcase_view_counts()
returns table (top bigint, everything bigint, archive bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where not dead and (staff_pick or gallery_count >= 2)),
    count(*) filter (where not dead),
    count(*) filter (where dead)
  from (
    select staff_pick, gallery_count, (thumb_checked_at is not null and thumb_path is null) as dead
    from public.showcase_items where status = 'listed'
  ) i;
$$;
grant execute on function public.showcase_view_counts() to anon, authenticated;

-- The editor's queue: unreviewed items with a screenshot, most-featured first.
create or replace function public.showcase_review_queue(p_limit int default 24)
returns table (id uuid, name text, url text, platform text, thumb_path text, gallery_count int, galleries text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.name, i.url, i.platform, i.thumb_path, i.gallery_count,
         array(select f.gallery from public.showcase_features f where f.item_id = i.id order by f.gallery)
  from public.showcase_items i
  where i.reviewed_at is null and i.status = 'listed' and i.thumb_path is not null
  order by i.gallery_count desc, i.first_seen desc, i.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100);
$$;
grant execute on function public.showcase_review_queue(int) to authenticated;
