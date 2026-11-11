import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

// Supabase client with full rights, using the secret key. Server-only.
// Use it only after checking that the signed-in user is allowed to do the action.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing environment variable SUPABASE_SECRET_KEY.");
  }
  return createClient(supabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
