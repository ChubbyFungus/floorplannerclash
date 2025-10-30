import type { Choice } from '../types';

type FetchLike = (input: any, init?: any) => Promise<any>;

const fetchImpl: FetchLike | undefined = (globalThis as any).fetch?.bind(globalThis);

const CONVERSATION_LLM_URL = process.env.CONVERSATION_LLM_URL ?? 'http://localhost:11434/api/chat';
const REASONING_LLM_URL = process.env.REASONING_LLM_URL ?? 'http://localhost:11434/api/generate';

const CONVERSATION_LLM_MODEL = process.env.CONVERSATION_LLM_MODEL ?? 'qwen2.5:3b-instruct';
const REASONING_LLM_MODEL = process.env.REASONING_LLM_MODEL ?? 'qwen2.5:3b-instruct';

const isReasoningDisabled = () => false;

// Simple in-memory cache for LLM responses
const llmCache = new Map<string, any>();

function getCacheKey(functionName: string, ...args: any[]): string {
  return `${functionName}:${JSON.stringify(args)}`;
}

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
  const cacheKey = getCacheKey('getInitialDesign', description);
  if (llmCache.has(cacheKey)) {
    return llmCache.get(cacheKey);
  }

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

  // Cache the result
  llmCache.set(cacheKey, result);
  return result;
}

export async function askQuestion(question: string, choices: Choice[], designBrief: string): Promise<{ text: string; choices: Choice[] }> {
    const messages = [
      { role: 'system', content: `You are a design assistant. Your goal is to gather information for a 3D floor plan. Here is a brief of the information you need to collect:\n\n${designBrief}` },
      { role: 'user', content: `Ask the user the following question in a conversational way. Question: "${question}"` }
    ];

    const data = await postChat<any>(CONVERSATION_LLM_URL, messages, CONVERSATION_LLM_MODEL);
    const text = data.message.content || question;

    return { text, choices };
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

  const messages = [
    { role: 'system', content: `You are a helpful design assistant. Your task is to analyze the following conversation and the design brief and extract all the parameters for a room design. The output must be a JSON object that conforms to the RoomState interface. The RoomState interface is defined as:\n\n${roomStateInterface}\n\nHere is the design brief:\n\n${designBrief}\n\nIMPORTANT: The widthIn and depthIn properties in the room object must be in inches, and they must be greater than or equal to 60. The roomType must be one of ["kitchen", "bathroom"]. The style must be one of ["modern", "traditional", "transitional"]. Return only the JSON object.` },
    ...conversation
  ];

  const data = await postChat<any>(REASONING_LLM_URL, messages, REASONING_LLM_MODEL);
  try {
    const rawContent = data.message.content;
    const jsonStartIndex = rawContent.indexOf('{');
    const jsonEndIndex = rawContent.lastIndexOf('}');

    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error('No JSON object found in LLM response.');
    }

    const jsonString = rawContent.substring(jsonStartIndex, jsonEndIndex + 1);
    const parsed = JSON.parse(jsonString);
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
