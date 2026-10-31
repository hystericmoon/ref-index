"use client";

import dynamic from "next/dynamic";

// Pieces most visitors never use load on their own, after the page, instead of with it.

/** Toasts only follow an action. */
export const LazyToaster = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), { ssr: false });

/** Only signed-in visitors see the account menu, so its dropdown code stays out of everyone else's download. */
export const LazyAccountMenu = dynamic(() => import("@/components/account-menu").then((m) => m.AccountMenu));
