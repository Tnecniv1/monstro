import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Connexion et mot de passe oublié par pseudo ou email, sans jamais renvoyer
// l'email : remplace la RPC publique get_email_by_pseudo.
// POST { action: 'connexion' | 'oubli', identifiant, password? }
// Appelée sans session avec la clé anon (verify_jwt actif).

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

// Service role : lecture de user_profile et de auth.users. Ne sert qu'à
// résoudre l'identifiant, jamais à ouvrir une session.
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = [
  "https://monstro.fr",
  "https://www.monstro.fr",
  "http://localhost:3000",
];

const IDENTIFIANT_MAX = 100;
const PASSWORD_MAX = 200;

type Action = "connexion" | "oubli";

// Client anon neuf à chaque appel : aucune session partagée entre requêtes.
function clientAnon() {
  return createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Pseudo ou email → email, ou null si introuvable. Une erreur technique
// (base, API admin) est levée pour être distinguée d'un pseudo inconnu.
async function resoudreEmail(identifiant: string): Promise<string | null> {
  if (identifiant.includes("@")) return identifiant;

  // limit(2) suffit pour savoir s'il y a exactement une ligne.
  const { data: profils, error } = await admin
    .from("user_profile")
    .select("id")
    .eq("pseudo", identifiant)
    .limit(2);
  if (error) throw new Error(`user_profile : ${error.message}`);
  if (profils?.length !== 1) return null;

  const { data, error: errUser } = await admin.auth.admin.getUserById(profils[0].id);
  if (errUser) {
    if (errUser.status === 404) return null; // profil orphelin
    throw new Error(`getUserById : ${errUser.message}`);
  }
  return data.user?.email ?? null;
}

// Détail technique d'une erreur Supabase, sans données personnelles.
function detailErreur(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { status?: number; code?: string; message?: string };
    return `status=${e.status ?? "?"} code=${e.code ?? "?"} message=${e.message ?? "?"}`;
  }
  return String(err);
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  // Sans en-tête Origin (app mobile), pas de CORS à négocier.
  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  }

  const json = (corps: unknown, status = 200): Response =>
    new Response(JSON.stringify(corps), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "methode_non_autorisee" }, 405);

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return json({ error: "requete_invalide" }, 400);
  }
  if (!corps || typeof corps !== "object") return json({ error: "requete_invalide" }, 400);

  const action = corps.action;
  const identifiant = typeof corps.identifiant === "string" ? corps.identifiant.trim() : "";
  const password = corps.password;
  if (
    (action !== "connexion" && action !== "oubli") ||
    identifiant === "" ||
    identifiant.length > IDENTIFIANT_MAX ||
    (password !== undefined && (typeof password !== "string" || password.length > PASSWORD_MAX))
  ) {
    return json({ error: "requete_invalide" }, 400);
  }

  if ((action as Action) === "oubli") {
    // Réponse identique quel que soit le résultat : ne révèle ni l'existence
    // du pseudo ni l'échec de l'envoi.
    try {
      const email = await resoudreEmail(identifiant);
      if (email) {
        const { error } = await clientAnon().auth.resetPasswordForEmail(email);
        if (error) console.error("[auth-pseudo] oubli resetPasswordForEmail", detailErreur(error));
      }
    } catch (err) {
      console.error("[auth-pseudo] oubli", detailErreur(err));
    }
    return json({ ok: true });
  }

  // connexion
  if (typeof password !== "string" || password === "") {
    return json({ error: "requete_invalide" }, 400);
  }

  try {
    const email = await resoudreEmail(identifiant);
    // Pseudo introuvable et mauvais mot de passe : même réponse.
    if (!email) return json({ error: "identifiants_invalides" }, 401);

    const { data, error } = await clientAnon().auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 429 || error.code === "over_request_rate_limit") {
        return json({ error: "trop_de_tentatives" }, 429);
      }
      // Sans code, un 400 de GoTrue est un échec d'identifiants.
      if (error.code === "invalid_credentials" || (error.status === 400 && !error.code)) {
        return json({ error: "identifiants_invalides" }, 401);
      }
      console.error("[auth-pseudo] connexion signInWithPassword", detailErreur(error));
      return json({ error: "erreur_serveur" }, 500);
    }
    if (!data.session) {
      console.error("[auth-pseudo] connexion : session absente");
      return json({ error: "erreur_serveur" }, 500);
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error("[auth-pseudo] connexion", detailErreur(err));
    return json({ error: "erreur_serveur" }, 500);
  }
});
