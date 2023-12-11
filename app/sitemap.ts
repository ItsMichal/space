import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://michal.us',
      lastModified: new Date(),
    },
    {
      url: 'https://michal.us/projects',
      lastModified: new Date(),
    },
    {
      url: 'https://michal.us/projects/jia-webapp',
      lastModified: new Date(),
    },
    {
      url: 'https://michal.us/projects/isat-dashboard',
      lastModified: new Date(),
    },
    {
      url: 'https://michal.us/projects/office-wizards-barcode-game',
      lastModified: new Date(),
    },
    {
      url: 'https://michal.us/projects/project-mountaintop',
      lastModified: new Date(),
    },
  ]
}
