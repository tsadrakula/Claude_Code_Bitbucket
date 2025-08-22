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
  inlineContext?: {
    path: string;
    from: number;
    to: number;
  };
  parentCommentId?: string;
}

let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 1000; // Throttle updates to once per second

export async function updateCommentStream(options: UpdateOptions): Promise<void> {
  const { config, prId, content, isPartial, status, inlineContext, parentCommentId } = options;
  
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
    // Make sure we have some content
    if (!content || content.trim() === "") {
      formattedContent = "**Claude is responding...**";
    } else {
      formattedContent = `**Claude is responding...**\n\n${content}`;
    }
  } else {
    // For final update, add status indicator
    const statusText = status === "success" ? "[COMPLETED]" : status === "error" ? "[FAILED]" : "[TIMED OUT]";
    
    formattedContent = `## Claude Response ${statusText}\n\n${content || "No response generated"}\n\n---\n*Status: ${status}*`;
  }
  
  // Try to post to Bitbucket
  if (config.bitbucketAccessToken) {
    try {
      const api = new BitbucketAPI(config);
      
      // If this is an inline comment response, post as inline
      if (inlineContext) {
        await api.createInlineComment(
          prId, 
          formattedContent,
          inlineContext.path,
          inlineContext.from,
          inlineContext.to,
          parentCommentId
        );
        
        if (!isPartial) {
          logger.success(`Posted final Claude response as inline comment on ${inlineContext.path}`);
        }
      } else {
        // Regular top-level comment
        await api.createPullRequestComment(prId, formattedContent);
        
        if (!isPartial) {
          logger.success("Posted final Claude response to PR");
        }
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