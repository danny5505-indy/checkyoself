"use client";

import { createBrowserClient } from "@supabase/ssr";

// Supabase in the browser, signed in as the current user. Used only for live updates;
// all reads and writes go through the server.
let client: ReturnType<typeof createBrowserClient> | null = null;

export function browserClient() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}
