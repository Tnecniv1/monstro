import { redirect } from 'next/navigation'

// Le formulaire de connexion/inscription vit désormais sur la page d'accueil.
// Route conservée pour les anciens liens et les redirect('/login') existants.
export default function LoginPage() {
  redirect('/')
}
