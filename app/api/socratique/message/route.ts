import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic/client'
import {
  construireInstructionDetectionContinue,
  construireInstructionRelanceSet,
  construireSystemPrompt,
  type ConversationSujet,
} from '@/lib/anthropic/prompt-tuteur-socratique'
import { compterMessagesDuSet, MARQUEUR_SUCCES, MESSAGE_AMORCE, TAILLE_SET } from '@/lib/anthropic/tentative'
import type Anthropic from '@anthropic-ai/sdk'

// Un tour de la conversation ne demande jamais une réponse longue (la
// méthode socratique impose une seule question par message) : 4096 tokens
// laisse largement la place tout en évitant les réponses qui dérivent.
const MAX_TOKENS_REPONSE = 4096

type MessageRow = { role: 'user' | 'assistant'; contenu: string }

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: { sujetId?: string; message?: string }
  try {
    body = await request.json()
  } catch (error) {
    console.error('[api/socratique/message] body JSON invalide:', error)
    return Response.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const { sujetId, message } = body
  if (!sujetId || !message?.trim()) {
    return Response.json({ error: 'sujetId et message sont requis' }, { status: 400 })
  }

  const { data: sujet, error: sujetError } = await supabase
    .from('conversation_sujet')
    .select('id, niveau, titre, categorie, sujet, regles, objectif, ordre')
    .eq('id', sujetId)
    .single()

  if (sujetError || !sujet) {
    console.error('[api/socratique/message] sujet introuvable:', sujetError)
    return Response.json({ error: 'Sujet introuvable' }, { status: 404 })
  }

  const { data: historiqueData, error: historiqueError } = await supabase
    .from('conversation_message')
    .select('role, contenu')
    .eq('user_id', user.id)
    .eq('sujet_id', sujetId)
    .order('created_at')

  if (historiqueError) {
    console.error('[api/socratique/message] erreur chargement historique:', historiqueError)
    return Response.json({ error: 'Erreur lors du chargement de la conversation' }, { status: 500 })
  }

  const { error: insertUserError } = await supabase.from('conversation_message').insert({
    user_id: user.id,
    sujet_id: sujetId,
    role: 'user',
    contenu: message,
  })

  if (insertUserError) {
    console.error('[api/socratique/message] erreur insertion message user:', insertUserError)
    return Response.json({ error: "Erreur lors de l'enregistrement du message" }, { status: 500 })
  }

  const messages: Anthropic.MessageParam[] = [
    ...((historiqueData ?? []) as MessageRow[]).map((m) => ({
      role: m.role,
      content: m.contenu,
    })),
    { role: 'user' as const, content: message },
  ]

  // Frontière de set = dernier message assistant avec un marqueur de
  // tentative (ou le début de la conversation). Le message d'amorce
  // silencieuse ne compte jamais comme une tentative de l'étudiant.
  const estAmorce = message === MESSAGE_AMORCE
  const historiquePrecedent = (historiqueData ?? []) as MessageRow[]
  const tailleSetAvant = compterMessagesDuSet(historiquePrecedent)
  const tailleSet = estAmorce ? tailleSetAvant : tailleSetAvant + 1
  // Filet de secours seulement : >= et non === — une fois TAILLE_SET
  // dépassé sans marqueur, on continue de relancer à chaque tour au lieu de
  // ne tenter qu'une fois (l'ancien === ne se déclenchait qu'à la valeur
  // exacte 5 ; si le modèle ne posait pas de marqueur à ce tour précis, le
  // compteur dépassait 5 sans jamais redéclencher).
  const filetDeSecoursDeclenche = !estAmorce && tailleSet >= TAILLE_SET

  const sujetTypee = sujet as ConversationSujet
  const systemPrompt =
    construireSystemPrompt(sujetTypee) +
    `\n\n${construireInstructionDetectionContinue(sujetTypee.objectif)}` +
    (filetDeSecoursDeclenche ? `\n\n${construireInstructionRelanceSet()}` : '')

  const anthropicStream = anthropic.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: MAX_TOKENS_REPONSE,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  let texteComplet = ''

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      anthropicStream.on('text', (delta) => {
        texteComplet += delta
        controller.enqueue(encoder.encode(delta))
      })

      try {
        await anthropicStream.finalMessage()
      } catch (error) {
        console.error('[api/socratique/message] erreur streaming Anthropic:', error)
        controller.error(error)
        return
      }

      controller.close()

      if (!texteComplet.trim()) {
        console.error('[api/socratique/message] réponse assistant vide, non enregistrée')
        return
      }

      // Tentative réussie : le sujet passe en succès en base. L'échec, lui,
      // ne demande aucune action — le comptage du prochain tour repart de
      // zéro automatiquement grâce à ce nouveau message assistant marqué.
      if (texteComplet.includes(MARQUEUR_SUCCES)) {
        const { error: upsertSoumissionError } = await supabase.from('conversation_soumission').upsert(
          {
            user_id: user.id,
            sujet_id: sujetId,
            // Pas de lien externe avec le flux en streaming : placeholder
            // non nul au cas où la colonne serait NOT NULL (même choix que
            // app/api/socratique/cloturer).
            lien: 'streaming',
            resultat: 'succes',
          },
          { onConflict: 'user_id,sujet_id' }
        )

        if (upsertSoumissionError) {
          console.error(
            '[api/socratique/message] erreur upsert soumission (tentative réussie):',
            upsertSoumissionError
          )
        }
      }

      const { error: insertAssistantError } = await supabase.from('conversation_message').insert({
        user_id: user.id,
        sujet_id: sujetId,
        role: 'assistant',
        contenu: texteComplet,
      })

      if (insertAssistantError) {
        console.error('[api/socratique/message] erreur insertion réponse assistant:', insertAssistantError)
      }
    },
    cancel(reason) {
      console.error('[api/socratique/message] stream annulé côté client:', reason)
      anthropicStream.abort()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
