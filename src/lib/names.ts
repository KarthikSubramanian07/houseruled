// Playful default names so a new player is never just "Anonymous". Card-table
// flavored; the player can rename themselves before sitting down.

const ADJECTIVES = [
  "Lucky", "Wild", "Sly", "Bluffing", "Cool", "Sharp", "Sneaky", "Bold",
  "Quiet", "Royal", "Reckless", "Steady", "Loose", "Tight", "Brass", "Velvet",
];

const NOUNS = [
  "Ace", "Joker", "Dealer", "Shark", "Queen", "Jack", "Deuce", "King",
  "Bluff", "Trick", "Suit", "Spade", "Heart", "Club", "Diamond", "Wildcard",
];

/** A random "Lucky Ace"–style name. Deterministic randomness not required. */
export function randomPlayerName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}
