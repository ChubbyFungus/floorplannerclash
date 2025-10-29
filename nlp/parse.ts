import { Frame } from '@/src/state/frame';
import {
  normalizeAppliance,
  normalizeCabinetStyle,
  normalizeColor,
  normalizeCountertopMaterial,
  normalizeFinish,
  normalizeFloorMaterial,
  normalizeLayout,
  normalizeRoomType,
  normalizeStyle,
} from './lexicon';
import { DimensionsInFeet, parseDimensions, parseImperialToInches } from './measure';

export type Confidence = 'high' | 'medium' | 'low';

export interface ParsedStatement {
  field: string;
  value: unknown;
  confidence: Confidence;
  sourceText: string;
}

export interface ParseResult {
  framePatch: Partial<Frame>;
  statements: ParsedStatement[];
  leftovers: string[];
}

export interface ParseOptions {
  treatAsCnl?: boolean;
  priorFrame?: Frame;
}

type MutableAppliances = NonNullable<Frame['appliances']>;
type MutableCabinets = NonNullable<Frame['cabinets']>;
type MutableCountertops = NonNullable<Frame['countertops']>;

const SENTENCE_SPLIT_REGEX = /[\.!\?\n;]/;

export function parseUtterance(text: string, options: ParseOptions = {}): ParseResult {
  const priorFrame = options.priorFrame ?? {};
  const sentences = splitIntoSentences(text);

  const statements: ParsedStatement[] = [];
  const leftovers: string[] = [];

  const patch: Partial<Frame> = {};
  const appliances: MutableAppliances = {};
  const cabinets: MutableCabinets = {};
  const countertops: MutableCountertops = {};
  const dimensionPatch: Partial<Frame['dimensions']> = {};

  for (const sentence of sentences) {
    let matched = false;

    const room = normalizeRoomType(sentence);
    if (room) {
      patch.roomType = room;
      statements.push(statement('roomType', room, sentence));
      matched = true;
    }

    const style = normalizeStyle(sentence);
    if (style) {
      patch.style = style;
      statements.push(statement('style', style, sentence));
      matched = true;
    }

    const layout = normalizeLayout(sentence);
    if (layout) {
      patch.layout = layout;
      statements.push(statement('layout', layout, sentence));
      matched = true;
    }

    const dims = parseDimensions(sentence);
    if (dims) {
      if (dims.width) {
        dimensionPatch.width = dims.width;
        statements.push(statement('dimensions.width', dims.width, sentence));
      }
      if (dims.depth) {
        dimensionPatch.depth = dims.depth;
        statements.push(statement('dimensions.depth', dims.depth, sentence));
      }
      matched = true;
    } else {
      const singleDimension = parseSingleDimension(sentence);
      if (singleDimension) {
        if (singleDimension.width) {
          dimensionPatch.width = singleDimension.width;
          statements.push(statement('dimensions.width', singleDimension.width, sentence, 'medium'));
        }
        if (singleDimension.depth) {
          dimensionPatch.depth = singleDimension.depth;
          statements.push(statement('dimensions.depth', singleDimension.depth, sentence, 'medium'));
        }
        matched = true;
      }
    }

    const floor = detectFloorMaterial(sentence);
    if (floor) {
      patch.floorMaterial = floor;
      statements.push(statement('floorMaterial', floor, sentence, 'medium'));
      matched = true;
    }

    const cabinetUpdates = detectCabinetAttributes(sentence);
    if (cabinetUpdates) {
      Object.assign(cabinets, cabinetUpdates);
      for (const [field, value] of Object.entries(cabinetUpdates)) {
        statements.push(statement(`cabinets.${field}`, value, sentence, 'medium'));
      }
      matched = true;
    }

    const countertopUpdates = detectCountertopAttributes(sentence);
    if (countertopUpdates) {
      Object.assign(countertops, countertopUpdates);
      for (const [field, value] of Object.entries(countertopUpdates)) {
        statements.push(statement(`countertops.${field}`, value, sentence, 'medium'));
      }
      matched = true;
    }

    const applianceUpdates = detectApplianceAttributes(sentence);
    if (applianceUpdates) {
      mergeAppliances(appliances, applianceUpdates, sentence, statements);
      matched = true;
    }

    if (!matched) {
      leftovers.push(sentence.trim());
    }
  }

  if (Object.keys(appliances).length > 0) {
    patch.appliances = appliances;
  }

  if (Object.keys(dimensionPatch).length > 0) {
    patch.dimensions = {
      ...(priorFrame.dimensions ?? {}),
      ...dimensionPatch,
    } as Frame['dimensions'];
  }

  if (Object.keys(cabinets).length > 0) {
    patch.cabinets = cabinets;
  }

  if (Object.keys(countertops).length > 0) {
    patch.countertops = countertops;
  }

  return { framePatch: patch, statements, leftovers };
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_REGEX)
    .map(segment => segment.trim())
    .filter(Boolean);
}

function statement(field: string, value: unknown, sourceText: string, confidence: Confidence = 'high'): ParsedStatement {
  return { field, value, confidence, sourceText };
}

function parseSingleDimension(sentence: string): Partial<Frame['dimensions']> | null {
  const widthRegex = /(width|wide)/i;
  const depthRegex = /(depth|deep)/i;

  const updates: Partial<Frame['dimensions']> = {};

  if (widthRegex.test(sentence)) {
    const inches = parseImperialToInches(sentence);
    if (inches) {
      updates.width = Number((inches / 12).toFixed(2));
    }
  }

  if (depthRegex.test(sentence)) {
    const inches = parseImperialToInches(sentence);
    if (inches) {
      updates.depth = Number((inches / 12).toFixed(2));
    }
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

function detectFloorMaterial(sentence: string): string | null {
  if (!/floor/i.test(sentence)) return null;
  return normalizeFloorMaterial(sentence);
}

function detectCabinetAttributes(sentence: string): Partial<MutableCabinets> | null {
  if (!/cabinet/i.test(sentence)) return null;
  const updates: Partial<MutableCabinets> = {};

  const style = normalizeCabinetStyle(sentence);
  if (style) {
    updates.style = style;
  }

  const color = normalizeColor(sentence);
  if (color) {
    updates.color = color;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

function detectCountertopAttributes(sentence: string): Partial<MutableCountertops> | null {
  if (!/counter(top)?/i.test(sentence)) return null;
  const updates: Partial<MutableCountertops> = {};

  const material = normalizeCountertopMaterial(sentence);
  if (material) {
    updates.material = material;
  }

  const color = normalizeColor(sentence);
  if (color) {
    updates.color = color;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

type ApplianceUpdate = Record<string, { type?: string; finish?: string }>;

function detectApplianceAttributes(sentence: string): ApplianceUpdate | null {
  const lower = sentence.toLowerCase();
  const segments = sentence.split(/,| and /i).map(segment => segment.trim()).filter(Boolean);

  const updates: ApplianceUpdate = {};

  for (const segment of segments) {
    const appliance = normalizeAppliance(segment);
    if (!appliance) continue;

    const normalizedKey = mapApplianceKey(appliance);
    updates[normalizedKey] = {
      type: deriveApplianceType(appliance, segment, lower),
      finish: normalizeFinish(segment) ?? undefined,
    };
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

function mergeAppliances(
  appliances: MutableAppliances,
  updates: ApplianceUpdate,
  sentence: string,
  statements: ParsedStatement[]
): void {
  for (const [key, value] of Object.entries(updates)) {
    if (!appliances[key as keyof MutableAppliances]) {
      appliances[key as keyof MutableAppliances] = { type: '' };
    }
    const target = appliances[key as keyof MutableAppliances] as { type?: string; finish?: string };

    if (value.type) {
      target.type = value.type;
      statements.push(statement(`appliances.${key}.type`, value.type, sentence, 'medium'));
    }
    if (value.finish) {
      target.finish = value.finish;
      statements.push(statement(`appliances.${key}.finish`, value.finish, sentence, 'medium'));
    }
  }
}

function mapApplianceKey(appliance: string): keyof MutableAppliances {
  if (appliance === 'range' || appliance === 'cooktop') return 'oven';
  return appliance as keyof MutableAppliances;
}

function deriveApplianceType(appliance: string, segment: string, lowerSentence: string): string | undefined {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  switch (appliance) {
    case 'refrigerator': {
      if (/french/i.test(segment)) return 'french-door';
      if (/side[-\s]?by[-\s]?side/.test(segment)) return 'side-by-side';
      if (/bottom[-\s]?freezer/.test(segment)) return 'bottom-freezer';
      if (/panel[-\s]?ready/.test(segment)) return 'panel-ready';
      return 'standard';
    }
    case 'dishwasher': {
      if (/drawer/.test(segment)) return 'double-drawer';
      if (/18.?in/.test(lowerSentence)) return '18-inch';
      return '24-inch';
    }
    case 'oven': {
      if (/wall/.test(segment)) return 'wall-oven';
      if (/double/.test(segment)) return 'double-wall-oven';
      if (/steam/.test(segment)) return 'steam-oven';
      break;
    }
    case 'range': {
      if (/slide[-\s]?in/.test(segment)) return 'slide-in-range';
      if (/induction/.test(segment)) return 'induction-range';
      if (/dual[-\s]?fuel/.test(segment)) return 'dual-fuel-range';
      return 'freestanding-range';
    }
    case 'sink': {
      if (/farm(house)?/.test(segment)) return 'farmhouse';
      if (/double/.test(segment)) return 'double-basin';
      if (/single/.test(segment)) return 'single-basin';
      return 'under-mount';
    }
    case 'toilet': {
      if (/wall/.test(segment)) return 'wall-mounted';
      if (/comfort/.test(segment)) return 'comfort-height';
      return 'two-piece';
    }
    case 'bathtub': {
      if (/freestanding/.test(segment)) return 'freestanding';
      if (/clawfoot/.test(segment)) return 'clawfoot';
      return 'alcove';
    }
    case 'shower': {
      if (/walk[-\s]?in/.test(segment)) return 'walk-in';
      if (/neo[-\s]?angle/.test(segment)) return 'neo-angle';
      return 'alcove';
    }
    case 'vanity': {
      if (/floating/.test(segment)) return 'floating';
      if (/double/.test(segment)) return 'double-vanity';
      return 'freestanding';
    }
  }

  return slug(segment);
}
