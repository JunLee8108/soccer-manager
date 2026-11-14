import type { FormationId, Position } from '../types'

export interface Slot {
  pos: Position
  /** 0–100 from the left touchline. */
  x: number
  /** 0–100 from the opponent's goal line (top) to our own (bottom). */
  y: number
}

export interface Formation {
  id: FormationId
  label: string
  slots: Slot[]
}

const GK: Slot = { pos: 'GK', x: 50, y: 90 }

export const FORMATIONS: Record<FormationId, Formation> = {
  '4-3-3': {
    id: '4-3-3',
    label: '4-3-3',
    slots: [
      GK,
      { pos: 'LB', x: 13, y: 68 },
      { pos: 'CB', x: 37, y: 73 },
      { pos: 'CB', x: 63, y: 73 },
      { pos: 'RB', x: 87, y: 68 },
      { pos: 'DM', x: 50, y: 57 },
      { pos: 'CM', x: 27, y: 45 },
      { pos: 'CM', x: 73, y: 45 },
      { pos: 'LW', x: 16, y: 24 },
      { pos: 'ST', x: 50, y: 15 },
      { pos: 'RW', x: 84, y: 24 },
    ],
  },
  '4-4-2': {
    id: '4-4-2',
    label: '4-4-2',
    slots: [
      GK,
      { pos: 'LB', x: 13, y: 70 },
      { pos: 'CB', x: 37, y: 74 },
      { pos: 'CB', x: 63, y: 74 },
      { pos: 'RB', x: 87, y: 70 },
      { pos: 'LW', x: 14, y: 43 },
      { pos: 'CM', x: 37, y: 50 },
      { pos: 'CM', x: 63, y: 50 },
      { pos: 'RW', x: 86, y: 43 },
      { pos: 'ST', x: 36, y: 17 },
      { pos: 'ST', x: 64, y: 17 },
    ],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      GK,
      { pos: 'LB', x: 13, y: 70 },
      { pos: 'CB', x: 37, y: 74 },
      { pos: 'CB', x: 63, y: 74 },
      { pos: 'RB', x: 87, y: 70 },
      { pos: 'DM', x: 36, y: 56 },
      { pos: 'DM', x: 64, y: 56 },
      { pos: 'LW', x: 16, y: 31 },
      { pos: 'AM', x: 50, y: 36 },
      { pos: 'RW', x: 84, y: 31 },
      { pos: 'ST', x: 50, y: 14 },
    ],
  },
  '4-1-4-1': {
    id: '4-1-4-1',
    label: '4-1-4-1',
    slots: [
      GK,
      { pos: 'LB', x: 13, y: 70 },
      { pos: 'CB', x: 37, y: 74 },
      { pos: 'CB', x: 63, y: 74 },
      { pos: 'RB', x: 87, y: 70 },
      { pos: 'DM', x: 50, y: 59 },
      { pos: 'LW', x: 14, y: 37 },
      { pos: 'CM', x: 36, y: 43 },
      { pos: 'CM', x: 64, y: 43 },
      { pos: 'RW', x: 86, y: 37 },
      { pos: 'ST', x: 50, y: 15 },
    ],
  },
  '3-5-2': {
    id: '3-5-2',
    label: '3-5-2',
    slots: [
      GK,
      { pos: 'CB', x: 27, y: 73 },
      { pos: 'CB', x: 50, y: 76 },
      { pos: 'CB', x: 73, y: 73 },
      { pos: 'LB', x: 11, y: 47 },
      { pos: 'DM', x: 50, y: 58 },
      { pos: 'CM', x: 31, y: 43 },
      { pos: 'CM', x: 69, y: 43 },
      { pos: 'RB', x: 89, y: 47 },
      { pos: 'ST', x: 37, y: 17 },
      { pos: 'ST', x: 63, y: 17 },
    ],
  },
  '5-3-2': {
    id: '5-3-2',
    label: '5-3-2',
    slots: [
      GK,
      { pos: 'LB', x: 10, y: 63 },
      { pos: 'CB', x: 30, y: 73 },
      { pos: 'CB', x: 50, y: 76 },
      { pos: 'CB', x: 70, y: 73 },
      { pos: 'RB', x: 90, y: 63 },
      { pos: 'CM', x: 28, y: 47 },
      { pos: 'DM', x: 50, y: 54 },
      { pos: 'CM', x: 72, y: 47 },
      { pos: 'ST', x: 37, y: 18 },
      { pos: 'ST', x: 63, y: 18 },
    ],
  },
}

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[]
