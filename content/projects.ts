import { cache } from 'react'

export type ProjectMetadata = {
  title: string
  description: string
  slug: string
  priority: number
  date: string
  tags: string[]
  imageUrl: string
  notionPage: string
}

export const slugToProject = cache((slug: string) => {
  return ProjectsList.find((project) => project.slug === slug)
})

export const ProjectsList = [
  {
    title: '🏔️ Project Mountaintop',
    description:
      'Unity-based Rhythm Game with Custom-Built Arcade Controllers, Soundtrack, and MIDI System',
    slug: 'project-mountaintop',
    priority: 1,
    date: '2023',
    tags: ['Unity', 'C#', 'Game', 'Arduino', 'MIDI'],
    imageUrl: '/projects/promo.webp',
    notionPage: '3bd8c063f9694b44a838165a9cce8f1c',
  },
  {
    title: '🧙‍♂️ Barcode Game',
    description:
      'Unity/Arduino Alt Control game that makes you a barcode wizard',
    slug: 'barcode-game',
    priority: 2,
    date: '2023',
    tags: ['Unity', 'Arduino', 'C#', 'Game'],
    imageUrl: '/projects/barcode.jpg',
    notionPage: '4859c78e356b48a295d5e3578c1fc6a5',
  },
] as ProjectMetadata[]
