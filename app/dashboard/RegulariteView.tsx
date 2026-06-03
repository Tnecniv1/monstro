'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ObjectifModal from './ObjectifModal'
import ObjectifGlobalModal from './ObjectifGlobalModal'
import type { RegulariteRow, UserRegularite, ObjGlobal } from './types'

const JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONG  = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

interface Props {
  currentUserId: string
  isAdmin: boolean
  masquerFakes?: boolean
}

function globalColor(n: number): string {
  if (n <= 30) return 'text-red-600'
  if (n <= 60) return 'text-orange-600'
  return 'text-green-700'
}

function indiceStyle(indice: number): string {
  if (indice <= 0.30) return 'bg-red-50 text-red-600'
  if (indice <= 0.60) return 'bg-orange-50 text-orange-600'
  return 'bg-green-50 text-green-700'
}

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const EMPTY_OBJ_GLOBAL: ObjGlobal = {
  feuille_id: null,
  feuille_titre: null,
  ref_exercice: null,
  note: null,
}

export default function RegulariteView({ currentUserId, isAdmin, masquerFakes }: Props) {
  const supabase = createClient()

  // Source de vérité pour l'ID : récupéré côté client depuis l'auth,
  // indépendamment du prop serveur (évite les désynchronisations de session).
  const [userId, setUserId] = useState<string>(currentUserId)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id)
    })
  }, [currentUserId])

  const [rows, setRows] = useState<UserRegularite[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<{
    userId: string
    jourSemaine: number
    jourNom: string
    feuille_id: string | null
    ref_exercice: number | null
    note: string | null
  } | null>(null)

  const [modalGlobal, setModalGlobal] = useState<{
    userId: string
    obj: ObjGlobal
  } | null>(null)

  const charger = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_regularite_dashboard')
    if (error) console.error('[RegulariteView] RPC error:', error)
    if (data) {
      const map = new Map<string, UserRegularite>()
      for (const row of data as RegulariteRow[]) {
        if (!map.has(row.user_id)) {
          map.set(row.user_id, {
            user_id: row.user_id,
            pseudo: row.pseudo,
            avatar_url: row.avatar_url,
            telephone: row.telephone ?? null,
            jours_actifs_total: row.jours_actifs_total ?? 0,
            is_fake: row.is_fake ?? false,
            jours: {},
            obj_global: {
              feuille_id:    row.obj_global_feuille_id   ?? null,
              feuille_titre: row.obj_global_feuille_titre ?? null,
              ref_exercice:  row.obj_global_ref_exercice  ?? null,
              note:          row.obj_global_note           ?? null,
              pdf_url:       row.obj_global_pdf_url        ?? null,
            },
          })
        }
        map.get(row.user_id)!.jours[row.jour_semaine] = {
          indice:        Number(row.indice),
          feuille_id:    row.feuille_id,
          feuille_titre: row.feuille_titre,
          ref_exercice:  row.ref_exercice,
          note:          row.note,
        }
      }
      setRows(Array.from(map.values()))
    }
    setLoading(false)
  }, [])

  useEffect(() => { charger() }, [charger])

  // Tri séparé : user connecté en tête, puis alpha — recalculé quand userId est résolu
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.user_id === userId) return -1
      if (b.user_id === userId) return 1
      return (a.pseudo ?? '').localeCompare(b.pseudo ?? '', 'fr')
    })
  }, [rows, userId])

  const displayedRows = useMemo(() => {
    return masquerFakes
      ? sortedRows.filter((r) => !r.is_fake)
      : sortedRows
  }, [sortedRows, masquerFakes])

  function ouvrirWhatsApp(userRow: UserRegularite) {
    const telephone = userRow.telephone
    const obj = userRow.obj_global
    if (!telephone || !obj.feuille_titre) return

    const numero = telephone
      .replace(/[\s\-\.]/g, '')
      .replace(/^0/, '33')

    const lignes = [
      `Salut ${userRow.pseudo} !`,
      '',
      `On se fait un entrainement ce soir ?`,
      `Sur la feuille ${obj.feuille_titre}${obj.ref_exercice != null ? ` — exercice ${obj.ref_exercice}` : ''}`,
    ]
    if (obj.note) lignes.push(`Note : ${obj.note}`)
    if (obj.pdf_url) lignes.push(obj.pdf_url)

    const message = lignes.join('\n')
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(message)}`, '_blank')
  }

  function handleCellClick(userRow: UserRegularite, jourSemaine: number) {
    if (userRow.user_id !== userId) return
    const jour = userRow.jours[jourSemaine]
    setModal({
      userId: userRow.user_id,
      jourSemaine,
      jourNom: JOURS_LONG[jourSemaine],
      feuille_id:  jour?.feuille_id  ?? null,
      ref_exercice: jour?.ref_exercice ?? null,
      note:         jour?.note         ?? null,
    })
  }

  function handleGlobalClick(userRow: UserRegularite) {
    if (userRow.user_id !== userId) return
    setModalGlobal({
      userId: userRow.user_id,
      obj: userRow.obj_global ?? EMPTY_OBJ_GLOBAL,
    })
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-12 text-center">Chargement…</div>
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-40">
                Élève
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Global
              </th>
              {JOURS_COURT.map((j) => (
                <th key={j} className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {j}
                </th>
              ))}
              <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide border-l border-gray-200">
                Objectif
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((userRow) => {
              const isOwn = userRow.user_id === userId
              const obj   = userRow.obj_global ?? EMPTY_OBJ_GLOBAL
              const hasObj = !!obj.feuille_titre

              return (
                <tr key={userRow.user_id} className="border-b border-gray-100 last:border-0">
                  {/* Élève */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {userRow.avatar_url ? (
                        <img
                          src={userRow.avatar_url}
                          alt={userRow.pseudo}
                          width={24}
                          height={24}
                          className="rounded-full object-cover flex-shrink-0"
                          style={{ width: 24, height: 24 }}
                        />
                      ) : (
                        <div
                          className="rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-xs flex-shrink-0"
                          style={{ width: 24, height: 24 }}
                        >
                          {userRow.pseudo?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="font-medium text-gray-900 truncate max-w-[96px]">
                        {userRow.pseudo}
                      </span>
                    </div>
                  </td>

                  {/* Global */}
                  <td className="px-3 py-3 text-center">
                    <span className={`text-sm font-bold ${globalColor(userRow.jours_actifs_total)}`}>
                      {userRow.jours_actifs_total}
                    </span>
                    <span className="text-sm text-gray-400">/90</span>
                  </td>

                  {/* Jours */}
                  {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                    const jour   = userRow.jours[j]
                    const indice = jour?.indice ?? 0
                    const pct    = Math.round(indice * 100)

                    return (
                      <td
                        key={j}
                        onClick={() => handleCellClick(userRow, j)}
                        className={`px-2 py-2 align-top text-center ${isOwn ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      >
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${indiceStyle(indice)}`}>
                          {pct}%
                        </span>
                        {jour?.feuille_titre && (
                          <div className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {jour.feuille_titre}
                            {jour.ref_exercice != null ? ` · Ex.${jour.ref_exercice}` : ''}
                          </div>
                        )}
                        {jour?.note && (
                          <div className="text-xs text-gray-400 italic mt-0.5 leading-tight">
                            {jour.note.length > 40 ? jour.note.slice(0, 40) + '…' : jour.note}
                          </div>
                        )}
                      </td>
                    )
                  })}

                  {/* Objectif global */}
                  <td
                    onClick={() => handleGlobalClick(userRow)}
                    className={`px-3 py-2 align-top border-l border-gray-200 ${isOwn ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  >
                    {hasObj ? (
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-700 font-medium leading-tight">
                            {obj.feuille_titre}
                            {obj.ref_exercice != null ? ` · Ex.${obj.ref_exercice}` : ''}
                          </div>
                          {obj.note && (
                            <div className="text-xs text-gray-400 italic mt-0.5 leading-tight">
                              {obj.note.length > 40 ? obj.note.slice(0, 40) + '…' : obj.note}
                            </div>
                          )}
                        </div>
                        {isAdmin && userRow.telephone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); ouvrirWhatsApp(userRow) }}
                            title="Envoyer sur WhatsApp"
                            className="flex-shrink-0 hover:opacity-75 transition-opacity"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : (
                      isOwn && (
                        <span className="text-gray-300 flex justify-center">
                          <PencilIcon />
                        </span>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <ObjectifModal
          userId={modal.userId}
          jourSemaine={modal.jourSemaine}
          jourNom={modal.jourNom}
          initialFeuilleId={modal.feuille_id}
          initialRefExercice={modal.ref_exercice}
          initialNote={modal.note}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); charger() }}
        />
      )}

      {modalGlobal && (
        <ObjectifGlobalModal
          userId={modalGlobal.userId}
          initialFeuilleId={modalGlobal.obj.feuille_id}
          initialRefExercice={modalGlobal.obj.ref_exercice}
          initialNote={modalGlobal.obj.note}
          onClose={() => setModalGlobal(null)}
          onSave={() => { setModalGlobal(null); charger() }}
        />
      )}
    </>
  )
}
