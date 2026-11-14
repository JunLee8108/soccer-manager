/**
 * Seeded PRNG (mulberry32). The whole state is one 32-bit integer so it can be
 * stored in the save file and resumed deterministically.
 */
export class Rng {
  state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]
  }

  /** Approximately normal (Irwin–Hall with 4 samples), mean 0, sd ≈ sd. */
  normal(sd = 1): number {
    const s = this.next() + this.next() + this.next() + this.next() - 2
    return s * sd * 1.732
  }

  /** Pick an index with probability proportional to weights. */
  weighted(weights: readonly number[]): number {
    let total = 0
    for (const w of weights) total += Math.max(0, w)
    if (total <= 0) return Math.floor(this.next() * weights.length)
    let r = this.next() * total
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i])
      if (r < 0) return i
    }
    return weights.length - 1
  }

  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }
}

/** Mix two integers into a new 32-bit seed (used to derive per-match seeds). */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
