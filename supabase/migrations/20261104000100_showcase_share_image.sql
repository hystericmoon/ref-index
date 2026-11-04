-- Some sites block screenshots (403, bot checks, rate limits) but publish a share picture (og:image or
-- twitter:image) for exactly this use. Those cards show that picture instead of a screenshot; this flag
-- marks them so the site can say so and a later screenshot can replace it.
alter table public.showcase_items
  add column thumb_is_share_image boolean not null default false;
