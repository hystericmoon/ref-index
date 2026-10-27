-- Core schema: taxonomy (facets, tags), directory (sources) and the private library
-- (apps, screens, flows, flow_screens, screen_tags). See docs/brief.md, "Data model".

create extension if not exists pg_trgm with schema extensions;

-- Taxonomy -------------------------------------------------------------------

create table public.facets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique
    check (key in ('screen_type', 'ui_element', 'pattern', 'platform', 'industry')),
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  facet_id uuid not null references public.facets (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (facet_id, slug)
);

create index tags_label_trgm_idx on public.tags using gin (label extensions.gin_trgm_ops);

-- Directory ------------------------------------------------------------------

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  home_url text not null,
  mediums text[] not null default '{}',
  kind text not null check (kind in ('query', 'tag', 'none')),
  url_template text,
  confirmed boolean not null default false,
  pricing text,
  description text,
  thumb_path text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check ((kind = 'none') = (url_template is null))
);

-- Library (private to owner) -------------------------------------------------

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  industry_tag_id uuid references public.tags (id) on delete set null,
  website text,
  logo_path text,
  created_at timestamptz not null default now()
);

create index apps_owner_id_idx on public.apps (owner_id);
create index apps_industry_tag_id_idx on public.apps (industry_tag_id);
create index apps_name_trgm_idx on public.apps using gin (name extensions.gin_trgm_ops);

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  image_path text not null,
  thumb_path text,
  width int check (width > 0),
  height int check (height > 0),
  captured_at timestamptz not null default now(),
  notes text,
  search_vector tsvector,
  created_at timestamptz not null default now()
);

create index screens_app_id_idx on public.screens (app_id);
create index screens_owner_captured_idx on public.screens (owner_id, captured_at desc);
create index screens_search_vector_idx on public.screens using gin (search_vector);

create table public.flows (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create index flows_app_id_idx on public.flows (app_id);
create index flows_owner_id_idx on public.flows (owner_id);

create table public.flow_screens (
  flow_id uuid not null references public.flows (id) on delete cascade,
  screen_id uuid not null references public.screens (id) on delete cascade,
  position int not null check (position >= 0),
  primary key (flow_id, screen_id),
  -- Deferred so a flow can be reordered inside one transaction.
  constraint flow_screens_flow_position_key unique (flow_id, position) deferrable initially deferred
);

create index flow_screens_screen_id_idx on public.flow_screens (screen_id);

create table public.screen_tags (
  screen_id uuid not null references public.screens (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (screen_id, tag_id)
);

create index screen_tags_tag_id_idx on public.screen_tags (tag_id);
