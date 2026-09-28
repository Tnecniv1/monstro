// Rendu serveur de l'image du rapport hebdomadaire (satori → SVG, puis sharp → PNG), pour l'envoi automatique.
// satori est le moteur de next/og ; appelé directement car next/og (Next 14.2) plante sous Windows
// en résolvant le chemin de sa police par défaut.
// Réplique en flexbox de RapportCard en mode capture (captureWidth=1080, pixelRatio 2) : satori ne
// gère pas la grille CSS et le cron n'a pas de navigateur pour genererPng(). Garder les deux alignés.
import fs from 'node:fs'
import path from 'node:path'
import satori from 'satori'
import sharp from 'sharp'

export type DonneesRapport = {
  problemesTravailles: number
  problemesTravaillesPrev: number
  minutesConcentration: number
  minutesConcentrationPrev: number
  tauxReussite: number
  tauxReussitePrev: number
  problemesReussis: number
}

// Mêmes valeurs que RapportCard (palette et objectif de la grille)
const COLORS = {
  fond: '#FAFAFA',
  carte: '#FFFFFF',
  bordure: '#ECECEF',
  accent: '#6D28D9',
  encre: '#1E2233',
  label: '#8A8B9B',
  caseVide: '#EEEEF1',
  hausse: '#3E9B6A',
  baisse: '#E07B5A',
}
const OBJECTIF_EXERCICES = 1000
const GRID_COLS = 40
const GRID_ROWS = OBJECTIF_EXERCICES / GRID_COLS

// Mise en page en « pixels CSS » de la capture (1080 de large), rendue à l'échelle 2
const S = 2
const px = (n: number) => n * S
const LARGEUR = 1080
const PADDING = 48
const GAP = 16
const H_ENTETE = 58
const H_TUILE = 186
const PAD_GRILLE = 28
const PAS = (LARGEUR - 2 * PADDING - 2 * PAD_GRILLE - 2) / GRID_COLS // largeur d'une case + marges
const H_GRILLE = 1 + PAD_GRILLE + 27 + 8 + GRID_ROWS * PAS + PAD_GRILLE + 1
const HAUTEUR = Math.ceil(PADDING + H_ENTETE + GAP + H_TUILE + GAP + H_GRILLE + PADDING)

function formatPctChange(delta: number, prevValue: number): string {
  const pct = (delta / prevValue) * 100
  const sign = pct >= 0 ? '+' : '-'
  const abs = Math.abs(pct).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${sign}${abs}%`
}

// "15 – 21 sept." ou, à cheval sur deux mois, "29 sept. – 5 oct." (comme RapportCard)
function formatPlageSemaine(lundi: string): string {
  const [y, m, d] = lundi.split('-').map(Number)
  const debut = new Date(y, m - 1, d)
  const fin = new Date(y, m - 1, d + 6)
  const mois = (date: Date) => date.toLocaleDateString('fr-FR', { month: 'short' })
  return debut.getMonth() === fin.getMonth()
    ? `${debut.getDate()} – ${fin.getDate()} ${mois(fin)}`
    : `${debut.getDate()} ${mois(debut)} – ${fin.getDate()} ${mois(fin)}`
}

let ressources: { fonts: { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: 'normal' }[]; logo: string } | null = null

function chargerRessources() {
  if (ressources) return ressources
  const fichierPolice = (poids: number) =>
    fs.readFileSync(path.join(process.cwd(), 'node_modules/@fontsource/inter/files', `inter-latin-${poids}-normal.woff`))
  const logo = fs.readFileSync(path.join(process.cwd(), 'public/images/logo.png')).toString('base64')
  ressources = {
    fonts: ([400, 600, 700, 800] as const).map((weight) => ({ name: 'Inter', data: fichierPolice(weight), weight, style: 'normal' as const })),
    logo: `data:image/png;base64,${logo}`,
  }
  return ressources
}

function Delta({ value, prevValue, suffix = '' }: { value: number; prevValue: number; suffix?: string }) {
  if (value === 0) return null
  const pct = prevValue ? formatPctChange(value, prevValue) : null
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', color: value >= 0 ? COLORS.hausse : COLORS.baisse, fontSize: px(24), fontWeight: 600 }}>
      {`${value > 0 ? '+' : ''}${value}${suffix}`}
      {pct && <span style={{ fontSize: px(18), marginLeft: px(5) }}>{`(${pct})`}</span>}
    </div>
  )
}

function Carte({ d, lundi, logo }: { d: DonneesRapport; lundi: string; logo: string }) {
  const tuiles = [
    { label: 'Expériences', valeur: `${d.problemesTravailles}`, delta: d.problemesTravailles - d.problemesTravaillesPrev, prev: d.problemesTravaillesPrev, suffix: '' },
    { label: 'Temps', valeur: `${d.minutesConcentration}`, delta: d.minutesConcentration - d.minutesConcentrationPrev, prev: d.minutesConcentrationPrev, suffix: '' },
    { label: 'Réussite', valeur: `${d.tauxReussite}%`, delta: d.tauxReussite - d.tauxReussitePrev, prev: d.tauxReussitePrev, suffix: ' pts' },
  ]
  const remplies = Math.max(0, Math.min(d.problemesReussis, OBJECTIF_EXERCICES))
  const carte = { background: COLORS.carte, border: `${px(1)}px solid ${COLORS.bordure}`, borderRadius: px(20) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: COLORS.fond, padding: px(PADDING), fontFamily: 'Inter' }}>
      {/* En-tête : logo + nom + plage de dates */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: px(H_ENTETE) }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendu satori, pas du DOM */}
          <img src={logo} width={px(56)} height={px(56)} style={{ background: COLORS.carte, border: `${px(1)}px solid ${COLORS.bordure}`, borderRadius: px(14) }} alt="" />
          <span style={{ marginLeft: px(12), fontSize: px(30), fontWeight: 800, color: COLORS.encre }}>Monstro</span>
        </div>
        <span style={{ fontSize: px(24), fontWeight: 600, color: COLORS.label }}>{formatPlageSemaine(lundi)}</span>
      </div>

      {/* Tuiles stats */}
      <div style={{ display: 'flex', marginTop: px(GAP), height: px(H_TUILE) }}>
        {tuiles.map((t, i) => (
          <div key={t.label} style={{ ...carte, display: 'flex', flexDirection: 'column', flex: 1, marginLeft: i === 0 ? 0 : px(GAP), padding: `${px(28)}px ${px(24)}px` }}>
            <span style={{ fontSize: px(20), fontWeight: 600, color: COLORS.label, textTransform: 'uppercase', letterSpacing: px(1), marginBottom: px(6) }}>{t.label}</span>
            <span style={{ fontSize: px(64), fontWeight: 800, color: COLORS.encre, lineHeight: 1 }}>{t.valeur}</span>
            <div style={{ display: 'flex', marginTop: px(5) }}>
              <Delta value={t.delta} prevValue={t.prev} suffix={t.suffix} />
            </div>
          </div>
        ))}
      </div>

      {/* Grille de progression */}
      <div style={{ ...carte, display: 'flex', flexDirection: 'column', marginTop: px(GAP), height: px(H_GRILLE), padding: px(PAD_GRILLE) }}>
        <div style={{ display: 'flex', fontSize: px(22), color: COLORS.label, height: px(27), marginBottom: px(8) }}>
          {/* satori supprime l'espace en tête d'un span : marge à la place */}
          <span style={{ color: COLORS.encre, fontWeight: 700, marginRight: px(6) }}>{`${d.problemesReussis}`}</span>
          <span>{`/ ${OBJECTIF_EXERCICES} exercices réussis`}</span>
        </div>
        {Array.from({ length: GRID_ROWS }, (_, ligne) => (
          <div key={ligne} style={{ display: 'flex' }}>
            {Array.from({ length: GRID_COLS }, (_, col) => {
              const i = ligne * GRID_COLS + col
              return (
                <div
                  key={col}
                  style={{
                    width: px(PAS * 0.8),
                    height: px(PAS * 0.8),
                    margin: px(PAS * 0.1),
                    borderRadius: px(PAS * 0.18),
                    background: i < remplies ? COLORS.accent : COLORS.caseVide,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** PNG du rapport (2160 px de large, comme genererPng()), prêt à être envoyé dans le bucket. */
export async function genererImageRapport(donnees: DonneesRapport, lundi: string): Promise<Buffer> {
  const { fonts, logo } = chargerRessources()
  const svg = await satori(<Carte d={donnees} lundi={lundi} logo={logo} />, {
    width: px(LARGEUR),
    height: px(HAUTEUR),
    fonts,
  })
  return sharp(Buffer.from(svg)).png().toBuffer()
}
