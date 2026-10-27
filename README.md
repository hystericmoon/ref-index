# Ref Index

A private library of UI screens you capture and tag, plus a public index of the websites and
apps that design galleries feature.

- Product brief: `docs/brief.md`
- Session plan: `docs/sessions.md`
- Progress log: `docs/progress.md`

## Run locally (Windows, PowerShell)

```powershell
pnpm install
copy .env.example .env.local   # then fill in the two Supabase values
pnpm dev                        # http://localhost:3000
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase · Vercel.
