// src/lib/supabase/client.ts
// Browser-side client — uses anon key only.

import { createClient } from "@supabase/supabase-js";

let _browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _browserClient = createClient(url, key);
  return _browserClient;
}
