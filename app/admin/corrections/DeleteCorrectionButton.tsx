'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteCorrectionButton({ correctionId }: { correctionId: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleDelete() {
    if (!confirm('Supprimer cette correction ?')) return
    const { error } = await supabase.from('correction').delete().eq('id', correctionId)
    if (error) {
      alert('Erreur : ' + error.message)
    } else {
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="text-gray-300 hover:text-red-500 transition-colors text-sm"
    >
      ×
    </button>
  )
}
