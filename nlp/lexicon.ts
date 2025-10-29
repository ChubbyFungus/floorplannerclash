export type RoomCanonical = 'kitchen' | 'bathroom';
export type StyleCanonical = 'modern' | 'traditional' | 'transitional';
export type LayoutCanonical = 'L-shaped' | 'U-shaped' | 'straight' | 'galley';
export type ApplianceCanonical =
  | 'refrigerator'
  | 'dishwasher'
  | 'oven'
  | 'range'
  | 'cooktop'
  | 'sink'
  | 'microwave'
  | 'toilet'
  | 'bathtub'
  | 'shower'
  | 'vanity';

type LexiconMap<T extends string> = Record<T, string[]>;

const ROOM_SYNONYMS: LexiconMap<RoomCanonical> = {
  kitchen: ['kitchen', 'cookspace', 'cooking area', 'culinary zone'],
  bathroom: ['bathroom', 'bath', 'restroom', 'washroom', 'powder room'],
};

const STYLE_SYNONYMS: LexiconMap<StyleCanonical> = {
  modern: ['modern', 'contemporary', 'sleek', 'minimal'],
  traditional: ['traditional', 'classic', 'heritage'],
  transitional: ['transitional', 'blend', 'hybrid'],
};

const LAYOUT_SYNONYMS: LexiconMap<LayoutCanonical> = {
  'L-shaped': ['l-shaped', 'l shape', 'l-shaped layout'],
  'U-shaped': ['u-shaped', 'u shape', 'horseshoe', 'u-shaped layout'],
  straight: ['straight', 'single wall', 'one wall', 'linear'],
  galley: ['galley', 'corridor', 'parallel'],
};

const APPLIANCE_SYNONYMS: LexiconMap<ApplianceCanonical> = {
  refrigerator: ['refrigerator', 'fridge', 'icebox', 'builtin fridge'],
  dishwasher: ['dishwasher', 'dw'],
  oven: ['wall oven', 'built-in oven'],
  range: ['range', 'stove', 'cooker', 'slide-in', 'freestanding range'],
  cooktop: ['cooktop', 'hob'],
  sink: ['sink', 'basin', 'farm sink', 'farmhouse sink'],
  microwave: ['microwave', 'microwave oven'],
  toilet: ['toilet', 'wc', 'water closet'],
  bathtub: ['bathtub', 'tub', 'soaker tub'],
  shower: ['shower', 'walk-in shower', 'shower stall'],
  vanity: ['vanity', 'bath vanity'],
};

const FINISH_SYNONYMS: Record<string, string[]> = {
  'stainless-steel': ['stainless steel', 'stainless-steel', 'ss', 'stainless'],
  'panel-ready': ['panel ready', 'panel-ready', 'integrated front'],
  'matte-black': ['matte black', 'black matte'],
  'black': ['black'],
  'white': ['white'],
  'chrome': ['chrome', 'polished chrome'],
};

const CABINET_STYLE_SYNONYMS: Record<string, string[]> = {
  'flat-panel': ['flat-panel', 'slab', 'flat front', 'flat panel'],
  'sleek': ['sleek'],
  'shaker': ['shaker'],
  'raised-panel': ['raised-panel', 'raised panel'],
};

const COUNTERTOP_MATERIAL_SYNONYMS: Record<string, string[]> = {
  quartz: ['quartz'],
  granite: ['granite'],
  marble: ['marble'],
  'butcher-block': ['butcher block', 'butcher-block', 'wood block'],
  concrete: ['concrete'],
  'stainless-steel': ['stainless steel', 'stainless-steel'],
};

const FLOORING_SYNONYMS: Record<string, string[]> = {
  tile: ['tile', 'ceramic tile', 'porcelain tile'],
  hardwood: ['hardwood', 'wood floor', 'wood flooring'],
  laminate: ['laminate'],
  vinyl: ['vinyl', 'lvt'],
  stone: ['stone'],
  concrete: ['concrete'],
};

const COLOR_SYNONYMS: Record<string, string[]> = {
  white: ['white', 'bright white'],
  black: ['black', 'jet black'],
  gray: ['gray', 'grey', 'light gray', 'charcoal'],
  navy: ['navy', 'navy blue', 'blue'],
  wood: ['wood', 'walnut', 'oak', 'natural wood'],
  cream: ['cream', 'ivory'],
};

function findCanonical<T extends string>(text: string, lexicon: LexiconMap<T>): T | null {
  const normalized = text.toLowerCase();
  for (const [canonical, variants] of Object.entries(lexicon) as [T, string[]][]) {
    if (variants.some(variant => normalized.includes(variant))) {
      return canonical;
    }
  }
  return null;
}

function findCanonicalFromRecord(text: string, lexicon: Record<string, string[]>): string | null {
  const normalized = text.toLowerCase();
  for (const [canonical, variants] of Object.entries(lexicon)) {
    if (variants.some(variant => normalized.includes(variant))) {
      return canonical;
    }
  }
  return null;
}

export function normalizeRoomType(text: string): RoomCanonical | null {
  return findCanonical(text, ROOM_SYNONYMS);
}

export function normalizeStyle(text: string): StyleCanonical | null {
  return findCanonical(text, STYLE_SYNONYMS);
}

export function normalizeLayout(text: string): LayoutCanonical | null {
  return findCanonical(text, LAYOUT_SYNONYMS);
}

export function normalizeAppliance(text: string): ApplianceCanonical | null {
  return findCanonical(text, APPLIANCE_SYNONYMS);
}

export function normalizeFinish(text: string): string | null {
  return findCanonicalFromRecord(text, FINISH_SYNONYMS);
}

export function normalizeCabinetStyle(text: string): string | null {
  return findCanonicalFromRecord(text, CABINET_STYLE_SYNONYMS);
}

export function normalizeCountertopMaterial(text: string): string | null {
  return findCanonicalFromRecord(text, COUNTERTOP_MATERIAL_SYNONYMS);
}

export function normalizeFloorMaterial(text: string): string | null {
  return findCanonicalFromRecord(text, FLOORING_SYNONYMS);
}

export function normalizeColor(text: string): string | null {
  return findCanonicalFromRecord(text, COLOR_SYNONYMS);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function containsAny(text: string, values: string[]): boolean {
  const normalized = text.toLowerCase();
  return values.some(value => normalized.includes(value));
}
