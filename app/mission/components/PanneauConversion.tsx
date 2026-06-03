'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface PanneauConversionProps {
  soldeCredits: number
  pixelsConvertibles: number
  tauxActuel: number
  tauxId: string
  userId: string
}

export function PanneauConversion({
  soldeCredits,
  pixelsConvertibles,
  tauxActuel,
  tauxId,
  userId,
}: PanneauConversionProps) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const creditsGagnables = pixelsConvertibles * tauxActuel

  async function handleConversion() {
    if (pixelsConvertibles <= 0) return
    setLoading(true)
    setErreur(null)

    const { error } = await supabase.from('credit_transaction').insert({
      user_id: userId,
      type: 'conversion',
      montant: creditsGagnables,
      taux_conversion_id: tauxId,
    })

    if (error) {
      setErreur('Une erreur est survenue. Réessaie.')
    } else {
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780' }}>
          Votre portefeuille
        </p>
        <div style={{ background: '#EDEAE3', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780' }}>
            Tokens disponibles
          </p>
          <p style={{ fontSize: 20, fontWeight: 500, color: '#1a1a1a' }}>
            {soldeCredits.toLocaleString('fr-FR')} T
          </p>
          <p style={{ fontSize: 12, color: '#888780' }}>
            <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{pixelsConvertibles}</span>{' '}
            pixels convertissables
          </p>
        </div>

        {creditsGagnables > 0 && (
          <p style={{ fontSize: 12, color: '#888780', textAlign: 'center' }}>
            Tu obtiendrais{' '}
            <span style={{ color: '#1D9E75', fontWeight: 500 }}>
              +{creditsGagnables.toLocaleString('fr-FR')} T
            </span>
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {erreur && (
          <p style={{ fontSize: 12, color: '#E24B4A', textAlign: 'center' }}>{erreur}</p>
        )}

        <button
          onClick={handleConversion}
          disabled={loading || pixelsConvertibles <= 0}
          style={{
            width: '100%',
            padding: '10px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            opacity: loading || pixelsConvertibles <= 0 ? 0.4 : 1,
          }}
        >
          {loading ? 'Conversion…' : 'Convertir mes pixels'}
        </button>

        <p style={{ fontSize: 11, color: '#b0ada6', textAlign: 'center', lineHeight: 1.5 }}>
          Taux actuel : 1 px → {tauxActuel} T
          <br />
          {pixelsConvertibles} px disponibles
        </p>
      </div>
    </div>
  )
}
