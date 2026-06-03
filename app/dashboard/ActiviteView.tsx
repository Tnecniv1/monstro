import type { EnrichedProfile } from './types'

function formatTemps(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

interface Props {
  enriched: EnrichedProfile[]
  dateLabel: string
  activeCount: number
  masquerFakes?: boolean
}

export default function ActiviteView({ enriched, dateLabel, activeCount, masquerFakes }: Props) {
  const liste = masquerFakes
    ? enriched.filter((p) => !p.is_fake)
    : enriched
  const nbActifs = masquerFakes
    ? liste.filter((p) => p.actif).length
    : activeCount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          <span className={nbActifs > 0 ? 'text-green-600' : 'text-red-500'}>
            {nbActifs}
          </span>
          <span className="text-gray-400"> / {liste.length} actifs aujourd&apos;hui</span>
        </h1>
        <p className="text-sm text-gray-400 capitalize mt-0.5">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {liste.map(({ id, pseudo, prenom, nom, avatar_url, actif, tempsTotal }) => {
          const label = pseudo ?? `${prenom} ${nom}`

          if (actif) {
            return (
              <div key={id} className="relative bg-white rounded-xl border-2 border-gray-900 shadow-sm p-4">
                {tempsTotal > 0 && (
                  <span className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-medium rounded-full px-2 py-0.5">
                    {formatTemps(tempsTotal)}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {avatar_url ? (
                    <img
                      src={avatar_url}
                      alt={label ?? ''}
                      width={28}
                      height={28}
                      className="rounded-full object-cover flex-shrink-0"
                      style={{ width: 28, height: 28 }}
                    />
                  ) : (
                    <div
                      className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs flex-shrink-0"
                      style={{ width: 28, height: 28 }}
                    >
                      {label ? label[0].toUpperCase() : '?'}
                    </div>
                  )}
                  <span className="font-medium text-gray-900 text-sm truncate">{label}</span>
                </div>
              </div>
            )
          }

          return (
            <div key={id} className="bg-white rounded-xl border border-gray-200 p-4 opacity-50">
              <div className="flex items-center gap-2">
                {avatar_url ? (
                  <img
                    src={avatar_url}
                    alt={label ?? ''}
                    width={28}
                    height={28}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 28, height: 28 }}
                  />
                ) : (
                  <div
                    className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs flex-shrink-0"
                    style={{ width: 28, height: 28 }}
                  >
                    {label ? label[0].toUpperCase() : '?'}
                  </div>
                )}
                <span className="font-medium text-gray-900 text-sm truncate">{label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
