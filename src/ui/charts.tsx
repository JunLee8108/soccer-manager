import type { RadarAxis } from '../engine/ratings'

/** Six-axis radar on a 1–20 scale. */
export function Radar({ axes, width = 176 }: { axes: RadarAxis[]; width?: number }) {
  const W = 210
  const H = 176
  const cx = W / 2
  const cy = 88
  const R = 60
  const n = axes.length
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r] as const
  const ring = (f: number) => axes.map((_, i) => point(i, R * f).join(',')).join(' ')
  const shape = axes.map((a, i) => point(i, (Math.max(1, a.value) / 20) * R).join(',')).join(' ')
  const best = Math.max(...axes.map((a) => a.value))
  const valueProps = (v: number) => ({ fill: v === best ? '#A3E635' : '#C5CEDD', fontWeight: v === best ? 700 : 400 })

  return (
    <svg
      role="img"
      aria-label={`능력치 레이더: ${axes.map((a) => `${a.label} ${a.value}`).join(', ')}`}
      width={width}
      height={(width * H) / W}
      viewBox={`0 0 ${W} ${H}`}
    >
      {[1, 2 / 3, 1 / 3].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#24324D" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#24324D" strokeWidth={1} />
      })}
      <polygon points={shape} fill="rgba(163, 230, 53, 0.22)" stroke="#A3E635" strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, R + 12)
        const vertical = Math.abs(x - cx) < 1
        if (vertical) {
          return (
            <text key={a.label} x={x} y={y < cy ? y - 1 : y + 9} textAnchor="middle" fontSize="11" fill="#C5CEDD">
              {a.label} <tspan {...valueProps(a.value)}>{a.value}</tspan>
            </text>
          )
        }
        const right = x > cx
        const lx = right ? x - 6 : x + 6
        return (
          <text key={a.label} x={lx} y={y - 3} textAnchor={right ? 'start' : 'end'} fontSize="11" fill="#C5CEDD">
            <tspan x={lx}>{a.label}</tspan>
            <tspan x={lx} dy="13" {...valueProps(a.value)}>
              {a.value}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}

export function Sparkline({ values, width = 140, height = 44, label }: { values: number[]; width?: number; height?: number; label: string }) {
  const data = values.length === 1 ? [values[0], values[0]] : values
  const min = Math.min(...data) - 1
  const max = Math.max(...data) + 1
  const step = (width - 8) / (data.length - 1)
  const pts = data.map((v, i) => [4 + i * step, 4 + ((max - v) / (max - min)) * (height - 8)] as const)
  const last = pts[pts.length - 1]
  return (
    <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#A3E635" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="#A3E635" />
    </svg>
  )
}

/** Momentum bars: home pressure up (lime), away pressure down (blue). */
export function Momentum({
  bins,
  current,
  upColor = '#A3E635',
  downColor = '#60A5FA',
}: {
  bins: [number, number][]
  current?: number
  upColor?: string
  downColor?: string
}) {
  const scale = (v: number) => Math.min(21, Math.round(v * 1.15))
  return (
    <div aria-hidden="true" className="grid h-11 gap-[3px]" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
      {bins.map(([h, a], i) => (
        <div key={i} className="flex h-11 flex-col">
          <div className="flex h-[22px] items-end">
            <span className="w-full rounded-t-[2px]" style={{ height: scale(h), background: upColor }} />
          </div>
          <div className={`flex h-[22px] items-start border-t ${current !== undefined && i * 5 < current ? 'border-active' : 'border-line'}`}>
            <span className="w-full rounded-b-[2px]" style={{ height: scale(a), background: downColor }} />
          </div>
        </div>
      ))}
    </div>
  )
}
