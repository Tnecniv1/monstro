import Image from 'next/image'
import Link from 'next/link'
import AuthForm from './AuthForm'

// Grille 3x3 : les GIF animés passent par un <img> natif (next/image n'en
// garderait que la première frame), les PNG statiques 1500px par next/image
// pour le redimensionnement/la compression.
const TILES: { src: string; bg: string }[] = [
  { src: '/images/gif_1.gif', bg: 'bg-white' },
  { src: '/images/gif_3.png', bg: 'bg-violet-100' },
  { src: '/images/gif_2.gif', bg: 'bg-orange-100' },
  { src: '/images/gif_4.png', bg: 'bg-green-100' },
  { src: '/images/logo.png', bg: 'bg-white' },
  { src: '/images/gif_5.png', bg: 'bg-gray-100' },
  { src: '/images/gif_6.gif', bg: 'bg-orange-100' },
  { src: '/images/gif_7.png', bg: 'bg-green-100' },
  { src: '/images/gif_8.gif', bg: 'bg-violet-100' },
]

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-bg flex items-center px-4 py-10 md:px-8">
      <div className="w-full max-w-7xl mx-auto grid items-center gap-10 md:grid-cols-[auto_minmax(0,42rem)] md:justify-center">
        <section className="w-full max-w-md mx-auto md:max-w-none md:mx-0 space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium text-accent">Monstro, la promesse de réussite.</p>
            <h1 className="font-serif font-bold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-text-primary">
              Apprendre
              <br />
              à&nbsp;raisonner.
            </h1>
          </div>
          <div className="max-w-sm">
            <AuthForm />
          </div>
        </section>

        {/* Illustrations décoratives */}
        <section aria-hidden="true" className="grid grid-cols-3 gap-2 sm:gap-3">
          {TILES.map(({ src, bg }) => (
            <div key={src} className={`relative aspect-square rounded-2xl overflow-hidden ${bg}`}>
              {src.endsWith('.gif') ? (
                <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain p-2" />
              ) : (
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 200px, 33vw"
                  className="object-contain p-2"
                />
              )}
            </div>
          ))}
        </section>
      </div>

      <footer className="absolute inset-x-0 bottom-3 flex justify-center gap-2 text-xs text-gray-400">
        <Link href="/mentions-legales" className="hover:text-gray-600 transition-colors">
          Mentions légales
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="hover:text-gray-600 transition-colors">
          Confidentialité
        </Link>
      </footer>
    </main>
  )
}
