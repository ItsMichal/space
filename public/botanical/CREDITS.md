# Botanical plates: credits

Every image here is a public-domain hand-coloured engraving (1761 to 1827). The cut-outs, colour harmonizing and compression are ours (`scripts/botanical-cutout.mjs`); the artwork is otherwise unaltered. Originals live in `assets-src/botanical/`. Machine-readable version: `credits.json`.

| File | Plant | Work | Date | Institution | License | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `dryas-*` | Dryas octopetala, mountain avens | Flora Danica, fasc. 1, tab. 31 | 1761 | Det Kgl. Bibliotek (Royal Danish Library) | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Flora_Danica_Hft_01_Tab_0031.tif) |
| `silene-*` | Silene acaulis, moss campion | Flora Danica, fasc. 1, tab. 21 | 1761 | Det Kgl. Bibliotek | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Flora_Danica_Hft_01_Tab_0021.tif) |
| `papaver-*` | Papaver radicatum, arctic poppy | Flora Danica, fasc. 1, tab. 41 | 1761 | Det Kgl. Bibliotek | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Flora_Danica_Hft_01_Tab_0041.tif) |
| `eriophorum-*` | Eriophorum angustifolium, cotton grass | Flora Danica, fasc. 25, tab. 1442 | 1813 | Det Kgl. Bibliotek | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Flora_Danica_Hft_25_Tab_1442.tif) |
| `lupinus-*` | Lupinus polyphyllus, lupine (stands in for Nootka lupine) | Edwards's Botanical Register, vol. 13, pl. 1096 (text by John Lindley) | 1827 | Biodiversity Heritage Library scan via Wikimedia Commons | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Lupinus_polyphyllus_Lindley_1827.jpg) |

Flora Danica was created by many hands between 1761 and 1883 (Oeder, Müller, Hornemann, Lange, Liebmann and the engravers and colourists of the project); the scans carry a library scale-bar stamp, which the cut-out script removes. If the site ever shows credits, "Flora Danica (Royal Danish Library) and Edwards's Botanical Register (BHL), public domain" is accurate and sufficient.

## Flower photographs (background florals, `public/botanical/photo/`)

Source photographs from Wikimedia Commons, selected only where the file's own licence is CC0, public domain or CC BY (no ShareAlike, no NonCommercial, no NoDerivatives). Changes made by us: cropped, washed toward the paper colour, desaturated, given a soft feathered alpha silhouette and compressed (`scripts/botanical-soft.mjs`). Originals' metadata is in `assets-src/botanical-photo/_meta.json`; re-fetch with `scripts/fetch-botanical-photos.py`.

| Id | Subject | Author | Licence | Source |
| --- | --- | --- | --- | --- |
| `cosmos-sky` | Cosmos against a pale sky ("Cloudy Day Cosmos", 2010) | Pink Sherbet Photography | CC BY 2.0, attribution required | [Commons](https://commons.wikimedia.org/wiki/File:Cloudy_Day_Cosmos_(5052152240).jpg) |
| `daisies-glow` | Wild daisies (2025) | Deviations with Ray (Ray Best) | CC BY 2.0, attribution required | [Commons](https://commons.wikimedia.org/wiki/File:Wild_Daisies_-_Flickr_-_Deviations_with_Ray.jpg) |
| `poppy-pale` | Papaver laestadianum, pale arctic poppies (2010) | C T Johansson | CC BY 3.0, attribution required | [Commons](https://commons.wikimedia.org/wiki/File:IMG_6281-Papaver_laestadianum.jpg) |
| `blossom-sky` | Blossom branches (originally from Unsplash, 2017) | Annie Spratt | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Magnolia_blossom_(Unsplash).jpg) |
| `cottongrass-meadow` | Cotton grass in Iceland (2008) | Axel Kristinsson, Reykjavik | CC BY 2.0, attribution required | [Commons](https://commons.wikimedia.org/wiki/File:Cotton_Grass_(3309040096).jpg) |
| `cottongrass-glow` | Eriophorum angustifolium, backlit (2010) | Bering Land Bridge National Preserve (US National Park Service) | CC BY 2.0, attribution required | [Commons](https://commons.wikimedia.org/wiki/File:Eriophorum_angustifolium_(7497599092).jpg) |
| `lupine-green` | Nootka lupine, Alaska (2017) | USFWS Alaska | Public domain (US federal work) | [Commons](https://commons.wikimedia.org/wiki/File:Nootka_Lupine_(35817351762).jpg) |
| `avens-white` | Dryas octopetala (2013) | Meneerke bloem | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:Dryas_octopetala_003.jpg) |
| `cosmos-blush` | White and pink cosmos (2020) | Kaldari | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:White_and_Pink_Cosmos.jpg) |

Credit line for the five CC BY images (modified: cropped, recoloured and softened), suitable for a quiet footer or credits page: "Flower photographs by Pink Sherbet Photography, Ray Best, C T Johansson, Axel Kristinsson and Bering Land Bridge National Preserve, used under CC BY (changes made); others CC0 or public domain." Licence texts: https://creativecommons.org/licenses/by/2.0/ and https://creativecommons.org/licenses/by/3.0/.

Not used: Unsplash/Pexels downloads (their licences are permissive but are not machine-verifiable here, so I used the Commons copies that carry a recorded licence), anything CC BY-SA, NC or ND.

The engravings above stay available as an optional small accent; in round 2 they are dropped from the hero (antique, not the soft luminous feeling asked for) and kept in one comp as a single tiny detail.

Candidates considered and not used: Nootka lupine photographs on Commons (photographs, mixed licenses, not artwork); any stock-site or "free for personal use" set.
