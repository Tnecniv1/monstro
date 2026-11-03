'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Avatar from '@/app/components/Avatar'
import { formatDuree } from '@/lib/duree'
import {
  ordinal,
  periodeSemaine,
  type Laureat,
  type LigneClassement,
  type NomVue,
  type SemaineParis,
  type VueClassement,
} from '@/lib/classement'

interface Props {
  vue: NomVue
  vues: Record<NomVue, VueClassement>
  etudiants: Laureat[]
  semaine: SemaineParis
  userId: string
}

function pseudoDe(l: { pseudo: string | null }): string {
  return l.pseudo ?? '—'
}

function joursActifs(n: number): string {
  return n === 1 ? '1 jour actif' : `${n} jours actifs`
}

function finDeSemaine(joursRestants: number): string {
  if (joursRestants === 0) return "Se termine aujourd'hui"
  return joursRestants === 1 ? 'Se termine dans 1 jour' : `Se termine dans ${joursRestants} jours`
}

export default function ClassementClient({ vue, vues, etudiants, semaine, userId }: Props) {
  const donnees = vues[vue]

  return (
    <div className="space-y-8">
      <EnTete vue={vue} />

      {vue === 'semaine' ? (
        <>
          {etudiants.length > 0 && <CarteEtudiants etudiants={etudiants} />}
          <LigneTitre
            gauche={`Semaine ${periodeSemaine(semaine.debut)}`}
            droite={finDeSemaine(semaine.joursRestants)}
          />
        </>
      ) : (
        <LigneTitre gauche="Depuis le début" droite="Total des pixels gagnés" />
      )}

      <Podium
        lignes={donnees.podium}
        vide={
          vue === 'semaine'
            ? "Personne n'a encore gagné de pixel cette semaine."
            : "Personne n'a encore gagné de pixel."
        }
      />

      {donnees.liste.length > 0 && <Liste lignes={donnees.liste} userId={userId} />}

      {donnees.moi && (
        <CarteToi
          gauche={`Tu es ${ordinal(donnees.moi.rang)} ${vue === 'semaine' ? 'cette semaine' : 'au total'}.`}
          droite={donnees.message}
        />
      )}
    </div>
  )
}

// ── En-tête : retour, titre, bascule Cette semaine | Global ──────────────────

function EnTete({ vue }: { vue: NomVue }) {
  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
        ← Monstro
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Classement</h1>
        <div className="inline-flex rounded-full bg-track p-1">
          <BoutonVue href="/classement" actif={vue === 'semaine'}>Cette semaine</BoutonVue>
          <BoutonVue href="/classement?vue=global" actif={vue === 'global'}>Global</BoutonVue>
        </div>
      </div>
    </div>
  )
}

function BoutonVue({ href, actif, children }: { href: string; actif: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={actif ? 'page' : undefined}
      className={`flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold transition-colors ${
        actif ? 'bg-surface text-text-primary' : 'bg-transparent text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </Link>
  )
}

// ── Étudiant(s) de la semaine (semaine précédente) ───────────────────────────

function CarteEtudiants({ etudiants }: { etudiants: Laureat[] }) {
  const plusieurs = etudiants.length > 1
  const periode = `semaine ${periodeSemaine(etudiants[0].semaine_debut)}`

  return (
    <section className="rounded-[22px] bg-accent-soft p-6 space-y-4">
      <p className="text-xs font-bold tracking-[0.04em] text-accent">
        {plusieurs ? 'ÉTUDIANTS DE LA SEMAINE' : 'ÉTUDIANT DE LA SEMAINE'}
      </p>
      {etudiants.map((e) => (
        <div key={e.user_id} className="flex items-center gap-4 min-w-0">
          <Avatar url={e.avatar_url} pseudo={pseudoDe(e)} size={72} className="shrink-0 ring-[3px] ring-accent" />
          <div className="min-w-0">
            <p className="truncate text-[28px] font-extrabold leading-tight text-text-primary">{pseudoDe(e)}</p>
            <p className="text-sm text-text-secondary">
              {formatDuree(e.minutes)} de travail · {joursActifs(e.jours_actifs)}
              {!plusieurs && ` · ${periode}`}
            </p>
          </div>
        </div>
      ))}
      {plusieurs && <p className="text-sm text-text-secondary">{periode.charAt(0).toUpperCase() + periode.slice(1)}</p>}
    </section>
  )
}

// ── Ligne de titre de la vue ──────────────────────────────────────────────────

function LigneTitre({ gauche, droite }: { gauche: string; droite: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-base font-bold text-text-primary">{gauche}</h2>
      <p className="text-xs font-bold text-text-secondary">{droite}</p>
    </div>
  )
}

// ── Podium ────────────────────────────────────────────────────────────────────

// Ordre visuel : 2e – 1er – 3e (index dans le podium, déjà trié par rang).
const ORDRE_PODIUM = [1, 0, 2]

// Style selon le rang renvoyé (1 à 3) : des ex-aequo ont le même style.
const STYLE_RANG: Record<number, { avatar: number; socle: number }> = {
  1: { avatar: 88, socle: 96 },
  2: { avatar: 72, socle: 72 },
  3: { avatar: 64, socle: 56 },
}

function Podium({ lignes, vide }: { lignes: LigneClassement[]; vide: string }) {
  if (lignes.length === 0) {
    return <p className="py-8 text-center text-sm text-text-secondary">{vide}</p>
  }

  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {ORDRE_PODIUM.map((i) => {
        const l = lignes[i]
        if (!l) return <div key={`vide-${i}`} />
        const premier = l.rang === 1
        const style = STYLE_RANG[Math.min(Math.max(l.rang, 1), 3)]
        return (
          <div key={l.user_id} className="flex min-w-0 flex-col items-center gap-2">
            <Avatar
              url={l.avatar_url}
              pseudo={pseudoDe(l)}
              size={style.avatar}
              className={premier ? 'ring-[3px] ring-accent' : ''}
            />
            <p className="w-full truncate text-center text-sm font-bold text-text-primary">{pseudoDe(l)}</p>
            <p className="text-xs font-bold text-text-secondary">
              {l.pixels.toLocaleString('fr-FR')} px · {l.jours_actifs} j
            </p>
            <div
              className={`flex w-full items-center justify-center rounded-t-[14px] text-[26px] font-extrabold ${
                premier ? 'bg-accent text-white' : 'bg-track text-text-primary'
              }`}
              style={{ height: style.socle }}
            >
              {l.rang}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Liste ─────────────────────────────────────────────────────────────────────

function Liste({ lignes, userId }: { lignes: LigneClassement[]; userId: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface divide-y divide-border">
      {lignes.map((l) => {
        const moi = l.user_id === userId
        return (
          <div key={l.user_id} className={`flex items-center gap-3 px-4 py-3 ${moi ? 'bg-accent-soft' : ''}`}>
            <span className="w-6 shrink-0 text-right text-sm font-bold text-text-secondary">{l.rang}</span>
            <Avatar url={l.avatar_url} pseudo={pseudoDe(l)} size={32} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
              {pseudoDe(l)}
              {moi && <span className="font-normal text-text-secondary"> (toi)</span>}
            </span>
            <span className="shrink-0 text-sm font-extrabold text-text-primary">
              {l.pixels.toLocaleString('fr-FR')} px
            </span>
            <span className="w-8 shrink-0 text-right text-xs text-text-secondary">{l.jours_actifs} j</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Carte « toi » ─────────────────────────────────────────────────────────────

function CarteToi({ gauche, droite }: { gauche: string; droite: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-accent bg-surface px-4 py-3">
      <p className="text-sm font-semibold text-text-primary">{gauche}</p>
      {droite && <p className="text-sm font-bold text-accent">{droite}</p>}
    </div>
  )
}
