import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
      <Link
        href="/"
        className="flex min-h-11 items-center rounded-md font-display text-lg font-bold tracking-tight"
      >
        Ref Index
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user ? (
          <AccountMenu email={user.email} />
        ) : (
          <Button asChild variant="ghost" className="h-11 px-4">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
