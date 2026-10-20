// Réglages globaux, exécutés une fois au démarrage de chaque process serveur.

export async function register() {
  // Test sur NEXT_RUNTIME sous cette forme : webpack retire l'import du bundle edge (middleware)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // sharp sert à l'optimiseur next/image et à l'image du rapport (lib/rapport/imageServeur.tsx).
    // Pas de cache libvips ni de threads parallèles : la mémoire native est rendue entre deux images
    // plutôt que gardée en cache (serveur à 512 Mo). Réglage de libvips, valable pour tout le process.
    const { default: sharp } = await import('sharp')
    sharp.cache(false)
    sharp.concurrency(1)
  }
}
