import type { PipeConfig } from "../types/config";
import { BitbucketAPI } from "./api";
import { logger } from "../utils/logger";

export async function createTrackingComment(
  config: PipeConfig, 
  prId: number
): Promise<string> {
  if (!config.bitbucketAccessToken) {
    logger.warning("No Bitbucket access token - cannot create tracking comment");
    return `tracking-${Date.now()}`;
  }
  
  try {
    const api = new BitbucketAPI(config);
    const content = `## Claude Code Activated

**Mode:** ${config.mode}
**Model:** ${config.model}
**Trigger:** ${config.triggerPhrase}

Claude is initializing...`;
    
    const comment = await api.createPullRequestComment(prId, content);
    logger.info(`Created tracking comment: ${comment?.id}`);
    return comment?.id || `tracking-${Date.now()}`;
  } catch (error) {
    logger.error("Failed to create tracking comment:", error);
    return `tracking-${Date.now()}`;
  }
}

export async function updateComment(options: {
  config?: PipeConfig;
  prId?: number;
  commentId?: string;
  content: string;
  status: "success" | "error" | "timeout";
}): Promise<void> {
  const { config, prId, content, status } = options;
  
  const statusText = status === "success" ? "[COMPLETED]" : status === "error" ? "[FAILED]" : "[TIMED OUT]";
  
  // Format the final response
  const formattedContent = `## Claude Response ${statusText}

${content}

---
*Status: ${status}*`;
  
  // Try to post to Bitbucket if we have the necessary config
  if (config?.bitbucketAccessToken && prId) {
    try {
      const api = new BitbucketAPI(config);
      await api.createPullRequestComment(prId, formattedContent);
      logger.success("Posted Claude response to PR");
    } catch (error) {
      logger.error("Failed to post comment to PR:", error);
      // Fall back to console output
      outputToConsole(formattedContent, status);
    }
  } else {
    // Output to console if no API access
    outputToConsole(formattedContent, status);
  }
}

function outputToConsole(content: string, status: "success" | "error" | "timeout"): void {
  const statusText = status === "success" ? "COMPLETED" : status === "error" ? "FAILED" : "TIMED OUT";
  
  logger.info(`=================================`);
  logger.info(`Claude Code Result: ${statusText}`);
  logger.info(`=================================`);
  console.log(content);
  logger.info(`=================================`);
}