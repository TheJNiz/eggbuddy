# Designer needs — isolated EGGSCAPE sprites

The farm and collection already have art on disk. Do not replace or redraw these:

- `public/eggs/` — collection badges and matching `-character.png` scenes
- `public/chicken-walk.png` — four-frame farm walk cycle

EGGSCAPE currently crops a collection badge for the running hero and generates hazards/pickups from the world palette when no PNG is present. The slots below are the missing **isolated** sprites (transparent, cropped to the object — not the full-bleed character scenes). Point `file` in `src/game/sprites.js` / `src/game/worlds.js` at the public path once a PNG exists; RunScene will preload and use it.

Until then every slot is `file: null`. Do not invent stand-in art in code.

## Missing files

Paths are relative to `public/`.

| Path | Use |
|---|---|
| `hazards/shine/sunflower.png` | Shine EGGnyway — sunflower stalk hazard |
| `hazards/shine/stump.png` | Shine EGGnyway — ground stump hazard |
| `hazards/shine/shell.png` | Shine EGGnyway — cracked-shell hazard |
| `hazards/sprint/hurdle.png` | Stadium Sprint — track hurdle |
| `hazards/sprint/cone.png` | Stadium Sprint — training cone |
| `hazards/sprint/trophy.png` | Stadium Sprint — trophy block hazard |
| `hazards/kampung/laundry.png` | Kampung Waddle — laundry pole |
| `hazards/kampung/banana.png` | Kampung Waddle — banana peel |
| `hazards/kampung/bucket.png` | Kampung Waddle — pail / village clutter |
| `pickups/boost.png` | Luck power boost pad |
| `pickups/golden-egg.png` | Run collectible (replaces generated coin) |

Source of truth: `DESIGNER_NEEDS` in `src/game/sprites.js`.
