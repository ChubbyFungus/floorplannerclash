import type { Choice } from '../types';

type FetchLike = (input: any, init?: any) => Promise<any>;

const fetchImpl: FetchLike | undefined = (globalThis as any).fetch?.bind(globalThis);

const CONVERSATION_LLM_URL = process.env.CONVERSATION_LLM_URL ?? 'http://localhost:11434/api/chat';
const REASONING_LLM_URL = process.env.REASONING_LLM_URL ?? 'http://localhost:11434/api/generate';

const CONVERSATION_LLM_MODEL = process.env.CONVERSATION_LLM_MODEL ?? 'gemma2:2b-instruct-q4_K_M';
const REASONING_LLM_MODEL = process.env.REASONING_LLM_MODEL ?? 'deepseek-r1:7b-qwen-distill-q4_K_M';

const isReasoningDisabled = () => false;
const isQuestionRephrasingDisabled = () => process.env.DISABLE_QUESTION_REPHRASING === 'true';

function ensureFetch(): FetchLike {
  if (!fetchImpl) {
    throw new Error('Global fetch is not available. Please provide a fetch implementation for the local LLM services.');
  }

  return fetchImpl;
}

async function postChat<TResponse>(url: string, messages: any[], model: string, options?: any): Promise<TResponse> {
  const runtimeFetch = ensureFetch();

  const response = await runtimeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...options,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM chat request failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
}

async function postGenerate<TResponse>(url: string, prompt: string, model: string, options?: any): Promise<TResponse> {
  const runtimeFetch = ensureFetch();

  const response = await runtimeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      ...options,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM generate request failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function getInitialDesign(description: string): Promise<{ style: string; roomType: string; styleChoices: string[]; primaryColor?: string; accentColor?: string; }> {
  const messages = [
    { role: 'user', content: `You are a helpful design assistant. Analyze the user's request: '${description}'. Identify the 'roomType' (must be either "Kitchen" or "Bathroom"), the most likely 'style', and if specified, the 'primaryColor' and 'accentColor'. Return a JSON object with 'roomType', 'style', 'primaryColor' (optional), 'accentColor' (optional), and 'styleChoices' which should be a list of styles relevant to the user's request. The possible styles are [Modern, Traditional, Industrial, Farmhouse].` }
  ];

  const data = await postChat<any>(CONVERSATION_LLM_URL, messages, CONVERSATION_LLM_MODEL);
  // Basic parsing, assuming LLM returns a JSON string in the 'text' or 'reply' field.
  try {
    const rawContent = data.message.content;
    const jsonStartIndex = rawContent.indexOf('{');
    const jsonEndIndex = rawContent.lastIndexOf('}');

    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error('No JSON object found in LLM response.');
    }

    const jsonString = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
    const parsed = JSON.parse(jsonString);
    if (!parsed.style || !parsed.roomType || !parsed.styleChoices) {
      throw new Error('Initial design parse did not return the expected format.');
    }
    return {
      style: parsed.style,
      roomType: parsed.roomType,
      styleChoices: parsed.styleChoices,
      primaryColor: parsed.primaryColor || undefined,
      accentColor: parsed.accentColor || undefined,
    };
  } catch (e) {
    console.error("Failed to parse initial design from LLM", e);
    // Fallback if parsing fails
    return {
      style: 'Modern',
      roomType: 'Kitchen',
      styleChoices: ['Modern', 'Traditional', 'Industrial'],
      primaryColor: undefined,
      accentColor: undefined,
    };
  }
}

// Cache for rephrased questions to avoid repeated LLM calls
const questionCache = new Map<string, string>();

// Parameter parsing utilities
export interface ParsedParameter {
  value: any;
  isValid: boolean;
  error?: string;
  originalInput: string;
}

export function parseParameter(paramName: string, userInput: string, constraints?: any[]): ParsedParameter {
  const result: ParsedParameter = {
    value: null,
    isValid: false,
    originalInput: userInput
  };

  // Handle constrained parameters (multiple choice) - delegate to specific parser
  if (constraints && Array.isArray(constraints)) {
    return parseConstrainedChoice(userInput, constraints);
  }

  // Handle specific parameter types
  switch (paramName) {
    case 'roomType':
      return parseRoomType(userInput);
    case 'primaryColor':
    case 'accentColor':
      return parseColor(userInput);
    case 'widthIn':
    case 'depthIn':
    case 'heightIn':
      return parseDimension(userInput);
    case 'cabinetFinish':
    case 'countertopMaterial':
    case 'flooringType':
    case 'lightingStyle':
      return parseConstrainedChoice(userInput, constraints);
    default:
      // For unconstrained parameters, accept any non-empty input
      if (userInput.trim().length > 0) {
        result.value = userInput.trim();
        result.isValid = true;
      } else {
        result.error = 'Please provide a response';
      }
      return result;
  }
}

function parseRoomType(input: string): ParsedParameter {
  const result: ParsedParameter = {
    value: null,
    isValid: false,
    originalInput: input
  };

  const normalized = input.toLowerCase().trim();
  if (normalized.includes('kitchen')) {
    result.value = 'kitchen';
    result.isValid = true;
  } else if (normalized.includes('bathroom') || normalized.includes('bath')) {
    result.value = 'bathroom';
    result.isValid = true;
  } else {
    result.error = 'Please specify either "kitchen" or "bathroom"';
  }

  return result;
}

function parseColor(input: string): ParsedParameter {
  const result: ParsedParameter = {
    value: null,
    isValid: false,
    originalInput: input
  };

  const normalized = input.toLowerCase().trim();

  // Common color names
  const commonColors = [
    'white', 'black', 'gray', 'grey', 'blue', 'red', 'green', 'yellow',
    'brown', 'beige', 'cream', 'navy', 'maroon', 'olive', 'purple',
    'orange', 'pink', 'tan', 'ivory', 'charcoal', 'stainless', 'chrome'
  ];

  const colorMatch = commonColors.find(color =>
    normalized.includes(color) || color.includes(normalized)
  );

  if (colorMatch) {
    result.value = colorMatch.charAt(0).toUpperCase() + colorMatch.slice(1);
    result.isValid = true;
  } else if (input.trim().length > 0) {
    // Accept any non-empty input as a custom color
    result.value = input.trim();
    result.isValid = true;
  } else {
    result.error = 'Please specify a color';
  }

  return result;
}

function parseConstrainedChoice(input: string, constraints?: any[]): ParsedParameter {
  const result: ParsedParameter = {
    value: null,
    isValid: false,
    originalInput: input
  };

  if (!constraints || !Array.isArray(constraints)) {
    result.error = 'No valid options available';
    return result;
  }

  const normalizedInput = input.toLowerCase().trim();
  const match = constraints.find(option =>
    option.toLowerCase().includes(normalizedInput) ||
    normalizedInput.includes(option.toLowerCase())
  );

  if (match) {
    result.value = match;
    result.isValid = true;
  } else {
    result.error = `Please choose from: ${constraints.join(', ')}`;
  }

  return result;
}

function parseDimension(input: string): ParsedParameter {
  const result: ParsedParameter = {
    value: null,
    isValid: false,
    originalInput: input
  };

  // Parse dimensions like "12 feet", "144 inches", "12'", "12 ft", "10 feet 6 inches", etc.
  const feetMatch = input.match(/(\d+)(?:\s*(?:feet|foot|ft|'|′))/i);
  const inchMatch = input.match(/(\d+)(?:\s*(?:inches|inch|in|"|″))/i);
  const combinedMatch = input.match(/(\d+)(?:\s*(?:feet|foot|ft|'|′))\s*(\d+)(?:\s*(?:inches|inch|in|"|″))?/i);

  let totalInches = 0;

  if (combinedMatch) {
    // "10 feet 6 inches" format
    const feet = parseInt(combinedMatch[1]);
    const inches = parseInt(combinedMatch[2]);
    totalInches = (feet * 12) + inches;
  } else if (feetMatch) {
    // "12 feet" format
    const feet = parseInt(feetMatch[1]);
    totalInches = feet * 12;
  } else if (inchMatch) {
    // "144 inches" format
    totalInches = parseInt(inchMatch[1]);
  } else {
    // Try to parse as just a number (assume feet if no unit)
    const numberMatch = input.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      // If it's a reasonable number for room dimensions, assume feet
      if (num >= 5 && num <= 50) {
        totalInches = num * 12;
      } else if (num >= 60 && num <= 600) {
        // Already in inches
        totalInches = num;
      } else {
        result.error = 'Please specify dimensions in feet or inches (e.g., "12 feet" or "144 inches")';
        return result;
      }
    } else {
      result.error = 'Please specify dimensions in feet or inches (e.g., "12 feet" or "144 inches")';
      return result;
    }
  }

  // Validate reasonable room dimensions
  if (totalInches < 60 || totalInches > 600) {
    result.error = 'Room dimensions should be between 5-50 feet (60-600 inches)';
    return result;
  }

  result.value = totalInches;
  result.isValid = true;
  return result;
}

export async function askQuestion(question: string, choices: Choice[], designBrief: string): Promise<{ text: string; choices: Choice[] }> {
  // Check cache first
  const cacheKey = `${question}|${choices.map(c => c.name).join(',')}`;
  if (questionCache.has(cacheKey)) {
    return { text: questionCache.get(cacheKey)!, choices };
  }

  // Skip rephrasing entirely if disabled
  if (isQuestionRephrasingDisabled()) {
    questionCache.set(cacheKey, question);
    return { text: question, choices };
  }

  // For simple questions, skip LLM rephrasing to speed up
  const isSimpleQuestion = question.length < 50 && !question.includes('?') && !question.includes(' or ');

  // Skip LLM entirely for very common patterns
  const commonPatterns = [
    /^What is the (width|depth|height)/i,
    /^What style/i,
    /^What layout/i,
    /^What color/i,
    /^What material/i
  ];

  const isCommonPattern = commonPatterns.some(pattern => pattern.test(question));

  if (isSimpleQuestion || isCommonPattern) {
    questionCache.set(cacheKey, question);
    return { text: question, choices };
  }

  const messages = [
    { role: 'system', content: `You are a design assistant. Your goal is to gather information for a 3D floor plan. Keep responses brief and conversational.` },
    { role: 'user', content: `Rephrase this question conversationally: "${question}"` }
  ];

  try {
    const data = await Promise.race([
      postChat<any>(CONVERSATION_LLM_URL, messages, CONVERSATION_LLM_MODEL),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Question rephrasing timed out')), 5000)
      )
    ]);
    const text = data.message.content || question;
    questionCache.set(cacheKey, text);
    return { text, choices };
  } catch (error) {
    console.warn('Question rephrasing failed, using original:', error);
    questionCache.set(cacheKey, question);
    return { text: question, choices };
  }
}

export async function getRoomStateFromConversation(conversation: any[], designBrief: string): Promise<any> {
  const roomStateInterface = `
interface RoomState {
  id: string;
  version: string;
  styleTemplateId: string;
  params: Record<string, unknown>;
  room: {
    widthIn: number;
    depthIn: number;
    heightIn: number;
    wallThicknessIn: number;
    openings: Opening[];
  };
  items: Item[];
  seed: string;
}

interface Opening {
  id: string;
  kind: 'door' | 'window';
  x: number;
  y: number;
  wallId: string;
  widthIn: number;
  heightIn: number;
  sillIn?: number;
  swing?: 'L' | 'R' | 'SL' | 'SR';
}

interface Item {
  id: string;
  sku: string;
  anchor: 'wall' | 'floor';
  x: number;
  y: number;
  rotDeg: number;
  meta: Record<string, unknown>;
}
`;

  const prompt = `You are a helpful design assistant. Your task is to analyze the following conversation and the design brief and extract all the parameters for a room design. The output must be a JSON object that conforms to the RoomState interface. The RoomState interface is defined as:

${roomStateInterface}

Here is the design brief:

${designBrief}

IMPORTANT: The widthIn and depthIn properties in the room object must be in inches, and they must be greater than or equal to 60. The roomType must be one of ["kitchen", "bathroom"]. The style must be one of ["modern", "traditional", "transitional"]. Return only the JSON object.

Conversation:
${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

  const data = await Promise.race([
    postGenerate<any>(REASONING_LLM_URL, prompt, REASONING_LLM_MODEL),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out after 30 seconds')), 30000)
    )
  ]);
  console.log('LLM response:', data);
  try {
    const rawContent = data.response;
    console.log('Raw LLM content:', rawContent);

    const jsonStartIndex = rawContent.indexOf('{');
    const jsonEndIndex = rawContent.lastIndexOf('}');

    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error('No JSON object found in LLM response.');
    }

    const jsonString = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
    console.log('Extracted JSON string:', jsonString);
    const parsed = JSON.parse(jsonString);
    console.log('Parsed RoomState:', parsed);

    // Basic validation
    if (!parsed.room || typeof parsed.room.widthIn !== 'number' || typeof parsed.room.depthIn !== 'number') {
      throw new Error('Invalid RoomState: missing or invalid room dimensions');
    }
    if (parsed.room.widthIn < 60 || parsed.room.depthIn < 60) {
      throw new Error('Invalid RoomState: room dimensions too small');
    }

    return parsed;
  } catch (e) {
    console.error("Failed to parse RoomState from LLM", e);
    throw new Error('Failed to parse RoomState from LLM');
  }
}



export async function summarizeChoices(finalPrompt: string): Promise<string> {
  if (isReasoningDisabled()) {
    return finalPrompt.trim();
  }

  const prompt = `
Summarize the following finalized design brief into a short, human-friendly description suitable for a loading screen. Focus on room type, key style cues, dimensions, and standout selections. Limit to 4 concise lines.

${finalPrompt}
  `.trim();

  type ReasoningResponse = { summary?: string; text?: string; response?: string };

  try {
    const data = await postGenerate<ReasoningResponse>(REASONING_LLM_URL, prompt, REASONING_LLM_MODEL);
    const summary = data.summary ?? data.text ?? data.response;
    if (summary) {
      return summary.trim();
    }
  } catch (error) {
    console.warn('summarizeChoices fell back to direct prompt:', error);
  }

  return finalPrompt.trim();
}

export const getUpdatedFinalPrompt = async (
  currentPrompt: string,
  modificationRequest: string
): Promise<string> => {
  const prompt = `
Given the following complete room description, update it based on the user's modification request.
Return ONLY the new, complete room description.

Current Description:
"${currentPrompt}"

Modification Request:
"${modificationRequest}"
  `.trim();

  type ReasoningResponse = { text?: string; updatedPrompt?: string; response?: string };

  const data = await postGenerate<ReasoningResponse>(REASONING_LLM_URL, prompt, REASONING_LLM_MODEL);
  const updatedPrompt = data.updatedPrompt ?? data.text ?? data.response;

  if (!updatedPrompt) {
    throw new Error('Reasoning LLM did not return an updated prompt.');
  }

  return updatedPrompt.trim();
};

export const enhanceFinalPrompt = async (finalPrompt: string): Promise<string> => {
  if (isReasoningDisabled()) {
    return finalPrompt;
  }

  const prompt = `
You are preparing a design brief for a deterministic 3D floorplan builder.

Enhance the following brief so it captures:
- Room type and exact dimensions (width x depth, in feet)
- Layout style and wall assignments for each run
- Every required appliance or fixture with placement (wall, adjacency, or island) and finishes
- Cabinet, countertop, flooring, and overall color palette details
- Any functional rules (island clearances, work triangle intent, venting requirements, etc.)

Return ONLY the refined brief as a concise multi-sentence paragraph that is ready for machine parsing. Do not add JSON or markdown.

Original Brief:
"${finalPrompt}"
  `.trim();

  type ReasoningResponse = { text?: string; refinedPrompt?: string; response?: string };

  try {
    const data = await postGenerate<ReasoningResponse>(REASONING_LLM_URL, prompt, REASONING_LLM_MODEL);
    const refined = data.refinedPrompt ?? data.text ?? data.response;
    if (refined) {
      return refined.trim();
    }
  } catch (error) {
    console.warn('enhanceFinalPrompt fell back to original prompt:', error);
  }

  return finalPrompt;
};
