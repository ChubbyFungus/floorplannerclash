export const ITEM_SYNONYMS = {
  dishwasher: ['dishwasher', 'dw'],
  refrigerator: ['fridge', 'refrigerator', 'ref'],
  sink: ['sink', 'kitchen sink'],
  stove: ['stove', 'range', 'cooktop', 'oven'],
  microwave: ['microwave', 'mwo'],
  cabinet: ['cabinet', 'base', 'base_cabinet', 'upper_cabinet', 'cab'],
  pantryTall: ['pantry', 'tall_pantry', 'pantry_tall', 'utility_cabinet_24d'],
  hood: ['hood', 'vent_hood', 'hood_vent'],
} as const;

export const DIRECTIONS = {
  left: ["left", "to the left"],
  right: ["right", "to the right"],
  center: ["center", "centre", "centered"],
  north: ["north"],
  south: ["south"],
  east: ["east"],
  west: ["west"],
} as const;

export const COMMAND_VERBS = ['put', 'place', 'add', 'install', 'position', 'locate', 'create', 'generate', 'make', 'build'] as const;

export const INTENTS = {
  place: ['put', 'add', 'insert'],
  move: ['move', 'shift', 'slide'],
} as const;
