import type { PipeConfig } from "../types/config";
import { BitbucketAPI } from "./api";
import { logger } from "../utils/logger";

interface UpdateOptions {
  config: PipeConfig;
  prId: number;
  commentId?: string;
  content: string;
  isPartial: boolean;
  status?: "success" | "error" | "timeout";
}

let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 1000; // Throttle updates to once per second

export async function updateCommentStream(options: UpdateOptions): Promise<void> {
  const { config, prId, content, isPartial, status } = options;
  
  // Throttle updates to avoid rate limiting
  const now = Date.now();
  if (isPartial && now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    return;
  }
  lastUpdateTime = now;
  
  // Format content based on whether it's partial or final
  let formattedContent: string;
  
  if (isPartial) {
    // For streaming updates, show content as it arrives
    formattedContent = `🤖 **Claude is responding...**\n\n${content}`;
  } else {
    // For final update, add status indicator
    const statusEmoji = status === "success" ? "✅" : status === "error" ? "❌" : "⏱️";
    const statusText = status === "success" ? "Completed" : status === "error" ? "Failed" : "Timed Out";
    
    formattedContent = `## 🤖 Claude Response ${statusEmoji}\n\n${content}\n\n---\n*Status: ${statusText}*`;
  }
  
  // Try to post to Bitbucket
  if (config.bitbucketAccessToken) {
    try {
      const api = new BitbucketAPI(config);
      await api.createPullRequestComment(prId, formattedContent);
      
      if (!isPartial) {
        logger.success("Posted final Claude response to PR");
      }
    } catch (error) {
      // Don't fail the whole process if comment posting fails
      logger.debug("Failed to update PR comment:", error);
    }
  } else {
    // Fallback to console output if no API access
    if (!isPartial) {
      console.log("\n" + formattedContent + "\n");
    }
  }
}