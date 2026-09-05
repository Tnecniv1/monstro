'use client'

interface UserScore {
  id: string
  pseudo: string
  score: number
  avatar_url?: string | null
}

function Avatar({ url, pseudo, size }: { url?: string | null; pseudo: string; size: number }) {
  const initial = pseudo ? pseudo[0].toUpperCase() : '?'
  if (url) {
    return (
      <img
        src={url}
        alt={pseudo}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-surface-2 flex items-center justify-center font-semibold text-text-secondary"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}

interface Props {
  classement: UserScore[]
  userId: string
}

const medals = [
  { ring: 'ring-accent', label: '1er' },
  { ring: 'ring-steel', label: '2ème' },
  { ring: 'ring-warning', label: '3ème' },
]

function formatScore(score: number): string {
  if (score > 0) return `+${score} pts`
  if (score < 0) return `${score} pts`
  return `0 pts`
}

const podiumOrder = [1, 0, 2] // gauche=2e, centre=1er, droite=3e
// indexed by rank: [0]=1er, [1]=2ème, [2]=3ème
const podiumSize = ['h-24 w-24', 'h-20 w-20', 'h-16 w-16']
const podiumText = ['text-base', 'text-sm', 'text-sm']

export default function ClassementClient({ classement, userId }: Props) {
  const top3 = classement.slice(0, 3)
  const rest = classement.slice(3)

  return (
    <div className="space-y-8">

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-4 pt-4">
          {podiumOrder.map((rank) => {
            const user = top3[rank]
            if (!user) return <div key={rank} className="flex-1" />
            return (
              <div key={user.id} className="flex flex-col items-center gap-2 flex-1">
                <div className={`${podiumSize[rank]} rounded-full flex items-center justify-center overflow-hidden ring-4 ${medals[rank].ring}`}>
                  <Avatar url={user.avatar_url} pseudo={user.pseudo} size={rank === 0 ? 96 : rank === 1 ? 80 : 64} />
                </div>
                <p className={`font-semibold text-text-primary text-center truncate max-w-full ${podiumText[rank]}`}>
                  {user.pseudo}
                </p>
                <p className="text-xs text-text-secondary">{formatScore(user.score)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Reste du classement */}
      {rest.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {rest.map((user, i) => {
            const rank = i + 4
            const isMe = user.id === userId
            return (
              <div
                key={user.id}
                className={`flex items-center px-4 py-3 gap-4 border-b border-border last:border-0 ${
                  isMe ? 'ring-1 ring-inset ring-accent' : ''
                }`}
              >
                <span className="w-6 text-sm text-text-muted text-right shrink-0">{rank}</span>
                <Avatar url={user.avatar_url} pseudo={user.pseudo} size={28} />
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {user.pseudo}
                </span>
                <span className="text-sm text-text-secondary">{formatScore(user.score)}</span>
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
