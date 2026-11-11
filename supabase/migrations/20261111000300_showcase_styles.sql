-- Style tags: showcase_items.styles holds ids from src/lib/styles.ts (style, layout, colour), filled by
-- scripts/ai-categorize.ts. Search gains a p_styles filter (every listed id must match) and style words
-- in the relevance score; synonyms below map everyday words to style ids. The old 7-argument
-- search_showcase is dropped (a second overload would make calls ambiguous). Body otherwise as 20261111000200.

alter table public.showcase_items
  add column styles text[] not null default '{}',
  add column styles_checked_at timestamptz;
create index showcase_items_styles_idx on public.showcase_items using gin (styles);

drop function public.search_showcase(text, text, text, int, int, text, text);

create function public.search_showcase(
  p_query text default null,
  p_medium text default 'all',
  p_gallery text default null,
  p_offset int default 0,
  p_limit int default 60,
  p_view text default 'top',
  p_category text default null,
  p_styles text[] default null
)
returns table (
  id uuid, name text, url text, platform text, tags text[], thumb_path text,
  staff_pick boolean, gallery_count int, categories text[], featured jsonb, total bigint,
  thumb_is_share_image boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select x.w, coalesce(s.alts, '{}'::text[]) as alts,
           array(select lower(g.gallery) from (select distinct gallery from public.showcase_features) g
                 where position(x.w in lower(g.gallery)) > 0) as gals
    from (
      select distinct extensions.unaccent('extensions.unaccent'::regdictionary, w) as w
      from unnest(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+')) w
      where w <> ''
    ) x
    left join public.showcase_search_synonyms s on s.term = x.w
  ),
  base as (
    select i.*
    from public.showcase_items i
    where i.status = 'listed'
      and case coalesce(p_view, 'top')
            when 'archive' then i.thumb_checked_at is not null and i.thumb_path is null
            when 'all' then not (i.thumb_checked_at is not null and i.thumb_path is null)
            else not (i.thumb_checked_at is not null and i.thumb_path is null) and i.staff_pick
          end
      and (coalesce(p_medium, 'all') = 'all'
           or (p_medium = 'mobile' and i.platform in ('ios', 'android', 'mobile'))
           or i.platform = p_medium)
      and (nullif(p_category, '') is null or i.categories @> array[p_category])
      and (coalesce(cardinality(p_styles), 0) = 0 or i.styles @> p_styles)
      and (nullif(p_gallery, '') is null
           or exists (select 1 from public.showcase_features f where f.item_id = i.id and f.gallery = p_gallery))
  ),
  exact as (
    select b.*, r.rel
    from base b
    cross join lateral (
      select coalesce(sum(x.s), 0) as rel, coalesce(bool_and(x.s > 0), true) as ok
      from (
        select greatest(
                 case when b.name_norm = w.w then 100
                      when left(b.name_norm, length(w.w)) = w.w then 60
                      when position(' ' || w.w in b.name_norm) > 0 then 40
                      when position(w.w in b.name_norm) > 0 then 25
                      else 0 end,
                 case when b.categories && (w.alts || array[w.w]) then 20 else 0 end,
                 case when b.styles && (w.alts || array[w.w]) then 18 else 0 end,
                 case when exists (select 1 from unnest(w.alts) a where position(a in b.name_norm) > 0) then 20 else 0 end,
                 case when exists (select 1 from unnest(b.tags) t where position(w.w in lower(t)) > 0) then 15 else 0 end,
                 case when cardinality(w.gals) > 0
                           and exists (select 1 from public.showcase_features f where f.item_id = b.id and lower(f.gallery) = any (w.gals))
                      then 10 else 0 end,
                 case when position(w.w in b.url_norm) > 0 then 8 else 0 end
               ) as s
        from words w
      ) x
    ) r
    where r.ok
  ),
  -- Typos: only when the normal match found nothing.
  fuzzy as (
    select b.*, r.rel
    from base b
    cross join lateral (
      select coalesce(sum(x.s), 0) as rel, coalesce(bool_and(x.s > 0), true) as ok
      from (
        select case when position(w.w in b.name_norm) > 0 or position(w.w in b.url_norm) > 0 then 25
                    when length(w.w) >= 4 and extensions.word_similarity(w.w, b.name_norm) >= 0.55
                      then round(extensions.word_similarity(w.w, b.name_norm) * 20)::int
                    else 0 end as s
        from words w
      ) x
    ) r
    where not exists (select 1 from exact) and r.ok
  ),
  matches as (
    select * from exact
    union all
    select * from fuzzy
  )
  select m.id, m.name, m.url, m.platform, m.tags, m.thumb_path, m.staff_pick, m.gallery_count, m.categories,
         coalesce((select jsonb_agg(jsonb_build_object('gallery', f.gallery, 'sourceUrl', f.source_url) order by f.first_seen, f.gallery)
                   from public.showcase_features f where f.item_id = m.id), '[]'::jsonb),
         count(*) over (),
         m.thumb_is_share_image
  from matches m
  order by (m.rel + case when m.staff_pick then 30 else 0 end) desc, m.staff_pick desc, (m.thumb_path is null),
           m.gallery_count desc, m.first_seen desc, m.created_at desc, m.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 60), 1), 120);
$$;
grant execute on function public.search_showcase(text, text, text, int, int, text, text, text[]) to anon, authenticated;

-- Style words. alts may be style ids and/or category ids; both are matched.
insert into public.showcase_search_synonyms (term, alts) values
  ('minimalist', '{minimal}'), ('clean', '{minimal}'), ('simple', '{minimal}'), ('whitespace', '{minimal}'),
  ('typography', '{bold}'), ('typographic', '{bold}'), ('type', '{bold}'), ('oversized', '{bold}'),
  ('raw', '{brutalist}'), ('brutalism', '{brutalist}'), ('neobrutalism', '{brutalist}'), ('neo-brutalist', '{brutalist}'),
  ('magazine-style', '{editorial}'), ('serif', '{editorial}'),
  ('fun', '{playful}'), ('quirky', '{playful}'), ('cute', '{playful}'), ('whimsical', '{playful}'),
  ('vintage', '{retro}'), ('nostalgic', '{retro}'), ('y2k', '{retro}'), ('pixel', '{retro}'), ('90s', '{retro}'),
  ('sci-fi', '{futuristic}'), ('scifi', '{futuristic}'), ('techy', '{futuristic}'), ('glass', '{futuristic}'), ('glassmorphism', '{futuristic}'),
  ('premium', '{luxury}'), ('elegant', '{luxury}'), ('high-end', '{luxury}'), ('upscale', '{luxury}'),
  ('business', '{corporate}'), ('professional', '{corporate}'), ('enterprise', '{corporate}'),
  ('natural', '{organic}'), ('handmade', '{organic}'), ('soft', '{organic,pastel}'),
  ('illustration', '{illustrated}'), ('illustrations', '{illustrated}'), ('hand-drawn', '{illustrated}'), ('drawn', '{illustrated}'),
  ('3d', '{immersive}'), ('webgl', '{immersive}'), ('three.js', '{immersive}'), ('threejs', '{immersive}'), ('animation', '{immersive}'), ('animated', '{immersive}'), ('motion', '{immersive}'), ('interactive', '{immersive}'), ('video', '{immersive,full-bleed}'),
  ('cards', '{grid}'), ('tiles', '{grid}'), ('masonry', '{grid}'),
  ('bento-grid', '{bento}'), ('boxes', '{bento}'),
  ('experimental', '{asymmetric}'), ('overlapping', '{asymmetric}'), ('unconventional', '{asymmetric}'),
  ('centred', '{centered}'), ('hero', '{centered}'),
  ('two-column', '{split}'), ('split-screen', '{split}'), ('fullscreen', '{full-bleed}'), ('full-screen', '{full-bleed}'), ('fullbleed', '{full-bleed}'),
  ('side-nav', '{sidebar}'), ('sidenav', '{sidebar}'), ('sidebar-nav', '{sidebar}'),
  ('sideways', '{horizontal}'), ('carousel', '{horizontal}'), ('slider', '{horizontal}'),
  ('darkmode', '{dark}'), ('dark-mode', '{dark}'), ('black', '{dark,monochrome}'), ('night', '{dark}'),
  ('white', '{light}'), ('lightmode', '{light}'), ('bright', '{light,vibrant}'),
  ('black-and-white', '{monochrome}'), ('grayscale', '{monochrome}'), ('greyscale', '{monochrome}'), ('mono', '{monochrome}'),
  ('pastels', '{pastel}'), ('colorful', '{vibrant}'), ('colourful', '{vibrant}'), ('saturated', '{vibrant}'), ('rainbow', '{vibrant}'),
  ('fluorescent', '{neon}'), ('glow', '{neon}'), ('cyberpunk', '{neon}'),
  ('beige', '{earthy}'), ('brown', '{earthy}'), ('terracotta', '{earthy}'), ('olive', '{earthy}'), ('cream', '{earthy}'),
  ('gradients', '{gradient}'), ('mesh', '{gradient}'), ('yellow', '{orange}'), ('violet', '{purple}'), ('magenta', '{pink}'), ('teal', '{green}'), ('navy', '{blue}')
on conflict (term) do nothing;

create function public.showcase_style_counts()
returns table (style text, top bigint, everything bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s,
         count(*) filter (where staff_pick),
         count(*)
  from (
    select styles, staff_pick
    from public.showcase_items
    where status = 'listed' and not (thumb_checked_at is not null and thumb_path is null)
  ) i, unnest(i.styles) s
  group by s;
$$;
grant execute on function public.showcase_style_counts() to anon, authenticated;
