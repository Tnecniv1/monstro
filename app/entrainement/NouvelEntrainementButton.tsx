'use client'

export default function NouvelEntrainementButton({
  disabled,
  onOpen,
}: {
  disabled: boolean
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      disabled={disabled}
      title={
        disabled
          ? "Terminez votre entraînement en cours avant d'en démarrer un nouveau"
          : undefined
      }
      className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      + Faire un entraînement
    </button>
  )
}
