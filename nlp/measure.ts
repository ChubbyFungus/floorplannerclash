const FEET_UNITS = ['feet', 'foot', 'ft', "'"];
const INCH_UNITS = ['inch', 'inches', 'in', '"'];

const NUMBER_WITH_OPTIONAL_FRACTION = /(\d+(?:\.\d+)?)/;

export function parseImperialToInches(input: string): number | null {
  if (!input) return null;
  const text = input.trim().toLowerCase();

  let total = 0;
  let matched = false;

  const feetMatch = text.match(new RegExp(`${NUMBER_WITH_OPTIONAL_FRACTION.source}\\s*(?:${FEET_UNITS.join('|')})`));
  if (feetMatch) {
    total += parseFloat(feetMatch[1]) * 12;
    matched = true;
  }

  const inchMatch = text.match(new RegExp(`${NUMBER_WITH_OPTIONAL_FRACTION.source}\\s*(?:${INCH_UNITS.join('|')})`));
  if (inchMatch) {
    total += parseFloat(inchMatch[1]);
    matched = true;
  }

  if (matched) {
    return Number(total.toFixed(2));
  }

  // Handle compact notations like 12'6"
  const compactMatch = text.match(/^(\d+)'(\d+)"?$/);
  if (compactMatch) {
    const feet = parseFloat(compactMatch[1]);
    const inches = parseFloat(compactMatch[2]);
    return Number((feet * 12 + inches).toFixed(2));
  }

  // Handle bare numbers - assume inches for values <= 96, otherwise feet
  const bareNumberMatch = text.match(NUMBER_WITH_OPTIONAL_FRACTION);
  if (bareNumberMatch) {
    const value = parseFloat(bareNumberMatch[1]);
    if (value <= 96) {
      return Number(value.toFixed(2));
    }
    return Number((value * 12).toFixed(2));
  }

  return null;
}

export interface DimensionsInFeet {
  width: number;
  depth: number;
}

export function parseDimensions(text: string): DimensionsInFeet | null {
  if (!text) return null;
  const normalized = text.toLowerCase();

  // Patterns like "12 feet by 10 feet" or "12ft x 10ft"
  const combinedPattern = new RegExp(
    `${NUMBER_WITH_OPTIONAL_FRACTION.source}\\s*(?:${[...FEET_UNITS, ...INCH_UNITS, ''].
      filter(Boolean).
      join('|')})?\\s*(?:x|by)\\s*${NUMBER_WITH_OPTIONAL_FRACTION.source}\\s*(?:${[...FEET_UNITS, ...INCH_UNITS, ''].
      filter(Boolean).
      join('|')})?`
  );

  const match = normalized.match(combinedPattern);
  if (match) {
    const widthRaw = match[1];
    const depthRaw = match[2];
    const widthUnitSegment = normalized.slice(match.index || 0, (match.index || 0) + match[0].length);
    const [widthUnit, depthUnit] = extractUnits(widthUnitSegment);

    const widthInches = interpretValue(widthRaw, widthUnit);
    const depthInches = interpretValue(depthRaw, depthUnit);

    if (widthInches && depthInches) {
      return inchesToFeet(widthInches, depthInches);
    }
  }

  // Patterns like "12 feet wide and 10 feet deep"
  const widthPattern = new RegExp(`${NUMBER_WITH_OPTIONAL_FRACTION.source}\\s*(?:${FEET_UNITS.join('|')})?\\s*(?:wide|width)`);
  const depthPattern = new RegExp(`${NUMBER_WITH_OPTIONAL_FRACTION.source}\\s*(?:${FEET_UNITS.join('|')})?\\s*(?:deep|depth)`);

  const widthMatch = normalized.match(widthPattern);
  const depthMatch = normalized.match(depthPattern);

  if (widthMatch && depthMatch) {
    const widthInches = interpretValue(widthMatch[1], extractUnit(widthMatch[0]));
    const depthInches = interpretValue(depthMatch[1], extractUnit(depthMatch[0]));

    if (widthInches && depthInches) {
      return inchesToFeet(widthInches, depthInches);
    }
  }

  return null;
}

function extractUnits(segment: string): [string | null, string | null] {
  const parts = segment.split(/x|by/);
  const widthUnit = extractUnit(parts[0]);
  const depthUnit = extractUnit(parts[1] || '');
  return [widthUnit, depthUnit];
}

function extractUnit(segment: string): string | null {
  const lowered = segment.toLowerCase();
  for (const unit of [...FEET_UNITS, ...INCH_UNITS]) {
    if (lowered.includes(unit)) {
      return unit;
    }
  }
  return null;
}

function interpretValue(raw: string, unit: string | null): number | null {
  if (!raw) return null;
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return null;

  if (!unit) {
    // Assume feet if the number is double digits, otherwise treat as feet if > 20
    if (value > 20) {
      return value * 12;
    }
    return value * 12;
  }

  if (FEET_UNITS.includes(unit)) {
    return value * 12;
  }

  if (INCH_UNITS.includes(unit)) {
    return value;
  }

  return null;
}

function inchesToFeet(widthInches: number, depthInches: number): DimensionsInFeet {
  return {
    width: Number((widthInches / 12).toFixed(2)),
    depth: Number((depthInches / 12).toFixed(2)),
  };
}
