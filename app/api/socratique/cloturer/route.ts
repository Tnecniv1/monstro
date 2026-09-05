import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic/client'
import { construireSystemPrompt, type ConversationSujet } from '@/lib/anthropic/prompt-tuteur-socratique'
import type Anthropic from '@anthropic-ai/sdk'

// L'évaluation finale ne doit renvoyer qu'un petit objet JSON : pas besoin
// du plafond généreux utilisé pour les tours de dialogue.
const MAX_TOKENS_VERDICT = 1024

const MESSAGE_CLOTURE =
  'Nous clôturons la session ici. Passe en mode évaluation finale comme décrit ' +
  'dans tes instructions (les 3 tests : discrimination, transfert, articulation ' +
  "de l'invariant), puis réponds UNIQUEMENT avec un objet JSON strict de la " +
  'forme {"verdict": "succes" ou "echec", "justification": "..."} — sans ' +
  'aucun texte avant ou après, sans balises markdown.'

type MessageRow = { role: 'user' | 'assistant'; contenu: string }
type Verdict = { verdict: 'succes' | 'echec'; justification: string }

function extraireVerdict(texte: string): Verdict | null {
  const nettoye = texte
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(nettoye)
    if (
      (parsed.verdict === 'succes' || parsed.verdict === 'echec') &&
      typeof parsed.justification === 'string'
    ) {
      return { verdict: parsed.verdict, justification: parsed.justification }
    }
    return null
  } catch (error) {
    console.error('[api/socratique/cloturer] JSON invalide dans la réponse:', error)
    return null
  }
}

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { sujetId?: string }
  try {
    body = await request.json()
  } catch (error) {
    console.error('[api/socratique/cloturer] body JSON invalide:', error)
    return Response.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const { sujetId } = body
  if (!sujetId) {
    return Response.json({ error: 'sujetId est requis' }, { status: 400 })
  }

  const { data: sujet, error: sujetError } = await supabase
    .from('conversation_sujet')
    .select('id, niveau, titre, categorie, sujet, regles, objectif, ordre')
    .eq('id', sujetId)
    .single()

  if (sujetError || !sujet) {
    console.error('[api/socratique/cloturer] sujet introuvable:', sujetError)
    return Response.json({ error: 'Sujet introuvable' }, { status: 404 })
  }

  const { data: historiqueData, error: historiqueError } = await supabase
    .from('conversation_message')
    .select('role, contenu')
    .eq('user_id', user.id)
    .eq('sujet_id', sujetId)
    .order('created_at')

  if (historiqueError) {
    console.error('[api/socratique/cloturer] erreur chargement historique:', historiqueError)
    return Response.json({ error: 'Erreur lors du chargement de la conversation' }, { status: 500 })
  }

  if (!historiqueData || historiqueData.length === 0) {
    return Response.json({ error: 'Aucune conversation à clôturer pour ce sujet' }, { status: 400 })
  }

  const messages: Anthropic.MessageParam[] = [
    ...(historiqueData as MessageRow[]).map((m) => ({
      role: m.role,
      content: m.contenu,
    })),
    { role: 'user' as const, content: MESSAGE_CLOTURE },
  ]

  const systemPrompt = construireSystemPrompt(sujet as ConversationSujet)

  let reponse: Anthropic.Message
  try {
    reponse = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: MAX_TOKENS_VERDICT,
      system: systemPrompt,
      messages,
    })
  } catch (error) {
    console.error('[api/socratique/cloturer] erreur appel Anthropic:', error)
    return Response.json({ error: "Erreur lors de l'appel au modèle" }, { status: 502 })
  }

  const blocTexte = reponse.content.find((bloc) => bloc.type === 'text')
  const texte = blocTexte && blocTexte.type === 'text' ? blocTexte.text : ''

  const verdict = extraireVerdict(texte)
  if (!verdict) {
    console.error('[api/socratique/cloturer] impossible de parser le verdict JSON:', texte)
    return Response.json({ error: 'Réponse du modèle invalide' }, { status: 502 })
  }

  const { error: upsertError } = await supabase.from('conversation_soumission').upsert(
    {
      user_id: user.id,
      sujet_id: sujetId,
      // Pas de lien externe avec le flux en streaming (contrairement à
      // l'ancien flux copier-coller vers claude.ai) : valeur non nulle au cas
      // où la colonne `lien` serait NOT NULL.
      lien: 'streaming',
      resultat: verdict.verdict,
    },
    { onConflict: 'user_id,sujet_id' }
  )

  if (upsertError) {
    console.error('[api/socratique/cloturer] erreur upsert soumission:', upsertError)
    return Response.json({ error: "Erreur lors de l'enregistrement du verdict" }, { status: 500 })
  }

  return Response.json({ verdict: verdict.verdict, justification: verdict.justification })
}
