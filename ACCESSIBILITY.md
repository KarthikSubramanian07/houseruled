# Accessibility

Houseruled aims for **WCAG 2.2 Level AA** on every page and reachable state of the web app.

## What we test

- Automated: axe-core with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` at 1440×900, 390×844, and 320×800.
- Manual: keyboard operation (no traps), focus order and visible focus, dialogs (focus trap, Escape, restore), names/roles/states, landmarks and skip link, page `lang` and titles, text alternatives, live regions for game status and chat, form labels and errors, contrast, colour not used alone, reflow at 320 px, target size, and reduced / non-looping motion.

## Known limitations

- Full multiplayer rooms and mid-game surfaces need the Cloudflare Worker (`npm run preview` / deploy). Plain `next dev` runs a local table-demo lobby; live WebSocket chat and authoritative game play are exercised there instead.
- Red/black suit colour on card faces is paired with rank text and an accessible name (for example “Ace of Hearts”), so colour is never the only cue.
- Community library, profiles, and invent flows that call D1 or Groq may show empty or error states without those backends; those states are still labelled and announced.

## Report a barrier

Open an issue on the repository, or use the contact details on [/contact](/contact).
