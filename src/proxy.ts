import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static assets, image files and the public showcase feed (no session needed).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|showcase\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
