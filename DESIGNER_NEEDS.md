# Designer needs — isolated EGGSCAPE sprites

The farm and collection already have art on disk. Do not replace or redraw these:

- `public/eggs/` — collection badges and matching `-character.png` scenes
- `public/chicken-walk.png` — four-frame farm walk cycle
- `public/platforms/shine/` — Shine hop sunflower pads and Sun Drop pickup. Landable box is the shared top-of-head pad `{ x: 8, y: 8, w: 496, h: 40 }` in source pixels; stem / leaves / petals are not solid.

EGGSCAPE currently crops a collection badge for the running hero and generates hazards/pickups from the world palette when no PNG is present. The slots below are the missing **isolated** sprites (transparent, cropped to the object — not the full-bleed character scenes). Point `file` in `src/game/worlds.js` at the public path once a PNG exists; RunScene will preload and use it.

Palette fallback only if a file is missing. Do not invent stand-in art in code.

## Missing files

Paths are relative to `public/`.

| Path | Use |
|---|---|
| `hazards/sprint/hurdle.png` | Stadium Sprint — track hurdle |
| `hazards/sprint/cone.png` | Stadium Sprint — training cone |
| `hazards/sprint/trophy.png` | Stadium Sprint — trophy block hazard |
| `hazards/kampung/laundry.png` | Kampung Waddle — laundry pole |
| `hazards/kampung/banana.png` | Kampung Waddle — banana peel |
| `hazards/kampung/bucket.png` | Kampung Waddle — pail / village clutter |
| `pickups/boost.png` | Luck power boost pad |
| `pickups/golden-egg.png` | Run collectible (replaces generated coin) |

Source of truth: `DESIGNER_NEEDS` in `src/game/sprites.js`.
