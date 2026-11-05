// Accolades: one recognition shown as a card (a quote from the record, then the coverage as a list of link previews; a post
// quotes the record in full with `:::quote`). Rendered by components/accolade/Accolade.tsx on the About page and by `::accolade{id=...}` in posts.
// Headlines are copied as published; Polish ones carry an English gloss. Every link was opened on 2026-11-02 (HuffPost on 2026-11-04); TV segments are
// Internet Archive TV News captures, timestamped to the segment (`#start/S/end/E`, seconds into the recording).

export type AccoladeSourceKind = 'record' | 'tv' | 'news' | 'program'

export type AccoladeSource = {
  id: string
  outlet: string
  /** Headline or programme title as published. */
  title: string
  /** English gloss of a non-English title. */
  titleEn?: string
  lang?: 'pl'
  url: string
  /** ISO date, or YYYY-MM when only the month is known. */
  date: string
  kind: AccoladeSourceKind
  /** At most one short line: what the item is, when the title does not say it. */
  note?: string
  /** A 16:9 thumbnail in public/media/about/coverage/: the outlet's own share image, or a frame of the aired segment. */
  image?: string
}

export type Accolade = {
  id: string
  /** Short label above the title (the programme or body). */
  eyebrow: string
  title: string
  year: string
  quote: { text: string; by: string; role: string; url: string; cite: string }
  summary: string
  /** Coverage, most prominent institution first. */
  sources: readonly AccoladeSource[]
  /** Slug of the post that tells the story. */
  postSlug?: string
}

const IA = (id: string, start: number, end: number) =>
  `https://archive.org/details/${id}#start/${start}/end/${end}`

export const accolades: readonly Accolade[] = [
  {
    id: 'ssep-2014',
    eyebrow: 'Student Spaceflight Experiments Program, Mission 4',
    title: 'Tribute in the Congressional Record',
    year: '2014',
    quote: {
      text: 'Mr. Speaker, it is an honor to recognize Michal Bodzianowski for his achievement of winning the "Student Spaceflight Experiments Program" and successfully launching his experiment into space.',
      by: 'Rep. Mike Coffman',
      role: 'of Colorado, in the House of Representatives',
      url: 'https://www.govinfo.gov/link/crec/160/e/1105',
      cite: 'Congressional Record, Vol. 160, p. E1105, July 3, 2014',
    },
    summary:
      'At eleven, his question of whether beer can be brewed in microgravity was picked from 744 proposals for the International Space Station. It flew on Orbital Sciences’ Cygnus in January 2014 and came home in March.',
    postSlug: 'beer-in-space',
    sources: [
      {
        id: 'nbc-news',
        outlet: 'NBC News',
        title: "11-year-old's beer brewery to be sent to space station",
        url: 'https://www.nbcnews.com/sciencemain/11-year-olds-beer-brewery-be-sent-space-station-8c11375439',
        date: '2013-10-11',
        kind: 'news',
        image: '/media/about/coverage/nbc-news.webp',
      },
      {
        id: 'abc-news',
        outlet: 'ABC News',
        title: 'Sixth Grader Wins Approval to Brew Beer in Space',
        url: 'https://abcnews.go.com/blogs/headlines/2013/10/sixth-grader-wins-approval-to-brew-beer-in-space/',
        date: '2013-10',
        kind: 'news',
        // its share image is the same family photo as NBC's, so the row shows the outlet's name instead
      },
      {
        id: 'fox-news-tv',
        outlet: "Fox News, America's Newsroom",
        title: 'Morning news segment',
        url: IA('FOXNEWSW_20131008_130000_Americas_Newsroom', 6169, 6204),
        date: '2013-10-08',
        kind: 'tv',
        image: '/media/about/coverage/fox-news-tv.webp',
      },
      {
        id: 'al-jazeera-america',
        outlet: 'Al Jazeera America',
        title: 'Live interview',
        url: IA('ALJAZAM_20131010_030000_News', 2405, 3010),
        date: '2013-10-09',
        kind: 'tv',
        image: '/media/about/coverage/al-jazeera-america.webp',
      },
      {
        id: 'tonight-show',
        outlet: 'The Tonight Show with Jay Leno',
        title: 'Monologue, October 10, 2013',
        url: IA('KNTV_20131011_063500_The_Tonight_Show_With_Jay_Leno', 280, 350),
        date: '2013-10-10',
        kind: 'tv',
        image: '/media/about/coverage/tonight-show.webp',
        note: 'A joke about the experiment in the opening monologue.',
      },
      {
        id: 'fox-news',
        outlet: 'Fox News',
        title:
          "Colorado sixth-grader's beer-making experiment headed for space",
        url: 'https://www.foxnews.com/science/colorado-sixth-graders-beer-making-experiment-headed-for-space',
        date: '2013-10-08',
        kind: 'news',
        image: '/media/about/coverage/fox-news.webp',
      },
      {
        id: 'the-list',
        outlet: 'The List',
        title: 'Top of the List, number 5: Little Boy Brew',
        url: IA(
          'WMAR_20131008_223000_ABC_World_News_With_Diane_Sawyer',
          1744,
          1779
        ),
        date: '2013-10-08',
        kind: 'tv',
        image: '/media/about/coverage/the-list.webp',
        note: 'The syndicated countdown show, captured as it aired on WMAR Baltimore.',
      },
      {
        id: 'csmonitor',
        outlet: 'The Christian Science Monitor',
        title: 'Why a sixth-grader wants to brew beer in space',
        url: 'https://www.csmonitor.com/Science/2013/1008/Why-a-sixth-grader-wants-to-brew-beer-in-space',
        date: '2013-10-08',
        kind: 'news',
        image: '/media/about/coverage/csmonitor.webp',
      },
      {
        id: 'huffpost-live',
        outlet: 'HuffPost',
        title: 'Michal Bodzianowski, Sixth Grader, Makes A Great Case For Brewing Beer In Space (VIDEO)',
        url: 'https://www.huffpost.com/entry/michal-bodzianowski-brewing-beer-in-space_n_4071843',
        date: '2013-10-09',
        kind: 'news',
        note: 'The write-up of his HuffPost Live interview, "Kid Wins Approval To Test Microbrewing In Space".',
        // no image: the HuffPost Live player is gone and the page's share image is HuffPost's default, so the row shows the name
      },
      {
        id: 'wyborcza-2013',
        outlet: 'Gazeta Wyborcza',
        title: '11-letni Michał pomoże astronautom warzyć piwo w kosmosie',
        titleEn: '11-year-old Michał will help astronauts brew beer in space',
        lang: 'pl',
        url: 'https://wyborcza.pl/7,75400,14784892,11-letni-michal-pomoze-astronautom-warzyc-piwo-w-kosmosie.html',
        date: '2013-10-15',
        kind: 'news',
        image: '/media/about/coverage/wyborcza.webp',
      },
      {
        id: 'wyborcza-2014',
        outlet: 'Gazeta Wyborcza',
        title:
          'Astronauci dostali wreszcie prezenty na gwiazdkę. A także browar, który wymyślił 11-letni Michał Bodzianowski',
        titleEn:
          'The astronauts finally got their Christmas presents, and the brewery an 11-year-old designed',
        lang: 'pl',
        url: 'https://wyborcza.pl/7,75400,15262254,astronauci-dostali-wreszcie-prezenty-na-gwiazdke-a-takze-browar.html',
        date: '2014-01-12',
        kind: 'news',
      },
      {
        id: 'space-com',
        outlet: 'Space.com',
        title:
          "Beer In Space: 11-Year-Old's Tiny Brewery Will Fly to Space Station",
        url: 'https://www.space.com/23141-space-beer-student-space-station-experiment.html',
        date: '2013-10-10',
        kind: 'news',
        image: '/media/about/coverage/space-com.webp',
      },
      {
        id: 'ibtimes',
        outlet: 'International Business Times',
        title:
          'Michal Bodzianowski, 11-Year-Old Colorado Boy, Will Brew Beer In Space',
        url: 'https://www.ibtimes.com/michal-bodzianowski-11-year-old-colorado-boy-will-brew-beer-space-photo-1416866',
        date: '2013-10-08',
        kind: 'news',
        // its share image is the KDVR frame Fox News uses, so the row shows the outlet's name instead
      },
      {
        id: 'the-register',
        outlet: 'The Register',
        title: 'Brew me up, bro: 11-year-old plans to make BEER IN SPACE',
        url: 'https://www.theregister.com/2013/10/08/brew_me_up_scotty_says_11_year_old_set_to_make_beer_in_space/',
        date: '2013-10-08',
        kind: 'news',
        image: '/media/about/coverage/the-register.webp',
      },
      {
        id: 'grist',
        outlet: 'Grist',
        title:
          '11-year-old figures out how to brew beer for astronauts in space',
        url: 'https://grist.org/food/11-year-old-figures-out-how-to-brew-beer-for-astronauts-in-space/',
        date: '2013-10-09',
        kind: 'news',
        image: '/media/about/coverage/grist.webp',
      },
      {
        id: 'abc7-kgo',
        outlet: 'ABC7 KGO, San Francisco',
        title: 'Afternoon news segment',
        url: IA('KGO_20131008_230000_ABC7_News_400PM', 1061, 1128),
        date: '2013-10-08',
        kind: 'tv',
        image: '/media/about/coverage/abc7-kgo.webp',
      },
      {
        id: 'kron-4',
        outlet: 'KRON 4, San Francisco',
        title: 'Morning news segment',
        url: IA('KRON_20131008_110000_KRON_4_Early_News', 2711, 2830),
        date: '2013-10-08',
        kind: 'tv',
        image: '/media/about/coverage/kron-4.webp',
      },
      {
        id: 'wjla',
        outlet: 'ABC7 WJLA, Washington',
        title: 'Good Morning Washington segment',
        url: IA(
          'WJLA_20131008_090000_Good_Morning_Washington_at_500',
          3520,
          3555
        ),
        date: '2013-10-08',
        kind: 'tv',
        image: '/media/about/coverage/wjla.webp',
      },
      {
        id: 'ssep',
        outlet: 'Student Spaceflight Experiments Program',
        title: '"My Greatest Moment of My Life So Far"',
        url: 'http://ssep.ncesse.org/2014/03/my-greatest-moment-of-my-life-so-far-michal-bodzianowski-ssep-mission-4-student-researcher-highlands-ranch-colorado/',
        date: '2014-03',
        kind: 'program',
        image: '/media/about/coverage/ssep.webp',
        note: 'His own account of the launch, published by the programme.',
      },
    ],
  },
]

export const accoladeById = (id: string) => accolades.find((a) => a.id === id)
