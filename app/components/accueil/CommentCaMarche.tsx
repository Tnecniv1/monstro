import EscalierPixels from './EscalierPixels'

// Section « Comment ça marche » de la page d'accueil (visiteur), sous le hero.
// Rangées en zigzag sur ordinateur (visuel à gauche pour 1 et 3, à droite pour
// 2 et 4), visuel au-dessus du texte sur mobile. Visuels en rectangles, dans
// le style des tuiles de la grille de monstres (mêmes fonds pastel, rounded-2xl).

const NBSP = String.fromCharCode(0xa0)

const RANGEES: { phrase: string; apprendrez: string; visuel: React.ReactNode }[] = [
  {
    phrase: 'Le point de départ est la résolution du problème numéro #1',
    apprendrez:
      "Vous apprendrez à structurer un entraînement, c'est-à-dire à résoudre un problème en partant de zéro.",
    visuel: (
      <Tuile fond="bg-violet-100" className="flex flex-col justify-center gap-2 px-6 py-5">
        <p className="text-xs font-medium text-accent">Problème #1</p>
        <p className="font-serif text-lg leading-snug text-text-primary">
          Combien de temps met la lumière pour voyager du Soleil jusqu&apos;à la Terre{NBSP}?
        </p>
      </Tuile>
    ),
  },
  {
    phrase: 'Les étapes suivantes sont de résoudre les 4999 autres problèmes',
    apprendrez: 'Vous apprendrez à faire les bonnes actions, avec régularité, pendant suffisamment longtemps.',
    visuel: (
      <Tuile fond="bg-white border border-gray-200" className="p-5">
        <EscalierPixels remplies={4} anime />
      </Tuile>
    ),
  },
  {
    phrase: 'Si tout se passe bien, alors beaucoup de difficultés seront rencontrées',
    apprendrez:
      "Vous apprendrez à bloquer activement sur les problèmes, en cherchant à faire un maximum d'erreurs, car vous comprendrez qu'elles sont de l'or pour se poser les bonnes questions.",
    visuel: (
      <Tuile fond="bg-green-100" className="flex flex-col justify-center gap-2 p-3 text-[13px] leading-snug text-text-primary">
        <p className="max-w-[92%] self-start rounded-xl rounded-bl-sm bg-white px-2.5 py-1.5">
          J&apos;ai trouvé 0,5{NBSP}seconde. C&apos;est possible{NBSP}?
        </p>
        <p className="max-w-[92%] self-end rounded-xl rounded-br-sm bg-violet-100 px-2.5 py-1.5">
          On sait que la lumière voyage à 300{NBSP}000 km/s. Qu&apos;est-ce que cela implique pour ton résultat{NBSP}?
        </p>
        <p className="max-w-[92%] self-start rounded-xl rounded-bl-sm bg-white px-2.5 py-1.5">
          Que le Soleil serait à 150{NBSP}000 km… plus proche que la Lune, c&apos;est faux{NBSP}!
        </p>
      </Tuile>
    ),
  },
  {
    phrase: 'Le point de victoire est la réussite des 5000 problèmes du parcours',
    apprendrez: 'Vous aurez gagné une preuve de votre intelligence, et de votre capacité à réussir des défis difficiles.',
    visuel: (
      <Tuile fond="bg-white border border-gray-200" className="p-5">
        <EscalierPixels remplies={8} />
      </Tuile>
    ),
  },
]

function Tuile({ fond, className, children }: { fond: string; className: string; children: React.ReactNode }) {
  return (
    <div className={`aspect-[3/2] w-full max-w-[360px] overflow-hidden rounded-2xl ${fond} ${className}`}>
      {children}
    </div>
  )
}

export default function CommentCaMarche() {
  return (
    <section id="comment-ca-marche" className="mx-auto w-full max-w-3xl scroll-mt-6 space-y-16 pt-16 pb-8 md:pt-24">
      <p className="mx-auto max-w-[720px] text-center font-serif text-2xl leading-snug text-text-primary md:text-3xl">
        Monstro est une bibliothèque mathématique, qui vous dit précisément quoi faire pour progresser, et comment le
        faire.
      </p>

      <ol className="space-y-14 md:space-y-20">
        {RANGEES.map(({ phrase, apprendrez, visuel }, i) => {
          const visuelADroite = i % 2 === 1
          return (
            <li key={phrase} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
              <div className={`flex justify-center ${visuelADroite ? 'md:order-2 md:justify-start' : 'md:justify-end'}`}>
                {visuel}
              </div>
              <div className={`mx-auto max-w-sm space-y-2 md:mx-0 ${visuelADroite ? 'md:order-1 md:justify-self-end' : ''}`}>
                <p className="text-xs font-semibold text-accent">{i + 1}</p>
                <p className="font-semibold text-text-primary">{phrase}</p>
                <p className="text-sm leading-relaxed text-text-secondary">{apprendrez}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
