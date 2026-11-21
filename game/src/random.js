// A small seeded random number generator (mulberry32): the same seed gives the same
// city, the same traffic and the same screenshot scenes, which is what makes the
// ?shot= scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(random, list) { return list[Math.floor(random() * list.length)]; }
export function range(random, lo, hi) { return lo + random() * (hi - lo); }
export function rangeInt(random, lo, hi) { return lo + Math.floor(random() * (hi - lo + 1)); }
