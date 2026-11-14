/**
 * Optimal assignment (Hungarian algorithm, O(n²m)) for an n×m cost matrix
 * with n ≤ m. Returns, for each row, the column it is assigned to.
 */
export function assignMinCost(cost: number[][]): number[] {
  const n = cost.length
  if (n === 0) return []
  const m = cost[0].length
  if (n > m) throw new Error('assignMinCost needs rows <= columns')
  const INF = Number.POSITIVE_INFINITY
  const u: number[] = Array.from({ length: n + 1 }, () => 0)
  const v: number[] = Array.from({ length: m + 1 }, () => 0)
  const p: number[] = Array.from({ length: m + 1 }, () => 0)
  const way: number[] = Array.from({ length: m + 1 }, () => 0)

  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv: number[] = Array.from({ length: m + 1 }, () => INF)
    const used: boolean[] = Array.from({ length: m + 1 }, () => false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = INF
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }

  const result: number[] = Array.from({ length: n }, () => -1)
  for (let j = 1; j <= m; j++) if (p[j] !== 0) result[p[j] - 1] = j - 1
  return result
}
