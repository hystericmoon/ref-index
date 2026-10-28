"use client";

import { useActionState } from "react";
import { signInWithEmail, signInWithGoogle, type SignInState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, emailAction, sending] = useActionState<SignInState, FormData>(signInWithEmail, {
    status: initialError ? "error" : "idle",
    message: initialError,
  });

  if (state.status === "sent") {
    return (
      <div role="status" className="space-y-2 rounded-lg border p-4">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{state.email}</span>. Open it on
          this device to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={emailAction} className="space-y-3" noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.email}
            aria-invalid={state.status === "error" || undefined}
            aria-describedby={state.status === "error" ? "sign-in-error" : undefined}
            className="h-11"
          />
        </div>
        {state.status === "error" && (
          <p id="sign-in-error" role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={sending}>
          {sending ? "Sending link…" : "Email me a sign-in link"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" className="h-11 w-full">
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
