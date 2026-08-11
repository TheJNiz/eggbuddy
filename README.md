# EGGbuddy Game V1

Vue 3 + Vite prototype for a physical egg brand / virtual chicken collectible game.

## Run

Requires Node.js 16 or newer.

```bash
npm install
npm run dev
```

## Current loop
- Raise a chicken with Hunger, Happiness, Energy and Health
- Feed, vitamin, play and nap actions
- Lay eggs when the chicken is healthy enough
- 10 collectible IP eggs from the supplied character sheet
- Rarity system: Common / Rare / Epic / Legendary
- QR reward demo (random reward)
- Duplicate eggs turn into coins
- Browser localStorage persistence + offline stat decay

## Production QR design
Replace `scan()` in `src/main.js` with an API call such as POST `/api/qr/redeem`.
The server should store unique hashed carton codes and reject repeated redemption. Never keep valid QR codes only in frontend JavaScript.

Suggested backend tables:
- users
- chickens
- egg_characters
- user_egg_collection
- inventory_items
- user_inventory
- qr_codes
- qr_redemptions
- egg_lay_events

## Artwork
The egg collection uses the transparent PNG artwork in `public/eggs`. Matching `-character.png` files are retained for future character views.
The animated farm scene uses the four-frame transparent `public/chicken-walk.png` sprite sheet.
