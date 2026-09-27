// Copie content/<section>/images/ vers public/articles/<section>/ (dossier généré, ignoré par git).
// Lancé par npm avant `dev` et `build`. Les .md eux-mêmes ne sont jamais copiés dans public/.
import { cpSync, existsSync, rmSync } from 'node:fs'

// Même liste que SECTIONS dans lib/articles.ts
const SECTIONS = ['philosophie', 'problemes']
const DEST = 'public/articles'

rmSync(DEST, { recursive: true, force: true })

for (const section of SECTIONS) {
  const src = `content/${section}/images`
  if (!existsSync(src)) continue
  cpSync(src, `${DEST}/${section}`, {
    recursive: true,
    filter: (path) => !path.endsWith('.gitkeep'),
  })
}
