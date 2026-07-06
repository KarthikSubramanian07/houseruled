// Deterministic, seedable PRNG (mulberry32). The Durable Object seeds it from a
// crypto-random seed stored in game state, so shuffles are server-controlled and
// reproducible for tests. Never use Math.random for gameplay — it can't be
// replayed and isn't available deterministically in the Workers runtime.

export type RNG = () => number; // returns a float in [0, 1)

export function makeRng(seed: number): RNG {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A crypto-random 32-bit seed (falls back to Math.random on ancient runtimes).
 *  References the `crypto` global directly so it types under both the DOM and
 *  the Cloudflare Workers runtime. */
export function randomSeed(): number {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.getRandomValues) {
    const b = new Uint32Array(1);
    c.getRandomValues(b);
    return b[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

/** Random integer in [0, n). */
export function randInt(rng: RNG, n: number): number {
  return Math.floor(rng() * n);
}
