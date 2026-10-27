-- Starter taxonomy from docs/brief.md. Editable later; reruns skip existing rows.

insert into public.facets (key, label, sort_order) values
  ('screen_type', 'Screen type', 0),
  ('ui_element', 'UI element', 1),
  ('pattern', 'Pattern', 2),
  ('platform', 'Platform', 3),
  ('industry', 'Industry', 4)
on conflict (key) do nothing;

insert into public.tags (facet_id, slug, label, synonyms)
select f.id, t.slug, t.label, t.synonyms
from (values
  ('screen_type', 'onboarding', 'Onboarding', array['welcome', 'intro', 'walkthrough']::text[]),
  ('screen_type', 'sign-up', 'Sign up', array['register', 'registration', 'create account']::text[]),
  ('screen_type', 'log-in', 'Log in', array['login', 'sign in', 'signin']::text[]),
  ('screen_type', 'paywall', 'Paywall', array['subscription', 'upgrade']::text[]),
  ('screen_type', 'pricing', 'Pricing', array['plans']::text[]),
  ('screen_type', 'home', 'Home', array['feed', 'start']::text[]),
  ('screen_type', 'dashboard', 'Dashboard', array['overview', 'analytics']::text[]),
  ('screen_type', 'settings', 'Settings', array['preferences']::text[]),
  ('screen_type', 'profile', 'Profile', array['account']::text[]),
  ('screen_type', 'checkout', 'Checkout', array['payment']::text[]),
  ('screen_type', 'cart', 'Cart', array['basket', 'bag']::text[]),
  ('screen_type', 'search', 'Search', array['find']::text[]),
  ('screen_type', 'empty-state', 'Empty state', array['no results', 'zero state']::text[]),
  ('screen_type', 'error', 'Error', array['404', 'failure']::text[]),
  ('screen_type', 'notifications', 'Notifications', array['alerts', 'activity']::text[]),
  ('screen_type', 'permissions-prompt', 'Permissions prompt', array['permission request', 'allow access']::text[]),
  ('screen_type', 'splash', 'Splash', array['launch screen', 'loading screen']::text[]),
  ('ui_element', 'bottom-sheet', 'Bottom sheet', array['action sheet', 'drawer']::text[]),
  ('ui_element', 'modal', 'Modal', array['dialog', 'popup', 'overlay']::text[]),
  ('ui_element', 'tab-bar', 'Tab bar', array['bottom navigation', 'tabs']::text[]),
  ('ui_element', 'navigation-drawer', 'Navigation drawer', array['hamburger menu', 'side menu']::text[]),
  ('ui_element', 'stepper', 'Stepper', array['progress steps', 'wizard']::text[]),
  ('ui_element', 'card', 'Card', '{}'::text[]),
  ('ui_element', 'data-table', 'Data table', array['table', 'grid']::text[]),
  ('ui_element', 'chart', 'Chart', array['graph']::text[]),
  ('ui_element', 'form', 'Form', array['input fields']::text[]),
  ('ui_element', 'toast', 'Toast', array['snackbar']::text[]),
  ('ui_element', 'segmented-control', 'Segmented control', array['toggle buttons']::text[]),
  ('ui_element', 'carousel', 'Carousel', array['slider']::text[]),
  ('ui_element', 'date-picker', 'Date picker', array['calendar']::text[]),
  ('ui_element', 'command-palette', 'Command palette', array['command menu', 'spotlight']::text[]),
  ('pattern', 'progressive-disclosure', 'Progressive disclosure', '{}'::text[]),
  ('pattern', 'social-proof', 'Social proof', array['testimonials', 'reviews']::text[]),
  ('pattern', 'inline-validation', 'Inline validation', array['form errors']::text[]),
  ('pattern', 'skeleton-loading', 'Skeleton loading', array['skeleton screen', 'placeholder loading']::text[]),
  ('pattern', 'gamification', 'Gamification', array['streaks', 'badges']::text[]),
  ('pattern', 'comparison-table', 'Comparison table', array['feature comparison']::text[]),
  ('pattern', 'upsell', 'Upsell', array['cross-sell']::text[]),
  ('platform', 'ios', 'iOS', array['iphone', 'ipad']::text[]),
  ('platform', 'android', 'Android', '{}'::text[]),
  ('platform', 'web', 'Web', array['desktop', 'website']::text[]),
  ('industry', 'fintech', 'Fintech', array['finance', 'banking', 'payments']::text[]),
  ('industry', 'e-commerce', 'E-commerce', array['ecommerce', 'shopping', 'retail']::text[]),
  ('industry', 'health', 'Health', array['fitness', 'wellness', 'medical']::text[]),
  ('industry', 'social', 'Social', array['community', 'messaging']::text[]),
  ('industry', 'productivity', 'Productivity', array['tools', 'workflow']::text[]),
  ('industry', 'education', 'Education', array['learning', 'edtech']::text[]),
  ('industry', 'travel', 'Travel', array['booking', 'hospitality']::text[]),
  ('industry', 'saas', 'SaaS', array['b2b', 'software']::text[])
) as t (facet_key, slug, label, synonyms)
join public.facets f on f.key = t.facet_key
on conflict (facet_id, slug) do nothing;
