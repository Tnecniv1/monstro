'use client'

import Avatar from '@/app/components/Avatar'
import type { Laureat, NomVue, SemaineParis, VueClassement } from '@/lib/classement'

interface Props {
  vue: NomVue
  vues: Record<NomVue, VueClassement>
  etudiants: Laureat[]
  semaine: SemaineParis
  userId: string
}

const medals = [
  { ring: 'ring-accent', label: '1er' },
  { ring: 'ring-steel', label: '2ème' },
  { ring: 'ring-warning', label: '3ème' },
]

function formatScore(pixels: number, joursActifs: number): string {
  return `${pixels.toLocaleString('fr-FR')} px · ${joursActifs} j`
}

const podiumOrder = [1, 0, 2] // gauche=2e, centre=1er, droite=3e
// indexed by rank: [0]=1er, [1]=2ème, [2]=3ème
const podiumSize = ['h-24 w-24', 'h-20 w-20', 'h-16 w-16']
const podiumText = ['text-base', 'text-sm', 'text-sm']

export default function ClassementClient({ vue, vues, userId }: Props) {
  const top3 = vues[vue].podium
  const rest = vues[vue].liste
  const classement = [...top3, ...rest]

  return (
    <div className="space-y-8">

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-4 pt-4">
          {podiumOrder.map((rank) => {
            const user = top3[rank]
            if (!user) return <div key={rank} className="flex-1" />
            const pseudo = user.pseudo ?? '—'
            // Taille selon la place sur le podium ; couleur selon le rang renvoyé
            // par la RPC, pour que des ex-aequo portent la même médaille.
            const medaille = medals[Math.min(user.rang, 3) - 1]
            return (
              <div key={user.user_id} className="flex flex-col items-center gap-2 flex-1">
                <div className={`${podiumSize[rank]} rounded-full flex items-center justify-center overflow-hidden ring-4 ${medaille.ring}`}>
                  <Avatar url={user.avatar_url} pseudo={pseudo} size={rank === 0 ? 96 : rank === 1 ? 80 : 64} />
                </div>
                <p className={`font-semibold text-text-primary text-center truncate max-w-full ${podiumText[rank]}`}>
                  {pseudo}
                </p>
                <p className="text-xs text-text-secondary">{formatScore(user.pixels, user.jours_actifs)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Reste du classement */}
      {rest.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {rest.map((user) => {
            const pseudo = user.pseudo ?? '—'
            const isMe = user.user_id === userId
            return (
              <div
                key={user.user_id}
                className={`flex items-center px-4 py-3 gap-4 border-b border-border last:border-0 ${
                  isMe ? 'ring-1 ring-inset ring-accent' : ''
                }`}
              >
                <span className="w-6 text-sm text-text-muted text-right shrink-0">{user.rang}</span>
                <Avatar url={user.avatar_url} pseudo={pseudo} size={28} />
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {pseudo}
                </span>
                <span className="text-sm text-text-secondary">{formatScore(user.pixels, user.jours_actifs)}</span>
              </div>
            )
          })}
        </div>
      )}

      {classement.length === 0 && (
        <p className="text-center text-sm text-text-muted py-12">
          Aucun score pour l&apos;instant.
        </p>
      )}
    </div>
  )
}
