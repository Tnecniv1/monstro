// Squelette affiché pendant les appels à get_regularite_admin() et get_parcours_admin().
export default function SuiviLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <span className="text-sm text-text-muted">← Forum</span>

        <h1 className="text-2xl font-bold text-text-primary">Suivi</h1>

        <div className="inline-flex gap-0.5 rounded-xl bg-surface-2 p-1">
          <span className="rounded-lg bg-surface px-4 py-1.5 text-sm font-semibold text-text-primary shadow-sm">Régularité</span>
          <span className="rounded-lg px-4 py-1.5 text-sm font-semibold text-text-muted">Parcours</span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[
            { titre: 'Gagnants', order: 'order-2 md:order-1' },
            { titre: 'Perdants', order: 'order-1 md:order-2' },
          ].map(({ titre, order }) => (
            <section key={titre} className={`rounded-2xl border border-border bg-surface ${order}`}>
              <h2 className="px-4 py-3 border-b border-border font-semibold text-text-primary">{titre}</h2>
              <ul className="divide-y divide-border animate-pulse">
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="h-4 flex-1 rounded bg-surface-2" />
                    <span className="h-4 w-12 rounded bg-surface-2" />
                    <span className="h-4 w-20 rounded bg-surface-2" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
