import type { Choice } from '../types';

type FetchLike = (input: any, init?: any) => Promise<any>;

const fetchImpl: FetchLike | undefined = (globalThis as any).fetch?.bind(globalThis);

const CONVERSATION_LLM_URL = process.env.CONVERSATION_LLM_URL ?? 'http://localhost:11434/api/chat';
const REASONING_LLM_URL = process.env.REASONING_LLM_URL ?? 'http://localhost:11434/api/generate';

const CONVERSATION_LLM_MODEL = process.env.CONVERSATION_LLM_MODEL ?? 'qwen2.5:7b-instruct';
const REASONING_LLM_MODEL = process.env.REASONING_LLM_MODEL ?? 'deepseek-r1:7b-qwen-distill-q4_K_M';

const isReasoningDisabled = () => false;

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

export async function askQuestion(question: string, choices: Choice[]): Promise<{ text: string; choices: Choice[] }> {
    const messages = [
      { role: 'user', content: `You are a design assistant. Ask the user the following question and present them with these choices. Question: "${question}"` }
    ];

    const data = await postChat<any>(CONVERSATION_LLM_URL, messages, CONVERSATION_LLM_MODEL, { choices });
    const text = data.message.content || question;

    return { text, choices: data.choices || choices };
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
