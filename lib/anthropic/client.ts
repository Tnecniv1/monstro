import Anthropic from '@anthropic-ai/sdk'

// Instance unique du client Anthropic, côté serveur uniquement.
// La clé n'a pas de préfixe NEXT_PUBLIC_ : elle ne doit jamais être lue depuis
// le navigateur, seulement depuis les routes API (app/api/**/route.ts).
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
