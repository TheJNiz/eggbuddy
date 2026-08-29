# Designer needs — isolated EGGSCAPE sprites

The farm and collection already have art on disk. Do not replace or redraw these:

- `public/eggs/` — collection badges and matching `-character.png` scenes
- `public/chicken-walk.png` — four-frame farm walk cycle
- `public/platforms/shine/` — Shine hop sunflower pads (768-wide restyle). Landable box is the green-disc lip `{ x: 16, y: 12, w: 736, h: 48 }` in source pixels; stem / leaves / petals are not solid.
- `public/heroes/shine-runner.png` — isolated Shine hop runner
- `public/pickups/golden-egg.png` — hop collectible (arc between pads)
- `public/fx/bounce-splash.png` — landing splash on the flower head
- `public/bg/shine/{sky,fg}.png` — hop sky and dirt/fence/eggshell foreground (no physics)

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

Source of truth: `DESIGNER_NEEDS` in `src/game/sprites.js`.
