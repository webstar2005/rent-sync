import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Phase 0: env not required to run scaffold — app shows warning until .env is set
  console.warn("[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — copy .env.example → .env (11.8)");
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
