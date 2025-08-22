import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export async function createTrackingComment(
  config: PipeConfig, 
  prId: number
): Promise<string> {
  // In simplified mode, we just log instead of creating actual comments
  // The PR comment functionality requires API access which may not be available
  
  logger.info(`Would create tracking comment for PR ${prId}`);
  logger.info(`Mode: ${config.mode}, Model: ${config.model}`);
  
  // Return a dummy ID since we're not actually creating comments
  return `tracking-${Date.now()}`;
}

export async function updateComment(options: {
  commentId: string;
  content: string;
  status: "success" | "error" | "timeout";
}): Promise<void> {
  const { content, status } = options;
  
  const statusEmoji = status === "success" ? "✅" : status === "error" ? "❌" : "⏱️";
  const statusText = status === "success" ? "Completed" : status === "error" ? "Failed" : "Timed Out";
  
  logger.info(`=================================`);
  logger.info(`Claude Code Result: ${statusEmoji} ${statusText}`);
  logger.info(`=================================`);
  logger.info(content);
  logger.info(`=================================`);
  
  // In a real implementation with API access, this would update the PR comment
  // For now, we just log the results
}