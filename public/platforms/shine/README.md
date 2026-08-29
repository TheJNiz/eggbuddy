# Shine hop platforms

Transparent PNGs, common width 768. GREEN disc is the landable face; petals and stem are visual only.

| file | PNG size | GREEN disc (x, y, w × h) | crown row | display width | used by band |
|---|---|---|---|---|---|
| sunflower-tall.png | 768×708 | (84, 17, 615×140) | 227 | 187 | tall **and short** |
| sunflower-mid.png | 768×682 | (95, 17, 657×144) | 242 | 175 | mid |
| sunflower-short.png | 768×516 | (188, 10, 392×208) | 301 | — | **unused** — see defects |
| sundrop.png | 211×256 | leftover pickup; hop coins use pickups/golden-egg.png | — | — | — |

`band` is elevation, not flower size, so the short band currently reuses the tall art.
`sunflower-short.png` is wired up but not referenced; restore it in `worlds.js` once it is
re-exported with a complete petal ring.

Landable collider is the GREEN disc, one-way from above, scaled with the sprite.

`crown` is the source row where the petal ring ends and the bare stem begins. The scene
lifts its hop bands to keep every row above `crown` on screen; the stem below it is allowed
to run off the bottom edge.

## Why the display widths differ

The flower fills a different share of each frame — 86% of the width on mid, 80% on tall,
only 51% on short. Display widths are therefore back-solved per file so that every pad
lands ~150px of standable disc. A single shared display width would give the pads very
different landing areas: at a common ~180px, short would land 90px against mid's 157px.

## Known art defects

These need re-exported source PNGs; they cannot be corrected in code.

- **sunflower-mid.png** — flower is clipped by the canvas on the top and right edges, and
  its head sits 40px right of frame centre.
- **sunflower-tall.png** — top petal row is clipped flat by the canvas edge.
- **sunflower-short.png** — currently unused. It is a zoomed-in crop whose petal ring is
  cropped away on the left, right and top edges, leaving petals only along the bottom, so
  the head reads as a bare disc rather than a ringed flower. It also wastes ~49% of its
  frame width on transparent margin, so it needs a much larger display width to land the
  same disc, which is what made the crop obvious.

Ideal export: flower centred in the frame, fully inside the canvas with a few px of
transparent padding on every edge, and the same head-to-frame ratio across all three files.
