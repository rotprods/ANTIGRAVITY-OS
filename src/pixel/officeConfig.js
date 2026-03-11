// ═══════════════════════════════════════════════════
// OCUL OFFICE — Building Config
// Tile map, room definitions, agent sprites
// ═══════════════════════════════════════════════════

export const TILE = 16       // logical pixels per tile
export const SCALE = 2       // canvas draw scale
export const COLS = 40       // building width in tiles
export const ROWS = 24       // building height in tiles
export const CORRIDOR_ROW = 12
export const CORRIDOR_H = 2
export const WALK_FRAMES = 90    // frames to walk entrance→workstation
export const SUCCESS_TTL = 100   // frames before success→offline
export const ERROR_TTL = 80

export const ROOMS = [
  // ─── TOP FLOOR ────────────────────────────────────────────────
  {
    id: 'command', label: 'COMMAND CTR', agent: 'cortex',
    color: '#6366f1', rgb: [99, 102, 241], floorColor: '#08080F',
    x: 0, y: 0, w: 10, h: 12,
    workstation: { lx: 4, ly: 8 },
    entrance:    { lx: 5, ly: 11 },
    description: 'Orchestration & Strategy',
    objects: [
      { type: 'tripleMonitor', lx: 1, ly: 2, label: 'WAR ROOM' },
      { type: 'roundTable',    lx: 3, ly: 6 },
      { type: 'statusBoard',   lx: 7, ly: 2, label: 'STATUS' },
    ],
  },
  {
    id: 'intel', label: 'INTEL OPS', agent: 'oracle',
    color: '#8b5cf6', rgb: [139, 92, 246], floorColor: '#0A090F',
    x: 10, y: 0, w: 10, h: 12,
    workstation: { lx: 4, ly: 8 },
    entrance:    { lx: 5, ly: 11 },
    description: 'Analytics & Intelligence',
    objects: [
      { type: 'dataScreen',  lx: 1, ly: 2, label: 'SIGNALS' },
      { type: 'chartBoard',  lx: 6, ly: 2, label: 'ANALYTICS' },
      { type: 'console',     lx: 3, ly: 7 },
    ],
  },
  {
    id: 'forge', label: 'FORGE STD', agent: 'forge',
    color: '#10b981', rgb: [16, 185, 129], floorColor: '#080F0B',
    x: 20, y: 0, w: 10, h: 12,
    workstation: { lx: 4, ly: 8 },
    entrance:    { lx: 5, ly: 11 },
    description: 'Content Generation',
    objects: [
      { type: 'typewriter',   lx: 1, ly: 2 },
      { type: 'contentBoard', lx: 6, ly: 2, label: 'PUBLISH' },
      { type: 'renderScreen', lx: 2, ly: 7 },
    ],
  },
  {
    id: 'broadcast', label: 'BROADCAST', agent: 'herald',
    color: '#facc15', rgb: [250, 204, 21], floorColor: '#0F0F08',
    x: 30, y: 0, w: 10, h: 12,
    workstation: { lx: 5, ly: 8 },
    entrance:    { lx: 5, ly: 11 },
    description: 'Briefings & Comms',
    objects: [
      { type: 'radioTower',  lx: 1, ly: 1 },
      { type: 'commsBoard',  lx: 5, ly: 2, label: 'BRIEFING' },
      { type: 'microphone',  lx: 3, ly: 7 },
    ],
  },
  // ─── BOTTOM FLOOR ─────────────────────────────────────────────
  {
    id: 'field', label: 'FIELD OPS', agent: 'atlas',
    color: '#3b82f6', rgb: [59, 130, 246], floorColor: '#08090F',
    x: 0, y: 14, w: 8, h: 10,
    workstation: { lx: 3, ly: 6 },
    entrance:    { lx: 4, ly: 0 },
    description: 'Geo Prospecting',
    objects: [
      { type: 'worldMap',   lx: 1, ly: 2 },
      { type: 'geoScanner', lx: 5, ly: 5 },
    ],
  },
  {
    id: 'hunt', label: 'HUNT ROOM', agent: 'hunter',
    color: '#f59e0b', rgb: [245, 158, 11], floorColor: '#0F0C08',
    x: 8, y: 14, w: 8, h: 10,
    workstation: { lx: 3, ly: 6 },
    entrance:    { lx: 4, ly: 0 },
    description: 'Lead Capture',
    objects: [
      { type: 'targetBoard', lx: 1, ly: 2 },
      { type: 'leadScanner', lx: 5, ly: 6 },
    ],
  },
  {
    id: 'security', label: 'SECURITY', agent: 'sentinel',
    color: '#ef4444', rgb: [239, 68, 68], floorColor: '#0F0808',
    x: 16, y: 14, w: 8, h: 10,
    workstation: { lx: 3, ly: 6 },
    entrance:    { lx: 4, ly: 0 },
    description: 'Threat Monitoring',
    objects: [
      { type: 'threatMonitor', lx: 1, ly: 2 },
      { type: 'alertLight',    lx: 6, ly: 3 },
      { type: 'cameraArray',   lx: 1, ly: 6 },
    ],
  },
  {
    id: 'outreach', label: 'OUTREACH', agent: 'outreach',
    color: '#ec4899', rgb: [236, 72, 153], floorColor: '#0F080B',
    x: 24, y: 14, w: 8, h: 10,
    workstation: { lx: 3, ly: 6 },
    entrance:    { lx: 4, ly: 0 },
    description: 'Messaging & Outreach',
    objects: [
      { type: 'phoneBank',  lx: 1, ly: 2 },
      { type: 'emailBoard', lx: 4, ly: 2 },
    ],
  },
  {
    id: 'nexus', label: 'NEXUS', agent: 'nexus',
    color: '#06b6d4', rgb: [6, 182, 212], floorColor: '#080C0F',
    x: 32, y: 14, w: 8, h: 10,
    workstation: { lx: 3, ly: 6 },
    entrance:    { lx: 4, ly: 0 },
    description: 'Network & Routing',
    objects: [
      { type: 'serverRack', lx: 1, ly: 1 },
      { type: 'netGraph',   lx: 4, ly: 3 },
    ],
  },
]

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map(r => [r.id, r]))

export const AGENT_CONFIG = {
  cortex:   { color: '#6366f1', dark: '#4338ca', room: 'command',   label: 'CORTEX' },
  oracle:   { color: '#8b5cf6', dark: '#6d28d9', room: 'intel',     label: 'ORACLE' },
  forge:    { color: '#10b981', dark: '#047857', room: 'forge',     label: 'FORGE' },
  herald:   { color: '#facc15', dark: '#92400e', room: 'broadcast', label: 'HERALD' },
  atlas:    { color: '#3b82f6', dark: '#1d4ed8', room: 'field',     label: 'ATLAS' },
  hunter:   { color: '#f59e0b', dark: '#b45309', room: 'hunt',      label: 'HUNTER' },
  sentinel: { color: '#ef4444', dark: '#b91c1c', room: 'security',  label: 'SENTINEL' },
  outreach: { color: '#ec4899', dark: '#be185d', room: 'outreach',  label: 'OUTREACH' },
  nexus:    { color: '#06b6d4', dark: '#0e7490', room: 'nexus',     label: 'NEXUS' },
}

// Pixel sprite frames — 8×12 color index grid
// 0=transparent  1=primary  2=skin  3=dark  4=white  5=secondary
export const SPRITE_FRAMES = {
  idle0: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,4,4,2,1,0],
    [0,0,1,2,2,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,5,5,5,5,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
  ],
  idle1: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,4,4,2,1,0],
    [0,0,1,2,2,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,5,5,5,5,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,0,0,1,0,0],
    [0,1,1,0,0,1,1,0],
  ],
  walk0: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,4,4,2,1,0],
    [0,0,1,2,2,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,5,5,5,5,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,0,0,0,0,0],
    [0,0,1,0,0,1,1,0],
  ],
  walk1: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,4,4,2,1,0],
    [0,0,1,2,2,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,5,5,5,5,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
    [0,0,0,0,0,1,1,0],
    [0,1,1,0,0,1,0,0],
  ],
  work: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,4,4,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,4,4,4,4,1,0],
    [0,0,1,2,2,1,0,0],
    [1,1,1,1,1,1,0,0],
    [1,5,5,5,5,5,0,0],
    [1,1,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,0,0,0,0],
    [0,0,0,1,0,0,0,0],
  ],
  success: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,1,4,4,4,4,1,0],
    [0,0,1,2,2,1,0,0],
    [1,0,1,1,1,1,0,1],
    [0,0,5,5,5,5,0,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
  ],
  error: [
    [0,0,1,1,1,1,0,0],
    [0,1,2,2,2,2,1,0],
    [0,1,3,2,2,3,1,0],
    [0,1,2,3,3,2,1,0],
    [0,1,2,2,2,2,1,0],
    [0,0,1,2,2,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,5,5,5,5,5,0,0],
    [0,1,1,1,0,0,0,0],
    [0,0,0,1,1,0,0,0],
    [0,0,0,1,0,0,0,0],
    [0,0,0,1,1,0,0,0],
  ],
}
