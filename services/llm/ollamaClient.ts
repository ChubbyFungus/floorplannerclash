const OLLAMA_ENDPOINT = process.env.LLM_ENDPOINT || 'http://localhost:11434/v1';
const OLLAMA_API_KEY = 'ollama'; // Ollama doesn't require a real API key
const DEFAULT_TIMEOUT_MS = process.env.LLM_REQUEST_TIMEOUT_MS
  ? Number(process.env.LLM_REQUEST_TIMEOUT_MS)
  : 60000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

const isTestEnvironment = () =>
  process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

export const createChatCompletion = async (options: ChatCompletionOptions) => {
  const { model, messages, temperature = 0.3, max_tokens = 8000, stream = false } = options;

  if (isTestEnvironment()) {
    throw new Error('Failed to communicate with Ollama: running in offline test mode');
  }

  // Ensure temperature is within Ollama's supported range (0.0 to 2.0)
  const clampedTemperature = Math.max(0.0, Math.min(2.0, temperature));

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();

  try {
    timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: clampedTemperature,
        max_tokens,
        stream,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Ollama API error:', error);
    throw new Error(
      `Failed to communicate with Ollama: ${error instanceof Error ? error.message : error}`
    );
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

export const listAvailableModels = async () => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();

  try {
    if (isTestEnvironment()) {
      throw new Error('Failed to list models: running in offline test mode');
    }

    timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_ENDPOINT}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.data ?? [];
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    throw new Error(`Failed to list models: ${error instanceof Error ? error.message : error}`);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};
