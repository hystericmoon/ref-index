-- One design note per listed showcase site: a plain-words design.md (palette, type, layout, motion,
-- what makes it good) plus measured facts (fonts, colours, platform) from scripts/extract-facts.ts.
-- Served as /site/<id>.md, /designs.md and /designs.zip, and linked from /references.json.

create table public.showcase_designs (
  item_id uuid primary key references public.showcase_items(id) on delete cascade,
  design_md text,
  facts jsonb not null default '{}'::jsonb,
  facts_at timestamptz,
  generated_at timestamptz
);

alter table public.showcase_designs enable row level security;
revoke all on public.showcase_designs from anon, authenticated;
grant select on public.showcase_designs to anon, authenticated;
create policy "Anyone can read showcase designs" on public.showcase_designs
  for select to anon, authenticated using (true);
