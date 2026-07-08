// Quick "how to play" for every built-in game - a goal, a few plain-English
// steps, and one tip worth knowing. Keyed by GameDefinition.type. Kept out of the
// engine so copy can breathe without touching game logic.

export interface GameGuide {
  /** One line: what you're trying to do. */
  goal: string;
  /** 3–6 short beats on how a hand actually plays. */
  steps: string[];
  /** A single edge - strategy or flavor. */
  tip: string;
}

export const GUIDES: Record<string, GameGuide> = {
  war: {
    goal: "Win every card in the deck.",
    steps: [
      "You each flip the top card of your pile at the same time.",
      "Higher rank takes both cards to the bottom of their stack.",
      "Tie? This means WAR - three cards face-down, one face-up, winner scoops the lot.",
      "Run out of cards and you're out. Last player standing wins.",
    ],
    tip: "It's pure luck from here - pour a drink and enjoy the swings.",
  },
  gofish: {
    goal: "Collect the most books - four of a kind.",
    steps: [
      "On your turn, ask one player for a rank you already hold.",
      "If they have any, they hand them all over - and you ask again.",
      "If they don't, they say “Go Fish” and you draw from the pool.",
      "Complete four of a kind and lay it down as a book.",
    ],
    tip: "Listen to what everyone else asks for - it tells you who's holding what.",
  },
  oldmaid: {
    goal: "Don't be the one left holding the Old Maid.",
    steps: [
      "Matching pairs are discarded the moment you have them.",
      "On your turn, draw one hidden card from the player on your left.",
      "Keep pairing off cards as they come.",
      "One queen has no partner - whoever's stuck with her at the end loses.",
    ],
    tip: "Keep a straight face. If your hand twitches toward one card, they'll avoid it.",
  },
  crazyeights: {
    goal: "Be the first to empty your hand.",
    steps: [
      "Play a card matching the top card's rank or suit.",
      "Eights are wild - play one and name any suit you like.",
      "Can't play? Draw until you can, or pass.",
      "This game takes house rules - add your own in plain English before you deal.",
    ],
    tip: "Hoard an eight for the moment you'd otherwise be stuck.",
  },
  blackjack: {
    goal: "Beat the dealer - get near 21 without going over.",
    steps: [
      "You're dealt two cards; face cards count 10, aces 1 or 11.",
      "Hit to take another card, or Stand to hold.",
      "Go over 21 and you bust immediately.",
      "The dealer reveals and draws to 17 - closest to 21 wins.",
    ],
    tip: "Assume the dealer's hidden card is a ten and play the odds.",
  },
  hearts: {
    goal: "Score the fewest points, not the most.",
    steps: [
      "Pass three cards to an opponent, then play tricks - follow the led suit.",
      "Every heart costs 1 point; the Queen of Spades costs 13.",
      "Win a trick and you take (and eat) whatever points are in it.",
      "Or “shoot the moon” - take all 26 to hand them to everyone else.",
    ],
    tip: "The Queen of Spades ends friendships. Get rid of her early.",
  },
  spades: {
    goal: "Bid the tricks you'll take - then take exactly that many.",
    steps: [
      "Bid a number of tricks, or Nil to swear off all of them.",
      "Spades are always trump; follow the led suit when you can.",
      "Make your combined bid to score 10× each.",
      "Fall short and your whole bid is set against you.",
    ],
    tip: "Nil is a knife-edge - pull it off for a windfall, blow it for a wound.",
  },
  euchre: {
    goal: "First partnership to 10 points.",
    steps: [
      "Just 24 cards (9 through Ace), played two-versus-two.",
      "The turned-up card offers trump - order it up or pass, then name a suit.",
      "The Jack of trump (right bower) and its same-color twin (left bower) are the two best cards.",
      "Take 3 of 5 tricks to score; all 5 scores more.",
    ],
    tip: "Confident in your trump? Go alone and play without your partner for double.",
  },
  cheat: {
    goal: "Empty your hand first - honestly or otherwise.",
    steps: [
      "Play cards face-down and claim they're the required rank.",
      "The required rank climbs each turn: A, 2, 3, and around again.",
      "Anyone can shout “Bluff!” and flip your last play.",
      "Caught lying? You take the pile. Wrong accusation? The caller does.",
    ],
    tip: "A calm, boring lie is far more convincing than a clever one.",
  },
  ohhell: {
    goal: "Win exactly the tricks you bid - no more, no fewer.",
    steps: [
      "Hand size changes every round; a card is flipped to set trump.",
      "Bid the precise number of tricks you'll take.",
      "Hit your bid exactly and you score well.",
      "Over or under by even one, and you score nothing.",
    ],
    tip: "The bids can't all add up - someone is always forced to break their hand.",
  },
  gin: {
    goal: "Arrange your hand into sets and runs, then knock.",
    steps: [
      "Draw from the stock or the discard, then throw one card away.",
      "Melds are three-plus of a kind, or three-plus in sequence of one suit.",
      "“Deadwood” is your leftover unmatched cards.",
      "Knock when your deadwood is 10 or less - or hit zero for Gin.",
    ],
    tip: "A quick knock can steal the hand before your opponent gets organized.",
  },
  scopa: {
    goal: "Capture cards worth points - coins, the sette bello, the primiera.",
    steps: [
      "A 40-card deck; play one card from your hand each turn.",
      "Match a table card of equal value to take it - or a set that sums to your card.",
      "Sweep the whole table for a “scopa” and a bonus point.",
      "Whatever's left on the table goes to the last player to capture.",
    ],
    tip: "The seven of coins - the sette bello - is a point on its own. Chase it.",
  },
  pitch: {
    goal: "Bid for points, then go take them.",
    steps: [
      "Bid 2–4 for how many of High, Low, Jack, and Game you expect to win.",
      "The very first card you lead sets the trump suit.",
      "Win tricks to collect those four points.",
      "Come up short of your bid and you're “set” - the bid counts against you.",
    ],
    tip: "Only bid what your trumps can actually guarantee. Optimism gets you set.",
  },
  casino: {
    goal: "Capture the cards that count - aces, spades, the 10♦ and 2♠.",
    steps: [
      "Play a card to capture a table card of the same rank…",
      "…or a group of number cards that sum to your card's value.",
      "Take everything you legally can in a single play.",
      "Nothing to grab? Trail a card face-up. Clear the table for a sweep.",
    ],
    tip: "The 10 of diamonds is worth two points by itself - never leave it behind.",
  },
  cribbage: {
    goal: "Be first around the board to 121.",
    steps: [
      "Deal six, lay two aside for the dealer's crib.",
      "Cut a starter card, then peg through “the play” - score 15s, pairs, runs, and 31.",
      "Then count “the show”: 15s, pairs, runs, flush, and his nobs.",
      "Non-dealer counts first - which matters when it's close.",
    ],
    tip: "Because pone counts before the dealer, the final hand is a genuine footrace.",
  },
  fivehundred: {
    goal: "First partnership to 500 points.",
    steps: [
      "A 43-card deck with a Joker, dealt 10 each plus a three-card kitty.",
      "Bid the tricks (6–10) and trump you'll make; highest bid wins the contract.",
      "The winner takes the kitty and discards three back down.",
      "The bowers and the Joker are the top trumps - make your bid or lose its value.",
    ],
    tip: "Count your bowers and your Joker before you bid - they're your sure tricks.",
  },
};

export function getGuide(type: string): GameGuide | undefined {
  return GUIDES[type];
}
