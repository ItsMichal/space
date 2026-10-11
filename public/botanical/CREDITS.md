# Botanical backdrop: credits

Everything in this folder and `public/motion/petal.png` is what ships. Nothing else (engraving plates, other Commons photographs) is served; originals and earlier experiments stay in `assets-src/` and are not deployed. Machine-readable version: `credits.json`.

## Home backdrop (`public/botanical/own/`)

| Files | Subject | Author | Licence | Source |
| --- | --- | --- | --- | --- |
| `hydrangea-*` | Hydrangea with green and yellow bokeh | Michał Bodzianowski | Own photograph | `assets-src/botanical/own/hydrangea.jpg` |
| `daylily-wash-*` | Red and yellow daylily, washed to a warm accent | Michał Bodzianowski | Own photograph | `assets-src/botanical/own/daylily.jpg` |
| `cherry-bloom-*` | "Three pink cherry blossoms in Tuntorp" (Featured picture on Wikimedia Commons, 4721x3148) | W.carter | CC BY 4.0, attribution required | [Commons](https://commons.wikimedia.org/wiki/File:Three_pink_cherry_blossoms_in_Tuntorp.jpg) |

The cherry plate is cropped, mirrored, has its dark leaves lifted toward blush, is washed toward the paper and given a soft alpha (`scripts/botanical-own.mjs`). The attribution for it is shown in the site footer ("Photo credits", linked, CC BY 4.0, cropped and softened) and must stay while the image ships.

## Petal (`public/motion/petal.png`, only drawn with `?petal=1`)

Texture: a clean stretch of one petal from the owner's own cherry-blossom photograph (`assets-src/botanical/own/cherry-blossom.jpg`, crop and silhouette in `scripts/build-petal.mjs`). Silhouette: a hand-drawn sakura petal. Own photograph, no attribution needed.

## Not shipped

Public-domain Flora Danica and Edwards's Botanical Register plates and the other Commons flower photographs (CC0 and CC BY) were explored in earlier rounds and removed from `public/`. If any returns, restore its row here and its credit line in the footer in the same change.
