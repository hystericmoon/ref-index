-- Showcase items without a live address, with the gallery page each was featured on.
select distinct on (i.id) i.id, i.name, f.gallery, f.source_url
from public.showcase_items i
join public.showcase_features f on f.item_id = i.id
where i.url is null
order by i.id, f.first_seen;
