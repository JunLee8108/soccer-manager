export interface ClubSeed {
  id: string
  name: string
  short: string
  crest: string
  color: string
  reputation: number
  stadium: string
  capacity: number
}

/** Fictional league: 슈퍼 디비전. */
export const LEAGUE_NAME = '슈퍼 디비전'

export const CLUB_SEEDS: readonly ClubSeed[] = [
  { id: 'baekdu', name: '백두 시티', short: '백두', crest: 'BD', color: '#F87171', reputation: 82, stadium: '백두 스타디움', capacity: 42000 },
  { id: 'haeoreum', name: '해오름 SC', short: '해오름', crest: 'HO', color: '#FBBF24', reputation: 79, stadium: '해오름 파크', capacity: 36000 },
  { id: 'eunha', name: '은하 로버스', short: '은하', crest: 'ER', color: '#818CF8', reputation: 76, stadium: '은하 그라운드', capacity: 33000 },
  { id: 'hanbit', name: '한빛 유나이티드', short: '한빛', crest: 'HU', color: '#A3E635', reputation: 74, stadium: '한빛 아레나', capacity: 28000 },
  { id: 'noeul', name: '노을 애슬레틱', short: '노을', crest: 'NA', color: '#FB923C', reputation: 72, stadium: '노을 스타디움', capacity: 26000 },
  { id: 'cheongram', name: '청람 FC', short: '청람', crest: 'CR', color: '#60A5FA', reputation: 71, stadium: '청람 필드', capacity: 25000 },
  { id: 'pureunbyeol', name: '푸른별 FC', short: '푸른별', crest: 'PB', color: '#22D3EE', reputation: 69, stadium: '푸른별 구장', capacity: 22000 },
  { id: 'baramgol', name: '바람골 원더러스', short: '바람골', crest: 'BW', color: '#A78BFA', reputation: 67, stadium: '바람골 파크', capacity: 20000 },
  { id: 'geumgang', name: '금강 스타즈', short: '금강', crest: 'GS', color: '#94A3B8', reputation: 66, stadium: '금강 스타디움', capacity: 21000 },
  { id: 'saebyeok', name: '새벽 레인저스', short: '새벽', crest: 'SR', color: '#F472B6', reputation: 64, stadium: '새벽 아레나', capacity: 18000 },
  { id: 'mir', name: '미르 시티', short: '미르', crest: 'MC', color: '#34D399', reputation: 63, stadium: '미르 스타디움', capacity: 19000 },
  { id: 'dasom', name: '다솜 FC', short: '다솜', crest: 'DS', color: '#FCA5A5', reputation: 61, stadium: '다솜 그라운드', capacity: 15000 },
  { id: 'haneuljae', name: '하늘재 SC', short: '하늘재', crest: 'HJ', color: '#7DD3FC', reputation: 60, stadium: '하늘재 구장', capacity: 14000 },
  { id: 'neoul', name: '너울 FC', short: '너울', crest: 'NW', color: '#2DD4BF', reputation: 58, stadium: '너울 필드', capacity: 13000 },
  { id: 'garam', name: '가람 타운', short: '가람', crest: 'GT', color: '#FDE68A', reputation: 56, stadium: '가람 파크', capacity: 12000 },
  { id: 'byeolbit', name: '별빛 애슬레틱', short: '별빛', crest: 'BA', color: '#C084FC', reputation: 54, stadium: '별빛 스타디움', capacity: 11000 },
]
