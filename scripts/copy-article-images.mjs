// Copie content/<dossier>/images/ vers public/articles/<dossier>/ (dossier généré, ignoré par git).
// Lancé par npm avant `dev` et `build`. Les .md eux-mêmes ne sont jamais copiés dans public/.
import { cpSync, existsSync, rmSync } from 'node:fs'

// SECTIONS de lib/articles.ts, plus la page /voyage (lib/voyage.ts)
const DOSSIERS = ['philosophie', 'problemes', 'voyage']
const DEST = 'public/articles'

rmSync(DEST, { recursive: true, force: true })

for (const dossier of DOSSIERS) {
  const src = `content/${dossier}/images`
  if (!existsSync(src)) continue
  cpSync(src, `${DEST}/${dossier}`, {
    recursive: true,
    filter: (path) => !path.endsWith('.gitkeep'),
  })
}
