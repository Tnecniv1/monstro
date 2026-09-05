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
      className="w-full rounded-xl border-2 border-dashed border-border py-5 text-base font-medium text-text-muted transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      + Faire un entraînement
    </button>
  )
}
