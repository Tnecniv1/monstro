/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // satori charge ses fichiers WebAssembly depuis son propre dossier : ne pas l'intégrer au bundle serveur
    serverComponentsExternalPackages: ['satori'],
    // instrumentation.ts : réglages globaux au démarrage du serveur (sharp)
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        // Illustrations de la page d'accueil : fichiers statiques, à renommer s'ils changent.
        // Cache long, repris par l'optimiseur next/image : sans lui, chaque variante est
        // ré-optimisée toutes les 60 s au gré des visites.
        source: '/images/:fichier(gif_[3457]\\.webp)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
