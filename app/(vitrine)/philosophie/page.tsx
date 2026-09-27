import SectionArticles, { sectionMetadata } from '../SectionArticles'

export function generateMetadata() {
  return sectionMetadata('philosophie', 'TODO : description de la page Philosophie.')
}

export default function PhilosophiePage() {
  return <SectionArticles section="philosophie" />
}
