import Link from 'next/link'

interface HeaderProps {
  pseudo: string
  isAdmin?: boolean
}

export default function Header({ pseudo, isAdmin }: HeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">Bonjour</p>
        <p className="text-lg font-semibold text-gray-900">{pseudo}</p>
      </div>
      {isAdmin && (
        <Link
          href="/admin"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Admin
        </Link>
      )}
    </div>
  )
}
