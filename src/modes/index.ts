import type { PipeConfig, BitbucketContext } from "../types/config";
import { TagMode } from "./tag/index";
import { AgentMode } from "./agent/index";
import { ReviewMode } from "./review/index";

export interface Mode {
  name: string;
  shouldTrigger(config: PipeConfig, context: BitbucketContext): boolean;
  prepareContext(config: PipeConfig, context: BitbucketContext): Promise<{
    prompt: string;
    files?: string[];
    allowedTools?: string[];
    blockedTools?: string[];
    triggerSource?: "description" | "comment" | "commit";
    commentId?: any;
    inlineContext?: {
      path: string;
      from: number | null;
      to: number | null;
    };
    parentCommentId?: string;
  }>;
}

export function getModeHandler(modeName: string): Mode {
  switch (modeName) {
    case "tag":
      return new TagMode();
    case "agent":
      return new AgentMode();
    case "experimental-review":
      return new ReviewMode();
    default:
      throw new Error(`Unknown mode: ${modeName}`);
  }
}