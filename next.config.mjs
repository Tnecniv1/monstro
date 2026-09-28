/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // satori charge ses fichiers WebAssembly depuis son propre dossier : ne pas l'intégrer au bundle serveur
    serverComponentsExternalPackages: ['satori'],
  },
};

export default nextConfig;
