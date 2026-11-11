/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // satori charge ses fichiers WebAssembly depuis son propre dossier : ne pas l'intégrer au bundle serveur
    serverComponentsExternalPackages: ['satori'],
    // instrumentation.ts : réglages globaux au démarrage du serveur (sharp)
    instrumentationHook: true,
  },
  // pdf.js (énoncé flottant, côté navigateur) cite le module Node « canvas »
  // sans s'en servir dans le navigateur : on ne l'embarque pas.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
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
  async redirects() {
    return [
      // Ancienne page Défi (QCM), supprimée : le Classement a pris sa place sur l'accueil.
      // Temporaire (307) plutôt que 308, pour ne pas figer la cible dans le cache des navigateurs.
      { source: '/apprendre', destination: '/classement', permanent: false },
    ];
  },
};

export default nextConfig;
