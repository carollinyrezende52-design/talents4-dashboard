// src/lib/supabase/server.ts
// Server-side Supabase client using the service role key.
// NEVER expose this to the browser.

import { createClient } from "@supabase/supabase-js";

let _serverClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer() {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  _serverClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _serverClient;
}
