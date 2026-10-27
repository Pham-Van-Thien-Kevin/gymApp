// De twee publieke Supabase-variabelen. "NEXT_PUBLIC_" betekent dat Next.js
// ze ook in de browserbundel stopt. Dat is hier veilig: de publishable key is
// bedoeld om publiek te zijn. De echte beveiliging zit in Row Level Security.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is niet geconfigureerd. Kopieer .env.example naar .env.local en vul " +
        "NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in (zie README).",
    );
  }
  return { url, key };
}
