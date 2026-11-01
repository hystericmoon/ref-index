# Cloud handover

For when work moves to a cloud session (it stays on the Windows PC for now, as of 2026-11-01).
Read `CLAUDE.md` first, then the end of `docs/progress.md` (latest work and the "Later" list).

## Not in the repo (only on the Windows PC)
- `.env.local`: names in `.env.example`. The user sets the values as cloud environment
  variables; never ask for or handle their tokens.
- `cdn/`: the 1.1 GB local mirror of the Cloudflare Pages images. `scripts/cdn-sync.ts` uploads a
  whole folder and prunes unreferenced files, so never run it without the mirror or it could delete
  live images. Playwright captures and uploads stay on the PC.
- `tmp/`: capture logs and rejected retakes. Also the Supabase CLI link (`kolzsxfgqodulzteocnd`).

## Open items
- A few screenshots still show newsletter pop-ups (not cookie banners), e.g. Les Imparfaits.
- 204 sites failed the banner retake and keep their old picture; 46 old detail pictures are still soft.
- Back up `cdn/` (the only copy besides Cloudflare).
