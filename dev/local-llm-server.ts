import http from 'node:http';
import { frameManager, Frame } from '../src/state/frame';
import { processUserInput } from '../services/llm/reasoner';
import { createChatCompletion, ChatMessage } from '../services/llm/ollamaClient';

const MODEL_NAME = process.env.LLM_MODEL_NAME || 'deepseek-r1:7b-qwen-distill-q4_K_M';

if (typeof process.env.LLM_DISABLED === 'undefined') {
  process.env.LLM_DISABLED = 'false';
}

const CHAT_PORT = Number(process.env.CONVERSATION_PORT ?? 3001);
const REASONING_PORT = Number(process.env.REASONING_PORT ?? 3002);

type SessionState = {
  frame: Frame | null;
  complete: boolean;
};

type LocalChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type ChatPayload = {
  sessionId?: string;
  messages?: LocalChatMessage[];
  systemInstruction?: string;
};

const chatSessions = new Map<string, SessionState>();

const readJsonBody = (req: http.IncomingMessage): Promise<any> =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000';

const applyCors = (res: http.ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

const sendJson = (res: http.ServerResponse, status: number, payload: unknown) => {
  applyCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const restoreFrameState = (frame: Frame | null) => {
  frameManager.reset();
  if (frame) {
    frameManager.apply(frame);
  }
};

const persistFrameState = (session: SessionState) => {
  session.frame = frameManager.getFrame();
};

const ensureSession = (sessionId: string): SessionState => {
  let session = chatSessions.get(sessionId);
  if (!session) {
    session = { frame: null, complete: false };
    chatSessions.set(sessionId, session);
  }
  return session;
};

const toChatHistory = (messages: LocalChatMessage[]): ChatMessage[] =>
  messages.map(message => ({
    role: message.role as 'user' | 'assistant' | 'system',
    content: message.content,
  }));

const buildAssistantReply = (
  result: Awaited<ReturnType<typeof processUserInput>>,
  frameSnapshot: Frame
): { reply: string; complete: boolean } => {
  if (result.isComplete) {
    const payload = {
      frame: frameSnapshot,
      scene: result.scene,
      warnings: result.sceneWarnings ?? [],
    };
    return { 
      reply: `FINAL_PROMPT: ${JSON.stringify(payload)}`,
      complete: true,
    };
  }

  const baseReply =
    result.question ??
    'I have everything I need. Reply with "finish" if you would like to finalize the design.';

  if (result.choices && result.choices.length > 0) {
    return {
      reply: `${baseReply}\nCHOICES:${JSON.stringify(result.choices)}`,
      complete: false,
    };
  }

  return { reply: baseReply, complete: false };
};

const summarizeFromFinalPrompt = (prompt: string): string => {
  try {
    const jsonSlice = extractJsonPayload(prompt);
    if (!jsonSlice) {
      return prompt.trim();
    }

    const payload = JSON.parse(jsonSlice) as {
      frame: Frame;
      warnings?: Array<{ message: string }>;
    };

    const parts: string[] = [];
    if (payload.frame.roomType) {
      parts.push(`Room: ${capitalize(payload.frame.roomType)}`);
    }
    if (payload.frame.style) {
      parts.push(`Style: ${capitalize(payload.frame.style)}`);
    }
    if (payload.frame.dimensions?.width && payload.frame.dimensions?.depth) {
      parts.push(
        `Dimensions: ${payload.frame.dimensions.width}ft x ${payload.frame.dimensions.depth}ft`
      );
    }

    const applianceSummary = summarizeAppliances(payload.frame);
    if (applianceSummary) {
      parts.push(applianceSummary);
    }

    if (payload.warnings && payload.warnings.length > 0) {
      const warningText = payload.warnings
        .map(w => `[Warning] ${w.message}`)
        .join('\n');
      parts.push(`Warnings:\n${warningText}`);
    }

    return parts.join('\n');
  } catch (error) {
    console.warn('[reason] failed to summarize prompt', error);
    return prompt.trim();
  }
};

const summarizeAppliances = (frame: Frame): string | null => {
  const appliances = frame.appliances;
  if (!appliances) return null;

  const summaries: string[] = [];
  if (appliances.refrigerator?.type) {
    summaries.push(
      `Refrigerator: ${formatValue(appliances.refrigerator.type)} (${formatValue(
        appliances.refrigerator.finish
      )})`
    );
  }
  if (appliances.oven?.type) {
    summaries.push(
      `Oven: ${formatValue(appliances.oven.type)} (${formatValue(appliances.oven.finish)})`
    );
  }
  if (appliances.sink?.type) {
    summaries.push(
      `Sink: ${formatValue(appliances.sink.type)} (${formatValue(appliances.sink.finish)})`
    );
  }
  if (appliances.dishwasher?.type) {
    summaries.push(
      `Dishwasher: ${formatValue(appliances.dishwasher.type)} (${formatValue(
        appliances.dishwasher.finish
      )})`
    );
  }
  if (appliances.toilet?.type) {
    summaries.push(`Toilet: ${formatValue(appliances.toilet.type)}`);
  }

  return summaries.length > 0 ? summaries.join('\n') : null;
};

const formatValue = (value?: string): string => {
  if (!value) return 'standard';
  return value.replace(/[_-]/g, ' ');
};

const capitalize = (value?: string): string => {
  if (!value || value.length === 0) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const extractJsonPayload = (prompt: string): string | null => {
  const start = prompt.indexOf('{');
  const end = prompt.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return prompt.slice(start, end + 1);
};

const buildUpdatedPrompt = (currentDescription: string, modification: string): string => {
  if (!currentDescription.trim()) {
    return modification.trim();
  }

  if (!modification.trim()) {
    return currentDescription.trim();
  }

  return `${currentDescription.trim()}\n\nUpdate:\n${modification.trim()}`;
};

http
  .createServer(async (req, res) => {
    applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    try {
      const body = (await readJsonBody(req)) as ChatPayload & { prompt?: string; choices?: any[] };

      // Handle new, simple prompt-based requests from the refactored client
      if (body.prompt && typeof body.prompt === 'string') {
        const systemPrompt = "You are a helpful design assistant. Your only job is to conversationally ask the user the question you are given, and present the choices if they are provided.";
        const userPrompt = body.prompt;
        
        // Format choices for the LLM if they exist
        let choicesText = '';
        if (body.choices && Array.isArray(body.choices) && body.choices.length > 0) {
            choicesText = "\n\nHere are the options:";
            body.choices.forEach(c => {
                choicesText += `\n- ${c.name}`;
            });
        }

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt + choicesText },
        ];

        // Directly call the underlying LLM client, bypassing the reasoner
        const llmResponse = await createChatCompletion({ model: MODEL_NAME, messages });
        const reply = llmResponse?.choices?.[0]?.message?.content || 'Sorry, I had trouble thinking of a response.';

        sendJson(res, 200, { reply, text: reply, choices: body.choices });
        return;
      }

      const { sessionId, messages, systemInstruction } = body;

      if (!sessionId || !Array.isArray(messages) || messages.length === 0) {
        sendJson(res, 400, { error: 'sessionId and messages are required' });
        return;
      }

      const session = ensureSession(sessionId);
      if (session.complete) {
        sendJson(res, 200, {
          reply:
            'Conversation already finalized. Start a new session to design another space.',
          isComplete: true,
        });
        return;
      }

      const latestUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
      if (!latestUserMessage) {
        sendJson(res, 400, { error: 'No user message found in payload' });
        return;
      }

      const lastIndex = messages.lastIndexOf(latestUserMessage);
      const priorMessages = lastIndex >= 0 ? messages.slice(0, lastIndex) : [];

      restoreFrameState(session.frame);

      const historyForReasoner: ChatMessage[] = [
        ...(systemInstruction ? [{ role: 'system' as const, content: systemInstruction }] : []),
        ...toChatHistory(priorMessages),
      ];

      const result = await processUserInput(latestUserMessage.content, historyForReasoner);
      const frameSnapshot = frameManager.getFrame();
      persistFrameState(session);

      const { reply, complete } = buildAssistantReply(result, frameSnapshot);
      session.complete = complete;

      sendJson(res, 200, {
        reply,
        isComplete: complete,
      });
    } catch (error: any) {
      console.error('[local-llm chat] error', error);
      sendJson(res, 500, { error: error?.message ?? 'Unexpected chat server error' });
    }
  })
  .listen(CHAT_PORT, () => {
    console.log(`Local conversational endpoint available at http://localhost:${CHAT_PORT}/chat`);
  });

http
  .createServer(async (req, res) => {
    applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const prompt: string | undefined = body?.prompt;

      if (!prompt || typeof prompt !== 'string') {
        sendJson(res, 400, { error: 'prompt is required' });
        return;
      }

      const normalized = prompt.toLowerCase();

      if (normalized.includes('summarize the following finalized design brief')) {
        const summary = summarizeFromFinalPrompt(prompt);
        sendJson(res, 200, { text: summary, summary });
        return;
      }

      if (normalized.includes('enhance the following final design brief')) {
        const match = prompt.match(/Original Brief:\s*"([\s\S]*)"\s*$/);
        const original = match?.[1] ?? prompt;
        sendJson(res, 200, { text: original, refinedPrompt: original });
        return;
      }

      if (normalized.includes('given the following complete room description')) {
        const currentMatch = prompt.match(/Current Description:\s*"(.*)"\s*Modification Request/si);
        const modificationMatch = prompt.match(/Modification Request:\s*"(.*)"/si);

        const currentDescription = currentMatch?.[1] ?? '';
        const modification = modificationMatch?.[1] ?? '';

        const updatedPrompt = buildUpdatedPrompt(currentDescription, modification);
        sendJson(res, 200, { text: updatedPrompt, updatedPrompt });
        return;
      }

      sendJson(res, 200, { text: prompt });
    } catch (error: any) {
      console.error('[local-llm reason] error', error);
      sendJson(res, 500, { error: error?.message ?? 'Unexpected reasoning server error' });
    }
  })
  .listen(REASONING_PORT, () => {
    console.log(`Local reasoning endpoint available at http://localhost:${REASONING_PORT}/reason`);
  });
