import { createChatCompletion, ChatMessage } from './ollamaClient';
import { frameManager, Frame as StateFrame } from '../../src/state/frame';
import { mergeRules, EffectiveRules } from '../../src/lib/rulesEngine';
import { parseUtterance } from '../../nlp/parse';
import {
  normalizeStyle,
  normalizeRoomType,
  normalizeLayout,
  normalizeFinish,
  normalizeCabinetStyle,
  normalizeColor,
  normalizeCountertopMaterial,
} from '../../nlp/lexicon';
import { parseDimensions } from '../../nlp/measure';
import { buildScene, Scene, SceneWarning } from '../scene/sceneBuilder';
import type { Choice, Frame } from '../../types';

const MODEL_NAME =
  process.env.LLM_MODEL_NAME || 'gemma2:2b-instruct-q4_K_M'; // Default local reasoning model

const sanitizeModelOutput = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

const isLlmDisabled = () =>
  process.env.LLM_DISABLED === 'true' ||
  process.env.LLM_DISABLED === '1' ||
  process.env.LLM_DISABLED === 'yes';

export interface ReasoningContext {
  frame: StateFrame;
  effectiveRules: EffectiveRules;
  missingFields: string[];
  conversationHistory: ChatMessage[];
}

/**
 * Selects the next most important question to ask the user based on the current frame state
 * @param frameMin - Current frame state
 * @param missing - Array of missing field paths
 * @param effectiveRules - Compiled rules for the room type and style
 * @param styleHints - Optional style-specific hints
 * @returns The next question to ask the user
 */
export const selectNextQuestion = async (
  frameMin: StateFrame,
  missing: string[],
  effectiveRules: EffectiveRules,
  styleHints?: string[]
): Promise<string> => {
  if (isLlmDisabled()) {
    return getFallbackQuestion(missing, frameMin);
  }

  const context: ReasoningContext = {
    frame: frameMin,
    effectiveRules,
    missingFields: missing,
    conversationHistory: [], // This would be populated from actual conversation history
  };

  const systemPrompt = `You are an expert kitchen/bathroom design assistant. Your task is to analyze the current design state and select the SINGLE most important question to ask next.

Think through the reasoning silently; do not emit any analysis, explanation, or <think> tags in the final reply.

CRITICAL RULES:
1. Ask ONLY ONE question at a time
2. Prioritize questions that will reduce the most missing fields
3. For kitchens: roomType, style, dimensions are highest priority, then appliances (refrigerator > oven > sink)
4. For bathrooms: roomType, style, dimensions are highest priority, then toilet
5. Style-specific requirements must be satisfied before general preferences
6. Never ask about information already provided
7. Keep questions clear and specific

Current State Analysis:
- Room Type: ${context.frame.roomType || 'unknown'}
- Style: ${context.frame.style || 'unknown'}
- Dimensions: ${context.frame.dimensions ? `${context.frame.dimensions.width}x${context.frame.dimensions.depth}` : 'unknown'}
- Missing Fields: ${context.missingFields.join(', ')}

Return only the question text, with no explanations, no prefixes, and no <think> tags.`;

  const userPrompt = `Based on this design state, what is the single most important question to ask next?

Frame: ${JSON.stringify(frameMin, null, 2)}
Missing: ${missing.join(', ')}
Effective Rules: ${JSON.stringify(effectiveRules, null, 2)}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await createChatCompletion({
      model: MODEL_NAME,
      messages,
      temperature: 0.1, // Low temperature for deterministic reasoning
      max_tokens: 200,
    });

    return sanitizeModelOutput(response.choices[0].message.content || '');
  } catch (error) {
    console.error('Error in selectNextQuestion:', error);
    // Fallback to simple priority-based selection
    return getFallbackQuestion(missing, frameMin);
  }
};

/**
 * Converts natural language user input to Controlled Natural Language (CNL) for parsing
 * @param text - User's natural language input
 * @returns CNL version optimized for deterministic parsing
 */
export const paraphraseToCNL = async (text: string): Promise<string> => {
  if (isLlmDisabled()) {
    return text;
  }

  const systemPrompt = `You are a natural language processing expert. Your task is to convert user input about kitchen/bathroom design into clear, structured Controlled Natural Language (CNL) that can be reliably parsed.

Do all reasoning silently; the final response must be the CNL string only, with no explanations and no <think> tags.

CNL RULES:
1. Use precise, unambiguous language
2. Specify measurements in feet/inches clearly (e.g., "12 feet wide", "36 inches high")
3. Use standard terminology (e.g., "L-shaped layout", "stainless steel finish")
4. Break complex requests into simple statements
5. Maintain the original meaning while making it more structured

Examples:
Input: "I want a big kitchen with white cabinets and granite counters"
CNL: "Kitchen dimensions: 15 feet wide, 12 feet deep. Cabinet color: white. Countertop material: granite."

Input: "Make the bathroom modern with a walk-in shower"
CNL: "Bathroom style: modern. Shower type: walk-in."

Return only the CNL output, with no additional text or <think> tags.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Convert this to CNL: "${text}"` },
  ];

  try {
    const response = await createChatCompletion({
      model: MODEL_NAME,
      messages,
      temperature: 0.0, // Zero temperature for consistent CNL conversion
      max_tokens: 300,
    });

    return sanitizeModelOutput(response.choices[0].message.content || '');
  } catch (error) {
    console.error('Error in paraphraseToCNL:', error);
    // Return original text as fallback
    return text;
  }
};

/**
 * Fallback question selection when LLM is unavailable
 */
function getFallbackQuestion(missing: string[], frame: StateFrame): string {
  // Priority order for questions
  const priorities = [
    'roomType',
    'style',
    'dimensions',
    'appliances.refrigerator.type',
    'appliances.oven.type',
    'appliances.sink.type',
    'appliances.toilet.type',
    'layout',
    'cabinets.style',
    'cabinets.color',
    'countertops.material',
  ];

  for (const priority of priorities) {
    if (missing.includes(priority)) {
      return getQuestionForField(priority, frame);
    }
  }

  // If no high-priority missing fields, ask about general preferences
  return "What other design preferences do you have for your space?";
}

/**
 * Generate appropriate question for a specific missing field
 */
function getQuestionForField(field: string, frame: StateFrame): string {
  const questions: Record<string, string> = {
    'roomType': 'Are you designing a kitchen or bathroom?',
    'style': 'What style do you prefer: modern, traditional, or transitional?',
    'dimensions': 'What are the dimensions of your room (width and depth in feet)?',
    'appliances.refrigerator.type': 'What type of refrigerator would you like?',
    'appliances.refrigerator.finish': 'What finish should the refrigerator have?',
    'appliances.oven.type': 'What type of oven or range would you prefer?',
    'appliances.oven.finish': 'What finish should the oven or range have?',
    'appliances.sink.type': 'What type of sink would you like?',
    'appliances.sink.finish': 'What finish should the sink have?',
    'appliances.toilet.type': 'What type of toilet would you like?',
    'layout': 'What layout do you prefer (L-shaped, U-shaped, straight, or galley)?',
    'cabinets.style': 'What style of cabinets would you like?',
    'cabinets.color': 'What color or finish would you like for the cabinets?',
    'countertops.material': 'What material would you like for the countertops?',
  };

  return questions[field] || `What would you like for ${field}?`;
}

/**
 * Main reasoning function that orchestrates the conversation flow
 */
export const processUserInput = async (userInput: string, conversationHistory: ChatMessage[] = []): Promise<{
  question?: string;
  frameUpdates?: Partial<StateFrame>;
  isComplete: boolean;
  scene?: Scene;
  sceneWarnings?: SceneWarning[];
  choices?: Choice[];
}> => {
  // Get current frame state
  const currentFrame = frameManager.getFrame();
  const missingFields = frameManager.listMissingOrLowConfidence();
  const normalizedInput = userInput.trim().toLowerCase();
  const finishIntents = ['finish', 'done', 'complete', 'finalize', 'ship it', 'looks good', 'good to go'];
  const wantsFinish = finishIntents.includes(normalizedInput);

  // If frame is complete, no more questions needed
  if (missingFields.length === 0) {
    try {
      const sceneResult = buildScene(currentFrame as Frame);
      return {
        isComplete: true,
        scene: sceneResult.scene,
        sceneWarnings: sceneResult.warnings,
      };
    } catch (error: any) {
      return {
        isComplete: true,
        sceneWarnings: [
          {
            code: 'SCENE_BUILD_FAILED',
            message: error?.message || 'Failed to build deterministic scene.',
            severity: 'high',
          },
        ],
      };
    }
  }

  if (wantsFinish && missingFields.length > 0) {
    const summary = formatMissingSummary(missingFields, currentFrame as StateFrame);
    const choiceSet = buildChoicesForField(missingFields[0], currentFrame as StateFrame);
    return {
      question: summary,
      frameUpdates: undefined,
      isComplete: false,
      choices: choiceSet.length ? choiceSet : undefined,
    };
  }

  // Parse user input to extract frame updates
  const cnlInput = await paraphraseToCNL(userInput);
  let parseResult = parseUtterance(cnlInput, { priorFrame: currentFrame as StateFrame });

  if (parseResult.statements.length === 0 && cnlInput !== userInput) {
    parseResult = parseUtterance(userInput, { priorFrame: currentFrame as StateFrame });
  }

  let frameUpdates = parseResult.framePatch;

  if (!frameUpdates || Object.keys(frameUpdates).length === 0) {
    const fallbackUpdate = inferDirectAnswer(userInput, missingFields, currentFrame as StateFrame);
    if (fallbackUpdate) {
      frameUpdates = fallbackUpdate;
    }
  }

  // Apply any updates to frame
  if (frameUpdates && Object.keys(frameUpdates).length > 0) {
    frameManager.apply(frameUpdates);
  }

  // Re-check missing fields after updates
  const updatedMissing = frameManager.listMissingOrLowConfidence();

  if (updatedMissing.length === 0) {
    try {
      const sceneResult = buildScene(frameManager.getFrame() as Frame);
      return {
        isComplete: true,
        frameUpdates,
        scene: sceneResult.scene,
        sceneWarnings: sceneResult.warnings,
      };
    } catch (error: any) {
      return {
        isComplete: true,
        frameUpdates,
        sceneWarnings: [
          {
            code: 'SCENE_BUILD_FAILED',
            message: error?.message || 'Failed to build deterministic scene.',
            severity: 'high',
          },
        ],
      };
    }
  }

  // Get effective rules for reasoning context
  const effectiveRules = mergeRules(
    currentFrame.roomType || 'kitchen',
    currentFrame.style || 'modern',
    [] // SKU refs would be populated from catalog
  );

  const choiceSet = buildChoicesForField(updatedMissing[0], frameManager.getFrame() as StateFrame);

  // Select next question
  const nextQuestion = await selectNextQuestion(
    frameManager.getFrame() as StateFrame,
    updatedMissing,
    effectiveRules
  );

  return {
    question: nextQuestion,
    frameUpdates,
    isComplete: false,
    choices: choiceSet.length > 0 ? choiceSet : undefined,
  };
};

function formatFinishToken(token: string): string {
  return token.replace(/-/g, '_');
}

function buildChoicesForField(field: string | undefined, frame: StateFrame): Choice[] {
  if (!field) return [];

  if (field === 'style') {
    return [
      { name: 'Modern', description: 'Clean lines, flat panels, integrated appliances.', material: 'style_modern' },
      { name: 'Traditional', description: 'Warm shaker profiles with classic trim.', material: 'style_traditional' },
      { name: 'Transitional', description: 'Balanced mix of modern and traditional details.', material: 'style_transitional' },
    ];
  }

  if (field === 'layout') {
    return [
      { name: 'L-Shaped', description: 'Two connected runs with open center.', material: 'layout_L-shaped' },
      { name: 'U-Shaped', description: 'Three runs forming a horseshoe.', material: 'layout_U-shaped' },
      { name: 'Galley', description: 'Parallel runs with a central work aisle.', material: 'layout_galley' },
      { name: 'Straight', description: 'Single wall run, perfect for compact spaces.', material: 'layout_straight' },
    ];
  }

  if (field.startsWith('appliances.refrigerator.type')) {
    return [
      { name: 'French Door', description: 'Wide fridge with drawer freezer.', material: 'refrigerator_type_french-door_stainless_steel' },
      { name: 'Side-by-Side', description: 'Tall fridge and freezer columns.', material: 'refrigerator_type_side-by-side_stainless_steel' },
      { name: 'Bottom Freezer', description: 'Top fridge with lower pull-out freezer.', material: 'refrigerator_type_bottom-freezer_panel_ready' },
      { name: 'Column', description: 'Integrated refrigerator column.', material: 'refrigerator_type_column_panel_ready' },
    ];
  }

  if (field.startsWith('appliances.refrigerator.finish')) {
    const type = frame.appliances?.refrigerator?.type || 'french-door';
    return [
      { name: 'Panel Ready', description: 'Blend into cabinetry panels.', material: `refrigerator_type_${type}_${formatFinishToken('panel-ready')}` },
      { name: 'Stainless Steel', description: 'Classic pro-style stainless.', material: `refrigerator_type_${type}_${formatFinishToken('stainless-steel')}` },
      { name: 'Matte Black', description: 'Bold matte black facade.', material: `refrigerator_type_${type}_${formatFinishToken('matte-black')}` },
    ];
  }

  if (field.startsWith('appliances.oven.type')) {
    return [
      { name: 'Slide-In Range', description: 'Combined cooktop/oven with front controls.', material: 'oven_type_range_stainless_steel' },
      { name: 'Wall Oven', description: 'Single wall oven for tall cabinets.', material: 'oven_type_wall-oven_stainless_steel' },
      { name: 'Double Wall Oven', description: 'Twin stacked wall ovens.', material: 'oven_type_wall-oven_panel_ready' },
    ];
  }

  if (field.startsWith('appliances.oven.finish')) {
    const type = frame.appliances?.oven?.type || 'range';
    return [
      { name: 'Stainless Steel', description: 'Professional stainless exterior.', material: `oven_type_${type}_${formatFinishToken('stainless-steel')}` },
      { name: 'Panel Ready', description: 'Match cabinetry with panels.', material: `oven_type_${type}_${formatFinishToken('panel-ready')}` },
      { name: 'Matte Black', description: 'Modern matte black appliance.', material: `oven_type_${type}_${formatFinishToken('matte-black')}` },
    ];
  }

  if (field.startsWith('appliances.sink.type')) {
    return [
      { name: 'Farmhouse', description: 'Apron-front farmhouse basin.', material: 'sink_type_farmhouse_stainless_steel' },
      { name: 'Single Basin', description: 'Large uninterrupted basin.', material: 'sink_type_single-basin_stainless_steel' },
      { name: 'Double Basin', description: 'Split basin for multitasking.', material: 'sink_type_double-basin_stainless_steel' },
    ];
  }

  if (field.startsWith('appliances.sink.finish')) {
    const type = frame.appliances?.sink?.type || 'single-basin';
    return [
      { name: 'Stainless Steel', description: 'Durable stainless finish.', material: `sink_type_${type}_${formatFinishToken('stainless-steel')}` },
      { name: 'White', description: 'Bright white fireclay look.', material: `sink_type_${type}_${formatFinishToken('white')}` },
      { name: 'Chrome', description: 'High-shine chrome basin.', material: `sink_type_${type}_${formatFinishToken('chrome')}` },
    ];
  }

  if (field.startsWith('appliances.toilet.type')) {
    return [
      { name: 'Wall Mounted', description: 'Floating wall-hung bowl.', material: 'toilet_type_wall-mounted_white_porcelain' },
      { name: 'Comfort Height', description: 'ADA-friendly comfort height.', material: 'toilet_type_comfort-height_white_porcelain' },
      { name: 'Two Piece', description: 'Classic two-piece design.', material: 'toilet_type_two-piece_white_porcelain' },
    ];
  }

  if (field === 'cabinets.style' || field.includes('cabinets.style')) {
    return [
      { name: 'Flat Panel', description: 'Sleek slab cabinet fronts.', material: 'cabinet_style_flat-panel' },
      { name: 'Shaker', description: 'Timeless recessed panel.', material: 'cabinet_style_shaker' },
      { name: 'Raised Panel', description: 'Traditional raised center.', material: 'cabinet_style_raised-panel' },
    ];
  }

  if (field === 'cabinets.color' || field.includes('cabinets.color')) {
    return [
      { name: 'White', description: 'Crisp painted white finish.', material: 'cabinet_color_white' },
      { name: 'Natural Wood', description: 'Warm natural wood tones.', material: 'cabinet_color_light-wood' },
      { name: 'Navy', description: 'Rich blue cabinetry.', material: 'cabinet_color_dark-gray' },
    ];
  }

  if (field === 'countertops.material' || field.includes('countertops.material')) {
    return [
      { name: 'Quartz', description: 'Durable engineered quartz surface.', material: 'countertop_material_quartz' },
      { name: 'Granite', description: 'Natural granite movement.', material: 'countertop_material_granite' },
      { name: 'Marble', description: 'Elegant veined marble.', material: 'countertop_material_marble' },
    ];
  }

  return [];
}

function formatMissingSummary(missing: string[], frame: StateFrame): string {
  if (!missing.length) {
    return 'All set! Reply with "finish" if you want to finalize.';
  }

  const descriptions = missing.map(field => {
    switch (field) {
      case 'roomType':
        return 'room type (kitchen or bathroom)';
      case 'style':
        return 'design style';
      case 'dimensions':
        return 'room dimensions (width × depth in feet)';
      case 'layout':
        return 'layout preference';
      case 'appliances.refrigerator.type':
        return 'refrigerator type';
      case 'appliances.refrigerator.finish':
        return 'refrigerator finish';
      case 'appliances.oven.type':
        return 'oven/range type';
      case 'appliances.oven.finish':
        return 'oven/range finish';
      case 'appliances.sink.type':
        return 'sink style';
      case 'appliances.sink.finish':
        return 'sink finish';
      case 'appliances.toilet.type':
        return 'toilet selection';
      case 'cabinets.style':
        return 'cabinet door style';
      case 'cabinets.color':
        return 'cabinet color or stain';
      case 'countertops.material':
        return 'countertop material';
      case 'countertops.color':
        return 'countertop color';
      default:
        return field.replace(/\./g, ' ');
    }
  });

  const list = descriptions.slice(0, 3).join(', ') + (descriptions.length > 3 ? ', …' : '');
  const nextField = missing[0];
  const hint = buildChoicesForField(nextField, frame).length
    ? 'You can tap a card or tell me directly.'
    : 'Share those details when you are ready.';

  return `I still need: ${list}. ${hint}`;
}

function inferDirectAnswer(answer: string, pending: string[], frame: StateFrame): Partial<StateFrame> | null {
  const trimmed = answer.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  for (const field of pending) {
    if (field === 'roomType') {
      const roomType = normalizeRoomType(trimmed);
      if (roomType) return { roomType };
    }

    if (field === 'style') {
      const style = normalizeStyle(trimmed);
      if (style) return { style };
    }

    if (field === 'layout') {
      const layout = normalizeLayout(trimmed);
      if (layout) return { layout };
    }

    if (field === 'dimensions') {
      const dims = parseDimensions(trimmed);
      if (dims) {
        return {
          dimensions: {
            width: dims.width,
            depth: dims.depth,
          },
        };
      }
    }

    if (field.startsWith('appliances.refrigerator.type')) {
      const type = detectRefrigeratorType(lower);
      if (type) return buildAppliancePatch(frame, 'refrigerator', { type });
    }

    if (field.startsWith('appliances.refrigerator.finish')) {
      const finish = normalizeFinish(trimmed);
      if (finish) return buildAppliancePatch(frame, 'refrigerator', { finish });
    }

    if (field.startsWith('appliances.oven.type')) {
      const type = detectOvenType(lower);
      if (type) return buildAppliancePatch(frame, 'oven', { type });
    }

    if (field.startsWith('appliances.oven.finish')) {
      const finish = normalizeFinish(trimmed);
      if (finish) return buildAppliancePatch(frame, 'oven', { finish });
    }

    if (field.startsWith('appliances.sink.type')) {
      const type = detectSinkType(lower);
      if (type) return buildAppliancePatch(frame, 'sink', { type });
    }

    if (field.startsWith('appliances.sink.finish')) {
      const finish = normalizeFinish(trimmed);
      if (finish) return buildAppliancePatch(frame, 'sink', { finish });
    }

    if (field.startsWith('appliances.toilet.type')) {
      const type = detectToiletType(lower);
      if (type) return buildAppliancePatch(frame, 'toilet', { type });
    }

    if (field === 'cabinets.style' || field.includes('cabinets.style')) {
      const style = normalizeCabinetStyle(trimmed);
      if (style) {
        return {
          cabinets: {
            ...(frame.cabinets ?? {}),
            style,
          },
        };
      }
    }

    if (field === 'cabinets.color' || field.includes('cabinets.color')) {
      const color = normalizeColor(trimmed);
      if (color) {
        return {
          cabinets: {
            ...(frame.cabinets ?? {}),
            color,
          },
        };
      }
    }

    if (field === 'countertops.material' || field.includes('countertops.material')) {
      const material = normalizeCountertopMaterial(trimmed);
      if (material) {
        return {
          countertops: {
            ...(frame.countertops ?? {}),
            material,
          },
        };
      }
    }

    if (field === 'countertops.color' || field.includes('countertops.color')) {
      const color = normalizeColor(trimmed);
      if (color) {
        return {
          countertops: {
            ...(frame.countertops ?? {}),
            color,
          },
        };
      }
    }
  }

  return null;
}

function buildAppliancePatch(
  frame: StateFrame,
  key: keyof NonNullable<StateFrame['appliances']>,
  updates: { type?: string; finish?: string }
): Partial<StateFrame> {
  return {
    appliances: {
      ...(frame.appliances ?? {}),
      [key]: {
        ...(frame.appliances?.[key] ?? {}),
        ...updates,
      },
    },
  };
}

function detectRefrigeratorType(text: string): string | null {
  if (/french/.test(text) && /door/.test(text)) return 'french-door';
  if (/side\s*by\s*side/.test(text)) return 'side-by-side';
  if (/bottom/.test(text) && /freezer/.test(text)) return 'bottom-freezer';
  if (/column/.test(text)) return 'column';
  if (/panel/.test(text)) return 'panel-ready';
  return null;
}

function detectOvenType(text: string): string | null {
  if (/wall/.test(text)) return 'wall-oven';
  if (/double/.test(text)) return 'double-wall-oven';
  if (/steam/.test(text)) return 'steam-oven';
  if (/slide/.test(text)) return 'slide-in-range';
  if (/range/.test(text)) return 'freestanding-range';
  return null;
}

function detectSinkType(text: string): string | null {
  if (/farm/.test(text)) return 'farmhouse';
  if (/double/.test(text)) return 'double-basin';
  if (/single/.test(text)) return 'single-basin';
  if (/apron/.test(text)) return 'farmhouse';
  return null;
}

function detectToiletType(text: string): string | null {
  if (/comfort/.test(text)) return 'comfort-height';
  if (/wall/.test(text)) return 'wall-mounted';
  if (/one\s*piece/.test(text)) return 'one-piece';
  if (/two\s*piece/.test(text)) return 'two-piece';
  return null;
}
