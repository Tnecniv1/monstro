import Link from 'next/link'
import type { WeekActivityProfile, WeekDay } from './types'

interface Props {
  matrice: WeekActivityProfile[]
  jours: WeekDay[]
  isAdmin: boolean
  masquerFakes?: boolean
}

export default function MatriceActiviteView({ matrice, jours, isAdmin, masquerFakes }: Props) {
  const liste = masquerFakes ? matrice.filter((p) => !p.is_fake) : matrice

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide sticky left-0 bg-surface-2">
              Élève
            </th>
            {jours.map((j) => (
              <th key={j.date} className="text-center px-3 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                <div>{j.label}</div>
                <div className="text-[10px] font-normal normal-case text-text-muted/70 mt-0.5">{j.dateLabel}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {liste.map((p) => {
            const label = p.pseudo ?? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() ?? '—'

            return (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 sticky left-0 bg-surface">
                  <div className="flex items-center gap-2">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={label}
                        width={24}
                        height={24}
                        className="rounded-full object-cover flex-shrink-0"
                        style={{ width: 24, height: 24 }}
                      />
                    ) : (
                      <div
                        className="rounded-full bg-surface-2 flex items-center justify-center font-semibold text-text-secondary text-xs flex-shrink-0"
                        style={{ width: 24, height: 24 }}
                      >
                        {label ? label[0].toUpperCase() : '?'}
                      </div>
                    )}
                    {isAdmin ? (
                      <Link
                        href={`/admin/eleve/${p.id}`}
                        className="font-medium text-text-primary truncate max-w-[140px] hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="font-medium text-text-primary truncate max-w-[140px]">{label}</span>
                    )}
                  </div>
                </td>

                {p.activite.map((actif, idx) => (
                  <td key={idx} className="px-2 py-2 text-center">
                    <div
                      className={`mx-auto h-6 w-6 rounded-md ${actif ? 'bg-accent' : 'bg-white border border-border'}`}
                      title={actif ? 'Au moins une session ce jour-là' : 'Aucune session'}
                    />
                  </td>
                ))}
              </tr>
            )
          })}

          {liste.length === 0 && (
            <tr>
              <td colSpan={jours.length + 1} className="px-4 py-8 text-center text-text-muted">
                Aucun élève à afficher.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
