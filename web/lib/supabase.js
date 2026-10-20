import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_KEY;

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
