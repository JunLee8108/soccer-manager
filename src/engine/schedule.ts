import type { Rng } from './rng'
import type { Fixture } from './types'

/**
 * Double round robin with the circle method. The second half mirrors the first
 * with venues swapped, so every pair meets once at each ground.
 */
export function doubleRoundRobin(clubIds: string[], rng: Rng, season: number): Fixture[] {
  const teams = rng.shuffle([...clubIds])
  if (teams.length % 2 !== 0) throw new Error('Need an even number of clubs')
  const n = teams.length
  const firstHalf: [string, string][][] = []
  const arr = teams.slice()

  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      const aHome = i === 0 ? r % 2 === 0 : (r + i) % 2 === 1
      pairs.push(aHome ? [a, b] : [b, a])
    }
    firstHalf.push(pairs)
    // Keep the first team fixed and rotate the rest clockwise.
    arr.splice(1, 0, arr.pop()!)
  }

  const rounds = [...firstHalf, ...firstHalf.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string]))]
  const fixtures: Fixture[] = []
  rounds.forEach((pairs, round) => {
    pairs.forEach(([homeId, awayId], i) => {
      fixtures.push({ id: `s${season}r${round}m${i}`, round, homeId, awayId, result: null })
    })
  })
  return fixtures
}

export function roundsCount(clubCount: number): number {
  return (clubCount - 1) * 2
}
