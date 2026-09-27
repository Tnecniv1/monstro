import SectionArticles, { sectionMetadata } from '../SectionArticles'

export function generateMetadata() {
  return sectionMetadata('problemes', 'TODO : description de la page Problèmes.')
}

export default function ProblemesPage() {
  return <SectionArticles section="problemes" />
}
