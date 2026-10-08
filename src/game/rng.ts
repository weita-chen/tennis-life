export type Rng = () => number;

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(seed: string, tag: string): Rng {
  return makeRng(hashSeed(`${seed}::${tag}`));
}

export function gaussian(rng: Rng): number {
  let u = rng();
  if (u < 1e-9) u = 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rng());
}

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

export function weighted<T>(rng: Rng, items: { item: T; w: number }[]): T {
  let total = 0;
  for (const i of items) total += Math.max(0, i.w);
  if (total <= 0) return items[0]!.item;
  let r = rng() * total;
  for (const i of items) {
    r -= Math.max(0, i.w);
    if (r <= 0) return i.item;
  }
  return items[items.length - 1]!.item;
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
