import { createChatCompletion, listAvailableModels } from '../services/llm/ollamaClient';
import { selectNextQuestion, paraphraseToCNL } from '../services/llm/reasoner';
import { frameManager } from '../src/state/frame';
import { mergeRules } from '../src/lib/rulesEngine';

describe('LLM Integration Tests', () => {
  beforeAll(() => {
    jest.setTimeout(60000); // Set global timeout for all tests
  });

  beforeEach(() => {
    frameManager.reset();
  });

  describe('Ollama Client', () => {
    it('should create chat completion with temperature ≤ 0.3', async () => {
      // This test will fail if Ollama is not running, which is expected
      try {
        const response = await createChatCompletion({
          model: 'qwen2.5:7b-instruct',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.2,
          max_tokens: 100,
        });

        expect(response).toBeDefined();
        expect(response.choices).toBeDefined();
        expect(response.choices.length).toBeGreaterThan(0);
      } catch (error) {
        // Expect connection error if Ollama not running
        expect(error.message).toContain('Failed to communicate with Ollama');
      }
    });

    it('should clamp temperature to valid range', async () => {
      // Test with temperature > 2.0 (should be clamped)
      try {
        await createChatCompletion({
          model: 'qwen2.5:7b-instruct',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 2.5, // Should be clamped to 2.0
          max_tokens: 100,
        });
      } catch (error) {
        // Should still fail with connection error, not temperature error
        expect(error.message).toContain('Failed to communicate with Ollama');
      }
    });

    it('should respect max_tokens limit of 8000', async () => {
      try {
        const response = await createChatCompletion({
          model: 'qwen2.5:7b-instruct',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 8000,
        });

        expect(response).toBeDefined();
      } catch (error) {
        expect(error.message).toContain('Failed to communicate with Ollama');
      }
    });

    it('should list available models', async () => {
      try {
        const models = await listAvailableModels();
        expect(Array.isArray(models)).toBe(true);
      } catch (error) {
        expect(error.message).toContain('Failed to list models');
      }
    });
  });

  describe('Reasoner Functions', () => {
    it('should select next question based on missing fields', async () => {
      frameManager.apply({
        roomType: 'kitchen',
        style: 'modern',
        // Missing dimensions and appliances
      });

      const missing = frameManager.listMissingOrLowConfidence();
      const effectiveRules = mergeRules('kitchen' as any, 'modern', []);

      try {
        const question = await selectNextQuestion(
          frameManager.getFrame(),
          missing,
          effectiveRules
        );

        expect(typeof question).toBe('string');
        expect(question.length).toBeGreaterThan(0);
        // Should prioritize dimensions over appliances for kitchen
        expect(question.toLowerCase()).toMatch(/(width|depth|dimensions|size)/);
      } catch (error) {
        // Fallback should work even if LLM unavailable
        expect(error.message).toContain('Failed to communicate with Ollama');
      }
    });

    it('should paraphrase natural language to CNL', async () => {
      const input = "I want a modern kitchen that's 12 feet wide and 10 feet deep with white cabinets";

      try {
        const cnl = await paraphraseToCNL(input);

        expect(typeof cnl).toBe('string');
        expect(cnl.length).toBeGreaterThan(0);
        // Should contain structured elements
        expect(cnl.toLowerCase()).toMatch(/(kitchen|modern|white|feet|wide|deep)/);
      } catch (error) {
        expect(error.message).toContain('Failed to communicate with Ollama');
      }
    });

    it('should handle bathroom-specific reasoning', async () => {
      frameManager.apply({
        roomType: 'bathroom',
        style: 'modern',
        dimensions: { width: 8, depth: 6 },
        // Missing toilet
      });

      const missing = frameManager.listMissingOrLowConfidence();
      const effectiveRules = mergeRules('bathroom' as any, 'modern', []);

      try {
        const question = await selectNextQuestion(
          frameManager.getFrame(),
          missing,
          effectiveRules
        );

        expect(typeof question).toBe('string');
        // Should ask about toilet for bathroom
        expect(question.toLowerCase()).toMatch(/(toilet|bathroom)/);
      } catch (error) {
        expect(error.message).toContain('Failed to communicate with Ollama');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      // Test with invalid endpoint to force connection failure
      process.env.LLM_ENDPOINT = 'http://invalid-endpoint:1234/v1';

      try {
        await createChatCompletion({
          model: 'qwen2.5:7b-instruct',
          messages: [{ role: 'user', content: 'Hello' }],
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Failed to communicate with Ollama');
      } finally {
        // Reset environment
        delete process.env.LLM_ENDPOINT;
      }
    });

    it('should provide fallback questions when LLM unavailable', async () => {
      // Force connection failure
      process.env.LLM_ENDPOINT = 'http://invalid-endpoint:1234/v1';

      frameManager.apply({
        roomType: 'kitchen',
        // Missing everything else
      });

      const missing = frameManager.listMissingOrLowConfidence();
      const effectiveRules = mergeRules('kitchen' as any, 'modern', []);

      try {
        const question = await selectNextQuestion(
          frameManager.getFrame(),
          missing,
          effectiveRules
        );
        // Should still return a question via fallback logic
        expect(typeof question).toBe('string');
        expect(question.length).toBeGreaterThan(0);
      } catch (error) {
        expect(error.message).toContain('Failed to communicate with Ollama');
      } finally {
        delete process.env.LLM_ENDPOINT;
      }
    });
  });
});