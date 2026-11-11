"use client";

import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";

// Signs out, then does a full page load so nothing from the previous person
// stays in the browser's memory (matters on a shared family iPad).
export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          // A full page load on purpose: it clears the previous person's pages from memory.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login");
        })
      }
      className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base font-semibold text-ink transition hover:bg-canvas disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
