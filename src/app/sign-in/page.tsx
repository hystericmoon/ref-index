import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Send a new one.",
  google: "Google sign-in didn't work. Try again, or use your email.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 pb-24">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground">Your library is private. Sign in to see and add screens.</p>
      </div>
      <SignInForm next={next} initialError={error ? ERRORS[error] : undefined} />
    </main>
  );
}
