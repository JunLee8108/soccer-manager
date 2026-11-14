import { developPlayer } from './development'
import { emptyStats, objectiveFor } from './generator'
import { josa } from './korean'
import { autoLineup, repairTactics } from './lineup'
import { buildReport, createMatch, simulateToEnd } from './match/engine'
import type { LiveMatch, Side } from './match/types'
import { ovr } from './ratings'
import { mixSeed, Rng } from './rng'
import { expiringPlayers, runOffseason } from './offseason'
import { doubleRoundRobin, roundsCount } from './schedule'
import { computeStandings, standingsOf, topScorers } from './standings'
import type { ContractDecision, Fixture, GameState, Message, MessageTag, Player } from './types'

/** Minutes and rating per player for the round just played. */
type Appearances = Map<string, { minutes: number; rating: number }>

/** Share of the missing condition recovered each week. */
export const RECOVERY_RATE = { light: 0.85, normal: 0.75, hard: 0.62 } as const
export const RECOVERY_FOCUS_BONUS = 0.08
const TRAINING_INJURY = { light: 0.0015, normal: 0.0035, hard: 0.008 } as const
const MAX_INBOX = 50

export const totalRounds = (game: GameState) => roundsCount(game.clubOrder.length)
export const isSeasonOver = (game: GameState) => game.round >= totalRounds(game)

export function roundFixtures(game: GameState, round = game.round): Fixture[] {
  return game.fixtures.filter((f) => f.round === round)
}

export function userFixture(game: GameState, round = game.round): Fixture | undefined {
  return game.fixtures.find((f) => f.round === round && (f.homeId === game.userClubId || f.awayId === game.userClubId))
}

export function userResults(game: GameState): Fixture[] {
  return game.fixtures
    .filter((f) => f.result && (f.homeId === game.userClubId || f.awayId === game.userClubId))
    .sort((a, b) => a.round - b.round)
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function matchSeed(game: GameState, fixture: Fixture): number {
  return mixSeed(game.seed + game.season * 7919, hashString(fixture.id))
}

function addMessage(game: GameState, tag: MessageTag, title: string, body: string) {
  const msg: Message = { id: `m${game.nextId++}`, season: game.season, round: game.round, tag, title, body, read: false }
  game.inbox = [msg, ...game.inbox].slice(0, MAX_INBOX)
}

/**
 * Make every club's team sheet valid for the upcoming round. AI clubs pick a
 * fresh XI; the user's selection is kept and only unavailable players are swapped.
 */
export function prepareRound(input: GameState): GameState {
  const game = structuredClone(input)
  for (const id of game.clubOrder) {
    const club = game.clubs[id]
    if (id === game.userClubId) {
      const { tactics, replaced } = repairTactics(club, game.players)
      const changed = JSON.stringify(tactics.lineup) !== JSON.stringify(club.tactics.lineup)
      club.tactics = tactics
      if (changed && replaced.length > 0) {
        addMessage(
          game,
          'staff',
          '선발 명단 자동 조정',
          `부상·징계로 출전할 수 없는 ${replaced.join(', ')} 대신 다른 선수를 선발로 넣었습니다. 전술 화면에서 확인해 주세요.`,
        )
      }
    } else {
      const { lineup, bench } = autoLineup(club, game.players)
      club.tactics = { ...club.tactics, lineup, bench }
    }
  }
  return game
}

export function startUserMatch(game: GameState): LiveMatch | null {
  const fixture = userFixture(game)
  if (!fixture) return null
  return createMatch(fixture, game, matchSeed(game, fixture), game.userClubId)
}

/** Write a finished match into the game state. Returns ids of newly injured players. */
function applyMatch(game: GameState, fixture: Fixture, m: LiveMatch, fresh: Set<string>, apps: Appearances) {
  const scorers = m.events
    .filter((e) => e.type === 'goal' && e.playerId)
    .map((e) => ({ playerId: e.playerId!, clubId: (e.side === 'home' ? m.home : m.away).clubId, minute: e.minute }))
  const report = buildReport(m, fixture)
  fixture.result = { homeGoals: m.home.goals, awayGoals: m.away.goals, scorers, motmId: report.motmId }

  for (const side of ['home', 'away'] as Side[]) {
    const t = side === 'home' ? m.home : m.away
    const opp = side === 'home' ? m.away : m.home
    const club = game.clubs[t.clubId]
    const isUser = club.id === game.userClubId
    const result = t.goals > opp.goals ? 'W' : t.goals < opp.goals ? 'L' : 'D'

    // Suspensions already in place have now been served for this match.
    for (const pid of club.playerIds) {
      const p = game.players[pid]
      if (p.suspension > 0) p.suspension--
    }

    for (const mp of [...t.onPitch, ...t.off]) {
      const p = game.players[mp.id]
      if (!p) continue
      apps.set(mp.id, { minutes: (mp.minuteOff ?? 90) - mp.minuteOn, rating: mp.rating })
      p.stats.apps++
      if (mp.started) p.stats.starts++
      p.stats.goals += mp.goals
      p.stats.assists += mp.assists
      p.stats.ratingSum += mp.rating
      p.stats.rated++
      if (mp.id === report.motmId) p.stats.motm++
      if (mp.pos === 'GK' && mp.started && opp.goals === 0 && mp.minuteOff === null) p.stats.cleanSheets++
      p.condition = Math.round(mp.energy)
      p.morale = Math.max(25, Math.min(100, p.morale + (result === 'W' ? 5 : result === 'L' ? -5 : 1)))

      if (mp.sentOff) {
        p.stats.reds++
        p.suspension += mp.yellow ? 1 : 2
        if (isUser) addMessage(game, 'staff', `${p.name} 출장 정지`, `퇴장으로 다음 ${p.suspension}경기에 출전할 수 없습니다.`)
      } else if (mp.yellow) {
        p.stats.yellows++
        p.yellowAccum++
        if (p.yellowAccum >= 5) {
          p.yellowAccum = 0
          p.suspension += 1
          if (isUser) addMessage(game, 'staff', `${p.name} 경고 누적`, `경고 5회 누적으로 다음 경기에 출전할 수 없습니다.`)
        }
      }
    }

    for (const inj of m.injuries) {
      const p = game.players[inj.playerId]
      if (!p || p.clubId !== club.id) continue
      p.injury = { type: inj.type, weeks: inj.weeks }
      fresh.add(p.id)
      if (isUser) {
        addMessage(
          game,
          'medical',
          `${p.name} 부상 — ${inj.weeks}주 이탈`,
          `${inj.type}. 약 ${inj.weeks}경기 결장이 예상됩니다.`,
        )
      }
    }
  }
  return report
}

function weeklyUpdate(game: GameState, rng: Rng, fresh: Set<string>, apps: Appearances) {
  for (const p of Object.values(game.players)) {
    const club = game.clubs[p.clubId]
    const isUser = club.id === game.userClubId
    const app = apps.get(p.id)
    developPlayer(
      p,
      club,
      { minutes: app?.minutes ?? 0, rating: app?.rating ?? null, youth: club.youthIds.includes(p.id), injured: !!p.injury },
      rng,
    )
    if (p.injury && !fresh.has(p.id)) {
      p.injury.weeks--
      if (p.injury.weeks <= 0) {
        p.injury = null
        p.condition = Math.min(p.condition, 78)
        if (isUser) addMessage(game, 'medical', `${p.name} 부상 복귀`, `${josa(p.name, '이/가')} 훈련에 복귀했습니다. 경기 감각을 끌어올리는 중입니다.`)
      }
    }
    const { intensity, focus } = club.training
    const rate = Math.min(0.95, RECOVERY_RATE[intensity] + (focus === 'recovery' ? RECOVERY_FOCUS_BONUS : 0))
    p.condition = Math.min(p.injury ? 75 : 100, Math.round(p.condition + (100 - p.condition) * rate))

    const injuryRate = TRAINING_INJURY[intensity] * (focus === 'recovery' ? 0.6 : 1)
    if (!p.injury && rng.chance(injuryRate)) {
      const weeks = rng.int(1, 3)
      p.injury = { type: '훈련 중 부상', weeks }
      if (isUser) addMessage(game, 'medical', `${p.name} 훈련 중 부상`, `훈련 도중 가벼운 부상을 입었습니다. ${weeks}주 정도 결장합니다.`)
    }
    p.morale = Math.round(p.morale + (65 - p.morale) * 0.08)
    p.history = [...p.history, ovr(p)].slice(-60)
  }
}

/** Every four rounds the coaches report who is improving or declining. */
function growthReport(game: GameState) {
  const club = game.clubs[game.userClubId]
  const changes = [...club.playerIds, ...club.youthIds]
    .map((id) => game.players[id])
    .filter((p) => p && p.history.length >= 5)
    .map((p) => ({ p, delta: p.history[p.history.length - 1] - p.history[p.history.length - 5] }))
  const up = changes.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4)
  const down = changes.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3)
  if (up.length === 0 && down.length === 0) return
  const fmt = (c: { p: Player; delta: number }) => `${c.p.name} ${c.delta > 0 ? '+' : ''}${c.delta} (${ovr(c.p)})`
  const parts = []
  if (up.length) parts.push(`성장: ${up.map(fmt).join(', ')}`)
  if (down.length) parts.push(`하락: ${down.map(fmt).join(', ')}`)
  addMessage(game, 'staff', '코치 보고서: 선수 성장', `최근 4경기 동안의 변화입니다. ${parts.join(' / ')}`)
}

function contractReminder(game: GameState) {
  const list = expiringPlayers(game, game.userClubId)
  if (list.length === 0) return
  addMessage(
    game,
    'board',
    `계약 만료 예정 ${list.length}명`,
    `${list.map((p) => p.name).join(', ')}의 계약이 이번 시즌으로 끝납니다. 시즌 결산 화면에서 재계약 여부를 정해 주세요.`,
  )
}

function boardReview(game: GameState, final: boolean) {
  const table = standingsOf(game)
  const rank = table.findIndex((r) => r.clubId === game.userClubId) + 1
  const target = game.objective.targetRank
  let body: string
  if (rank <= target) {
    body = final
      ? `최종 ${rank}위로 시즌 목표('${game.objective.label}')를 달성했습니다. 이사회는 매우 만족하고 있습니다.`
      : `현재 ${rank}위로 목표('${game.objective.label}')에 순항 중입니다. 지금의 흐름을 이어가 주세요.`
  } else if (rank <= target + 3) {
    body = final
      ? `최종 ${rank}위. 목표('${game.objective.label}')에는 조금 못 미쳤지만 다음 시즌을 기대하겠습니다.`
      : `현재 ${rank}위입니다. 목표('${game.objective.label}')까지 조금 더 분발이 필요합니다.`
  } else {
    body = final
      ? `최종 ${rank}위로 목표('${game.objective.label}')에 크게 못 미쳤습니다. 이사회의 인내심이 줄어들고 있습니다.`
      : `현재 ${rank}위로 목표('${game.objective.label}')와 거리가 있습니다. 이사회가 결과를 주시하고 있습니다.`
  }
  addMessage(game, 'board', final ? '시즌 종료 평가' : '전반기 평가', body)
}

/**
 * Finish the current round: record the user's match, simulate the other
 * fixtures, run weekly recovery / injuries and move to the next round.
 */
export function completeRound(input: GameState, userMatch: LiveMatch | null): GameState {
  const game = structuredClone(input)
  const rng = new Rng(game.rng)
  const fresh = new Set<string>()
  const apps: Appearances = new Map()
  const fixtures = roundFixtures(game)

  for (const fixture of fixtures) {
    if (fixture.result) continue
    const isUserFixture = fixture.homeId === game.userClubId || fixture.awayId === game.userClubId
    let m: LiveMatch
    if (isUserFixture && userMatch && userMatch.fixtureId === fixture.id) {
      m = structuredClone(userMatch)
      if (!m.finished) {
        // The assistant manager takes over the rest of the match.
        m.home.aiControlled = true
        m.away.aiControlled = true
        simulateToEnd(m, game)
      }
    } else {
      m = simulateToEnd(createMatch(fixture, game, matchSeed(game, fixture), game.userClubId), game)
    }
    const report = applyMatch(game, fixture, m, fresh, apps)
    if (isUserFixture) game.lastReport = report
  }

  weeklyUpdate(game, rng, fresh, apps)
  game.round++
  game.rng = rng.state

  const total = totalRounds(game)
  if (game.round % 4 === 0) growthReport(game)
  if (game.round === total - 5) contractReminder(game)
  if (game.round === Math.floor(total / 2)) boardReview(game, false)
  if (game.round >= total) boardReview(game, true)
  game.updatedAt = Date.now()
  return game.round >= total ? game : prepareRound(game)
}

export interface SeasonSummary {
  rank: number
  points: number
  championId: string
  topScorer: Player | null
  topScorerGoals: number
  bestPlayer: Player | null
  objectiveMet: boolean
}

export function seasonSummary(game: GameState): SeasonSummary {
  const table = computeStandings(game.clubOrder, game.fixtures)
  const idx = table.findIndex((r) => r.clubId === game.userClubId)
  const scorers = topScorers(game, 1)
  const own = game.clubs[game.userClubId].playerIds
    .map((id) => game.players[id])
    .filter((p) => p.stats.rated >= 5)
    .sort((a, b) => b.stats.ratingSum / b.stats.rated - a.stats.ratingSum / a.stats.rated)
  return {
    rank: idx + 1,
    points: table[idx]?.points ?? 0,
    championId: table[0].clubId,
    topScorer: scorers[0]?.player ?? null,
    topScorerGoals: scorers[0]?.value ?? 0,
    bestPlayer: own[0] ?? null,
    objectiveMet: idx + 1 <= game.objective.targetRank,
  }
}

export function startNewSeason(input: GameState, decisions: Record<string, ContractDecision> = {}): GameState {
  const game = structuredClone(input)
  const summary = seasonSummary(game)
  game.history = [
    ...game.history,
    {
      season: game.season,
      rank: summary.rank,
      points: summary.points,
      championId: summary.championId,
      topScorerId: summary.topScorer?.id ?? null,
      topScorerName: summary.topScorer?.name,
      topScorerGoals: summary.topScorerGoals,
    },
  ]
  const rng = new Rng(game.rng)
  const report = runOffseason(game, rng, decisions)
  game.season++
  game.round = 0
  for (const p of Object.values(game.players)) p.stats = emptyStats()
  game.fixtures = doubleRoundRobin(game.clubOrder, rng, game.season)
  const byRep = [...game.clubOrder].sort((a, b) => game.clubs[b].reputation - game.clubs[a].reputation)
  game.objective = objectiveFor(byRep.indexOf(game.userClubId) + 1)
  for (const id of game.clubOrder) {
    if (id === game.userClubId) continue
    const club = game.clubs[id]
    const { lineup, bench } = autoLineup(club, game.players)
    club.tactics = { ...club.tactics, lineup, bench }
  }
  game.rng = rng.state
  game.lastReport = null

  const list = (xs: string[]) => xs.join(', ')
  if (report.retired.length) addMessage(game, 'staff', `은퇴 ${report.retired.length}명`, `${list(report.retired)} 선수가 현역에서 은퇴했습니다.`)
  if (report.released.length) addMessage(game, 'staff', `계약 만료로 ${report.released.length}명 이별`, `${list(report.released)} 선수가 팀을 떠났습니다.`)
  if (report.renewed.length) addMessage(game, 'board', `재계약 ${report.renewed.length}명`, `${list(report.renewed)} 선수와 재계약했습니다.`)
  if (report.promoted.length) addMessage(game, 'staff', `유스 졸업 ${report.promoted.length}명`, `${list(report.promoted)} 선수가 1군으로 올라왔습니다.`)
  if (report.youthReleased.length) addMessage(game, 'staff', `유스 방출 ${report.youthReleased.length}명`, `${list(report.youthReleased)} 선수가 1군 수준에 이르지 못해 아카데미를 떠났습니다.`)
  if (report.signed.length) addMessage(game, 'board', `자유계약 영입 ${report.signed.length}명`, `선수단 인원을 채우기 위해 ${list(report.signed)} 선수를 영입했습니다.`)
  if (report.youthIn.length) addMessage(game, 'scout', `유스 입단 ${report.youthIn.length}명`, `새 유망주가 아카데미에 들어왔습니다: ${list(report.youthIn)}. 클럽 > 유스에서 확인하세요.`)
  addMessage(game, 'board', `시즌 ${game.season} 개막`, `새 시즌이 시작됩니다. 이사회의 목표는 '${game.objective.label}'입니다.`)
  game.updatedAt = Date.now()
  return prepareRound(game)
}
