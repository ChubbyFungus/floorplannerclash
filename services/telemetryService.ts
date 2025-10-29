import type { RoomState } from '../types';

/**
 * Logs telemetry data for a design generation.
 * In a real application, this would send data to a telemetry backend.
 * For now, it logs to the console.
 *
 * @param inputState The RoomState before placement.
 * @param outputState The RoomState after placement (with items).
 * @param ruleViolations An array of IDs of any soft rules that were violated.
 * @param collisions An array of pairs of item IDs that are colliding.
 * @param runtimeMs The total time in milliseconds for the placement algorithm to run.
 */
export const logGeneration = (
  inputState: RoomState,
  outputState: RoomState,
  ruleViolations: string[],
  collisions: string[][],
  runtimeMs: number
) => {
  console.log("--- Telemetry Log ---");
  console.log("Input State ID:", inputState.id);
  console.log("Output State ID:", outputState.id);
  console.log("Rule Violations:", ruleViolations);
  console.log("Collisions:", collisions);
  console.log("Runtime (ms):", runtimeMs);
  console.log("---------------------");

  // In a real app, you would send this data to a service like Google Analytics, Mixpanel, etc.
  // Example: sendToTelemetryBackend({ inputStateHash, outputStateHash, ruleViolations, collisions, runtimeMs });
};
