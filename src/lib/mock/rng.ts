/** Deterministic PRNG so every request for the same scope returns identical
 *  data. This keeps the prototype demo-safe: numbers never shift between
 *  refreshes, screenshots or stakeholder walkthroughs. */

export function hashSeed(...parts: (string | number)[]): number {
  const s = parts.join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rand {
  (): number;
  /** Box–Muller normal deviate. */
  normal(mean?: number, sd?: number): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(p: number): boolean;
}

export function makeRand(seed: number): Rand {
  const base = mulberry32(seed);
  const fn = (() => base()) as Rand;
  fn.normal = (mean = 0, sd = 1) => {
    const u = Math.max(base(), 1e-9);
    const v = base();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  fn.range = (min, max) => min + base() * (max - min);
  fn.int = (min, max) => Math.floor(min + base() * (max - min + 1));
  fn.chance = (p) => base() < p;
  return fn;
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const round = (v: number, dp = 3) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};
