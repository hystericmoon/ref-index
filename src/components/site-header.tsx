import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { SITE_NAME } from "@/lib/brand";
import { isEditor } from "@/lib/db/showcase";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const editor = user ? await isEditor(await createClient()) : false;

  return (
    <header className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-10">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-2 rounded-full text-[17px] font-semibold tracking-tight"
      >
        {SITE_NAME}
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user ? (
          <AccountMenu email={user.email} editor={editor} />
        ) : (
          <Button asChild variant="ghost" className="h-11 px-4">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
