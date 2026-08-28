# Shine hop platforms

Transparent PNGs, common width 512. Flower head is at the top of the frame; stem is visual only.

| file | PNG size | head box (x, y, w × h) |
|---|---|---|
| sunflower-short.png | 512×296 | (8, 13, 494×200) |
| sunflower-mid.png | 512×498 | (8, 10, 495×175) |
| sunflower-tall.png | 512×619 | (8, 8, 496×168) |
| sundrop.png | 211×256 | pickup, not a platform |

Landable collider (top of the head only, one-way from above). Shared pad if you want one AABB for all three:
`{ x: 8, y: 8, w: 496, h: 40 }`

Stem, leaves, and hanging petals are not solid. Suggested display width 80–96px.
