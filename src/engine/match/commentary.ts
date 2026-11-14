import { josa } from '../korean'
import type { Rng } from '../rng'
import type { DefLine, Press, Style } from '../types'

export type ChanceKind = 'through' | 'cutback' | 'header' | 'box' | 'long' | 'freekick' | 'penalty' | 'corner' | 'counter'

const pick = (rng: Rng, list: string[]) => list[Math.floor(rng.next() * list.length)]

export function goalText(rng: Rng, kind: ChanceKind, shooter: string, assist: string | null): string {
  const p = shooter
  const a = assist
  switch (kind) {
    case 'through':
      return a
        ? pick(rng, [
            `골! ${a}의 스루패스를 받은 ${josa(p, '이/가')} 골키퍼와의 일대일에서 침착하게 마무리합니다!`,
            `골! ${a}의 침투 패스, ${josa(p, '이/가')} 수비 뒷공간을 파고들어 골망을 흔듭니다!`,
          ])
        : `골! ${josa(p, '이/가')} 수비 실수를 놓치지 않고 단독 돌파 후 마무리합니다!`
    case 'cutback':
      return a
        ? `골! ${a}의 컷백을 ${josa(p, '이/가')} 원터치로 밀어 넣습니다!`
        : `골! 문전에서 흐른 공을 ${josa(p, '이/가')} 놓치지 않고 차 넣습니다!`
    case 'header':
      return a
        ? pick(rng, [
            `골! ${a}의 크로스를 ${josa(p, '이/가')} 머리로 받아 넣습니다!`,
            `골! ${a}의 정확한 크로스, ${p}의 헤더가 골문 구석으로 향합니다!`,
          ])
        : `골! ${p}의 강력한 헤더가 골망을 가릅니다!`
    case 'box':
      return pick(rng, [
        `골! 문전 혼전 상황에서 ${josa(p, '이/가')} 날카로운 슈팅으로 골망을 흔듭니다!`,
        a ? `골! ${a}의 패스를 받은 ${josa(p, '이/가')} 수비를 제치고 강하게 차 넣습니다!` : `골! ${p}의 낮게 깔린 슈팅이 골키퍼를 지나 골문 안으로!`,
      ])
    case 'long':
      return pick(rng, [
        `골! ${p}의 환상적인 중거리 슛이 골문 구석에 꽂힙니다!`,
        `골! 아무도 막지 않자 ${josa(p, '이/가')} 과감하게 때린 슈팅이 그대로 들어갑니다!`,
      ])
    case 'freekick':
      return `골! ${p}의 프리킥이 수비벽을 넘어 그대로 골문으로 빨려 들어갑니다!`
    case 'penalty':
      return `골! ${josa(p, '이/가')} 페널티킥을 침착하게 성공시킵니다.`
    case 'corner':
      return a ? `골! ${a}의 코너킥을 ${josa(p, '이/가')} 헤더로 마무리합니다!` : `골! 코너킥 상황에서 ${p}의 헤더가 골망을 가릅니다!`
    case 'counter':
      return a
        ? `골! 빠른 역습! ${a}의 패스를 받은 ${josa(p, '이/가')} 그대로 마무리합니다!`
        : `골! 역습 상황에서 ${josa(p, '이/가')} 단독 질주 후 골을 터뜨립니다!`
  }
}

export function savedText(rng: Rng, kind: ChanceKind, shooter: string, keeper: string): string {
  switch (kind) {
    case 'through':
    case 'counter':
      return pick(rng, [
        `${keeper}, ${p(shooter)} 일대일 슈팅을 막아냅니다! 엄청난 선방!`,
        `${josa(shooter, '이/가')} 골키퍼와 맞섰지만 ${josa(keeper, '이/가')} 각도를 좁혀 막아냅니다.`,
      ])
    case 'header':
    case 'corner':
      return `${shooter}의 헤더, ${keeper}의 정면으로 향합니다.`
    case 'long':
      return `${shooter}의 중거리 슛, ${josa(keeper, '이/가')} 몸을 날려 쳐냅니다.`
    case 'freekick':
      return `${shooter}의 프리킥, ${josa(keeper, '이/가')} 손끝으로 걷어냅니다.`
    case 'penalty':
      return `${keeper}, ${shooter}의 페널티킥을 막아냅니다! 방향을 완벽하게 읽었습니다!`
    default:
      return pick(rng, [
        `${shooter}의 슈팅, ${keeper}의 선방에 막힙니다.`,
        `${josa(shooter, '이/가')} 때린 슈팅을 ${josa(keeper, '이/가')} 안정적으로 잡아냅니다.`,
      ])
  }
}

function p(name: string) {
  return `${name}의`
}

export function missText(rng: Rng, kind: ChanceKind, shooter: string, assist: string | null, outcome: 'missed' | 'blocked' | 'post'): string {
  if (outcome === 'post') return `결정적인 기회! 하지만 ${shooter}의 슈팅이 골대를 강타합니다!`
  if (outcome === 'blocked') {
    return pick(rng, [`${shooter}의 슈팅이 수비수 몸에 맞고 굴절됩니다.`, `${josa(shooter, '이/가')} 슈팅을 시도했지만 육탄 방어에 막힙니다.`])
  }
  switch (kind) {
    case 'header':
    case 'corner':
      return assist
        ? `${assist}의 크로스를 ${josa(shooter, '이/가')} 헤더로 연결했지만 골대를 벗어납니다.`
        : `${shooter}의 헤더가 크로스바 위로 넘어갑니다.`
    case 'long':
      return pick(rng, [`${shooter}의 중거리 슛, 골대 위로 크게 벗어납니다.`, `${shooter}의 중거리 슛이 골대를 살짝 벗어납니다.`])
    case 'penalty':
      return `${josa(shooter, '이/가')} 페널티킥을 실축합니다! 공이 골대 밖으로 향합니다.`
    case 'freekick':
      return `${shooter}의 프리킥이 수비벽에 걸립니다.`
    case 'through':
    case 'counter':
      return `${josa(shooter, '이/가')} 결정적인 기회를 맞았지만 슈팅이 골문을 벗어납니다.`
    default:
      return pick(rng, [`${shooter}의 슈팅이 골대를 살짝 벗어납니다.`, `${shooter}의 슈팅, 힘이 너무 들어갔습니다.`])
  }
}

export function yellowText(rng: Rng, player: string): string {
  return pick(rng, [
    `${player}, 거친 태클로 경고를 받습니다.`,
    `${player}, 역습을 끊는 과정에서 반칙을 범해 경고를 받습니다.`,
    `${player}, 심판에게 항의하다 경고를 받습니다.`,
  ])
}

export const secondYellowText = (player: string) => `${player}, 두 번째 경고로 퇴장당합니다!`
export const redText = (player: string) => `${player}, 위험한 태클로 다이렉트 퇴장!`
export const injuryText = (player: string) => `${player}, 부상으로 더 이상 경기를 뛸 수 없습니다.`
export const subText = (team: string, out: string, inn: string) => `${team} 교체 — ${out} OUT, ${inn} IN`

export function flavorText(
  rng: Rng,
  team: string,
  t: { style: Style; press: Press; line: DefLine },
  playerName: string,
): string {
  const options = [
    `중원에서 치열한 볼 다툼이 이어집니다.`,
    `${josa(playerName, '이/가')} 활발한 움직임으로 공간을 만들어냅니다.`,
    `${team}, 측면을 활용한 공격을 시도합니다.`,
  ]
  if (t.style === 'possession') options.push(`${josa(team, '이/가')} 점유율을 높이며 경기를 주도합니다.`, `${team}, 후방에서 차분하게 볼을 돌립니다.`)
  if (t.style === 'counter') options.push(`${team}, 빠른 전환으로 역습 기회를 엿봅니다.`)
  if (t.press === 'high') options.push(`${josa(team, '이/가')} 강한 압박으로 상대 빌드업을 방해합니다.`)
  if (t.line === 'deep') options.push(`${team}, 수비 라인을 내리고 단단하게 버팁니다.`)
  if (t.line === 'high') options.push(`${team}, 수비 라인을 끌어올려 상대를 몰아붙입니다.`)
  return pick(rng, options)
}
