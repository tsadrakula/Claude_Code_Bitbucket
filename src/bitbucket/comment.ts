import { BitbucketAPI } from "./api";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export async function createTrackingComment(
  config: PipeConfig, 
  prId: number
): Promise<string> {
  const api = new BitbucketAPI(config);
  
  const content = `
## 🤖 Claude Code Assistant

I'm processing your request. This comment will be updated with the results.

**Status:** 🔄 In Progress  
**Mode:** ${config.mode}  
**Model:** ${config.model}  
**Started:** ${new Date().toISOString()}

---
*This is an automated response from Claude Code for Bitbucket*
`;

  const comment = await api.createPullRequestComment(prId, content);
  logger.info(`Created tracking comment: ${comment.id}`);
  
  return comment.id;
}

export async function updateComment(options: {
  commentId: string;
  content: string;
  status: "success" | "error" | "timeout";
}): Promise<void> {
  const { commentId, content, status } = options;
  
  // Get config from environment (this is called after main execution)
  const config: PipeConfig = {
    workspace: process.env.BITBUCKET_WORKSPACE!,
    repoSlug: process.env.BITBUCKET_REPO_SLUG!,
    bitbucketAccessToken: process.env.BITBUCKET_ACCESS_TOKEN,
    prId: process.env.BITBUCKET_PR_ID ? parseInt(process.env.BITBUCKET_PR_ID) : undefined,
  } as PipeConfig;
  
  if (!config.prId) {
    logger.warning("Cannot update comment: No PR ID available");
    return;
  }
  
  const api = new BitbucketAPI(config);
  
  const statusEmoji = status === "success" ? "✅" : status === "error" ? "❌" : "⏱️";
  const statusText = status === "success" ? "Completed" : status === "error" ? "Failed" : "Timed Out";
  
  const updatedContent = `
## 🤖 Claude Code Assistant

**Status:** ${statusEmoji} ${statusText}  
**Completed:** ${new Date().toISOString()}

### Results

${content}

---
*This is an automated response from Claude Code for Bitbucket*
`;

  await api.updatePullRequestComment(config.prId, commentId, updatedContent);
  logger.info(`Updated comment ${commentId} with status: ${status}`);
}