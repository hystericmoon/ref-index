-- add_showcase_entries matches each entry on lower(url), then lower(name). Without these indexes
-- every entry scanned all ~21,000 items twice, and the daily refresh hit the 8 s statement timeout.
create index if not exists showcase_items_lower_url_idx on public.showcase_items (lower(url));
create index if not exists showcase_items_lower_name_idx on public.showcase_items (lower(name));
