// Import one-shot de l'historique WhatsApp Twilio dans whatsapp_message (logique dans
// lib/twilio/importHistorique.ts, aussi déclenchable depuis le Suivi). Relançable.
// Lancement : npx tsx --env-file=.env.local scripts/import-whatsapp-historique.ts
import { createAdminClient } from '../lib/supabase/admin'
import { importerHistoriqueWhatsApp } from '../lib/twilio/importHistorique'

async function main() {
  const r = await importerHistoriqueWhatsApp(createAdminClient())
  console.log(
    `Reçus : ${r.recus} (${r.entrantsImportes} importés). Envoyés : ${r.envoyes} (${r.sortantsImportes} importés, ${r.echecsIgnores} en échec ignorés).`,
  )
}

main().catch((e) => {
  console.error((e as Error).message)
  process.exit(1)
})
