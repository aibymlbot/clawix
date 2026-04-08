import type { ChatMessage, GenerationSettings, LLMUsage } from '@clawix/shared';

/** Configuration for a reasoning loop run. */
export interface ReasoningLoopConfig {
  readonly maxIterations?: number; // default: 40
  readonly model?: string; // overrides provider default
  readonly settings?: GenerationSettings;
  readonly onProgress?: (hint: string) => void;
  /** Total token ceiling (inputTokens + outputTokens). Omit for no limit. */
  readonly tokenBudget?: number;
  /** Grace window as a percentage before hard kill. Default: 10 (= 10%). */
  readonly tokenGracePercent?: number;
}

/** Result of a completed reasoning loop. */
export interface LoopResult {
  readonly content: string | null;
  readonly messages: readonly ChatMessage[];
  readonly totalUsage: LLMUsage;
  readonly iterations: number;
  readonly hitMaxIterations: boolean;
  /** True when the loop stopped because the token budget grace limit was exceeded. */
  readonly hitTokenBudget: boolean;
}
