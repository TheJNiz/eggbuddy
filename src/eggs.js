export const eggs = [
  ['Sunny Maxx', 'Sunnymaxx.png', 'Common'],
  ['Eggstein', 'Eggstein.png', 'Rare'],
  ['Goodbooi', 'Goodbooi.png', 'Common'],
  ['Walao Egg', 'Walaoegg.png', 'Rare'],
  ['Eggxercise', 'Eggxercise.png', 'Common'],
  ['Eggcited', 'Eggcited.png', 'Common'],
  ['Lovely AhMooi', 'Lovelyahmooi.png', 'Rare'],
  ['Lucky Yolk', 'Luckyyork.png', 'Epic'],
  ['Captain Shell', 'captain.png', 'Epic'],
  ['Egglon Musk', 'Egglonmusk.png', 'Legendary'],
].map((egg, id) => ({ id, name: egg[0], image: egg[1], rarity: egg[2] }))

// `luck` nudges the roll up the rarity ladder. Laying passes 0 (unchanged odds);
// an EGGSCAPE run passes a small score-derived bonus.
export function rollEggRarity(luck = 0) {
  const roll = Math.random() + luck
  if (roll > 0.93) return 'Legendary'
  if (roll > 0.78) return 'Epic'
  if (roll > 0.48) return 'Rare'
  return 'Common'
}

export function randomEggOfRarity(rarity) {
  const pool = eggs.filter((egg) => egg.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}
