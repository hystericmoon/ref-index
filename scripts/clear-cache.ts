// Clears the live site's showcase cache (10 min otherwise) after bulk changes made outside the app:
// unlists, imports, SQL. Needs REVALIDATE_SECRET in .env.local and in Vercel (same value).
//
// Run:  node --env-file=.env.local scripts/clear-cache.ts [https://ref-index.vercel.app]

import process from "node:process";

const site = process.argv[2] ?? "https://ref-index.vercel.app";
const secret = process.env.REVALIDATE_SECRET;
if (!secret) {
  console.error("REVALIDATE_SECRET is not set (add it to .env.local).");
  process.exit(1);
}

const res = await fetch(`${site}/api/revalidate`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
