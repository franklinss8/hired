import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// noms des anciennes clés (anon / service_role) ou des nouvelles (publishable / secret)
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export const hasDb = Boolean(url && anon);

/** Client lecture seule (pages). */
export function db() {
  if (!hasDb) return null;
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Client serveur avec la clé service (routes API uniquement). */
export function admin() {
  if (!url || !service) throw new Error("SUPABASE_SERVICE_KEY missing");
  return createClient(url, service, { auth: { persistSession: false } });
}
