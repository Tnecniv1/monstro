import AvecBarreOnglets from '@/app/components/navigation/AvecBarreOnglets'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AvecBarreOnglets>{children}</AvecBarreOnglets>
}
