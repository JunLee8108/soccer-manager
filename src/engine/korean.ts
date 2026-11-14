/** Whether the last Hangul syllable has a final consonant (받침). */
export function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) {
    // Latin letters / digits: a rough guess good enough for names and numbers.
    return /[013678lmnLMN]$/.test(last)
  }
  return (code - 0xac00) % 28 !== 0
}

/** True when the final consonant is ㄹ (affects 으로/로). */
function endsWithRieul(word: string): boolean {
  const code = word.trim().slice(-1).charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return false
  return (code - 0xac00) % 28 === 8
}

type Pair = '이/가' | '은/는' | '을/를' | '와/과' | '으로/로' | '이라/라'

/** Attach the right particle: josa('이도윤', '이/가') → '이도윤이'. */
export function josa(word: string, pair: Pair): string {
  const b = hasBatchim(word)
  switch (pair) {
    case '이/가':
      return word + (b ? '이' : '가')
    case '은/는':
      return word + (b ? '은' : '는')
    case '을/를':
      return word + (b ? '을' : '를')
    case '와/과':
      return word + (b ? '과' : '와')
    case '으로/로':
      return word + (b && !endsWithRieul(word) ? '으로' : '로')
    case '이라/라':
      return word + (b ? '이라' : '라')
  }
}

/** Format an amount in 만원 as ₩억/₩만. */
export function formatMoney(manwon: number, opts: { sign?: boolean } = {}): string {
  const sign = manwon < 0 ? '-' : opts.sign ? '+' : ''
  const v = Math.abs(manwon)
  let body: string
  if (v >= 10000) {
    const eok = v / 10000
    body = `${eok >= 100 ? Math.round(eok) : Math.round(eok * 10) / 10}억`
  } else {
    body = `${Math.round(v).toLocaleString('ko-KR')}만`
  }
  return `${sign}₩${body}`
}

export const POSITION_LABEL: Record<string, string> = {
  GK: '골키퍼',
  LB: '왼쪽 풀백',
  CB: '센터백',
  RB: '오른쪽 풀백',
  DM: '수비형 미드필더',
  CM: '중앙 미드필더',
  AM: '공격형 미드필더',
  LW: '왼쪽 윙어',
  RW: '오른쪽 윙어',
  ST: '스트라이커',
}

export const FOOT_LABEL: Record<string, string> = { L: '왼발', R: '오른발', B: '양발' }
