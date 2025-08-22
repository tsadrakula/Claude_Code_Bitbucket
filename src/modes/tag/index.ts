import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { BitbucketAPI } from "../../bitbucket/api";
import { BitbucketClient } from "../../bitbucket/client";
import { logger } from "../../utils/logger";
import { classifyRequest } from "../../utils/request-classifier";

export class TagMode implements Mode {
  name = "tag";

  shouldTrigger(_config: PipeConfig, _context: BitbucketContext): boolean {
    // Tag mode always runs when explicitly set
    return true;
  }

  async prepareContext(
    config: PipeConfig,
    context: BitbucketContext
  ): Promise<{
    prompt: string;
    files?: string[];
    allowedTools?: string[];
    blockedTools?: string[];
    triggerSource?: "description" | "comment" | "commit";
    commentId?: any;
  }> {
    logger.info("Preparing tag mode context...");

    let prompt = "";
    let files: string[] = [];
    let triggerSource: "description" | "comment" | "commit" | undefined;
    let commentId: any;
    let userRequest = "";
    let inlineContext: any = null;
    let parentCommentId: string | undefined = undefined;

    // Handle PR context - check both description and comments
    if (context.pullRequest && config.prId) {
      const triggerPhrase = config.triggerPhrase;
      
      // First check PR description
      const prDescription = context.pullRequest.description || "";
      if (prDescription.includes(triggerPhrase)) {
        logger.info("Found trigger phrase in PR description");
        triggerSource = "description";
        userRequest = prDescription
          .split(triggerPhrase)[1] // Get text after trigger phrase
          ?.trim() || "Please review this pull request";
      }
      
      // Check PR comments if we have API access
      if (config.bitbucketAccessToken) {
        try {
          const api = new BitbucketAPI(config);
          const comments = await api.getPullRequestComments(config.prId);
          
          logger.info(`Fetched ${comments.length} PR comments`);
          
          // Find the most recent comment with trigger phrase
          for (let i = comments.length - 1; i >= 0; i--) {
            const comment = comments[i];
            // Ensure content is a string
            const rawContent = comment.content?.raw || "";
            const content = typeof rawContent === "string" ? rawContent : String(rawContent);
            
            if (content && content.includes(triggerPhrase)) {
              logger.info(`Found trigger phrase in comment ${comment.id}`);
              
              // Check if this is an inline comment
              if (comment.inline) {
                logger.info(`Comment is inline on ${comment.inline.path} lines ${comment.inline.from}-${comment.inline.to}`);
                inlineContext = {
                  path: comment.inline.path,
                  from: comment.inline.from,
                  to: comment.inline.to || comment.inline.from,
                };
                
                // The comment that triggered Claude becomes the parent for the reply
                parentCommentId = comment.id;
                logger.info(`Setting parent comment ID for reply: ${parentCommentId}`);
              } else {
                // For top-level comments, also use the triggering comment as parent
                // This ensures Claude replies to the comment that mentioned it
                parentCommentId = comment.id;
              }
              
              triggerSource = "comment";
              commentId = comment.id;
              userRequest = content
                .split(triggerPhrase)[1] // Get text after trigger phrase
                ?.trim() || "Please help with this PR";
              break; // Use most recent mention
            }
          }
        } catch (error) {
          logger.warning("Failed to fetch PR comments:", error);
        }
      } else {
        logger.warning("No Bitbucket access token - cannot fetch PR comments");
      }
      
      // If no trigger found in description or comments, provide default
      if (!userRequest) {
        userRequest = "Please review this pull request and provide feedback";
      }

      // Build comprehensive PR context
      prompt = `
# Pull Request Context

**PR #${context.pullRequest.id}:** ${context.pullRequest.title}
**Author:** ${context.pullRequest.author}
**Source Branch:** ${context.pullRequest.sourceBranch}
**Target Branch:** ${context.pullRequest.destinationBranch}

## PR Description
${context.pullRequest.description || "No description provided"}

## User Request
${userRequest}
${
  inlineContext 
    ? `\n## Inline Comment Context\nThe user commented on **${inlineContext.path}** (lines ${inlineContext.from}-${inlineContext.to})\n` 
    : ""
}
## Instructions
You are reviewing a pull request in Bitbucket. ${
  triggerSource === "comment" && inlineContext
    ? "The user mentioned you in an inline comment on specific lines of code. Focus your response on those specific lines."
    : triggerSource === "comment" 
    ? "The user mentioned you in a PR comment." 
    : triggerSource === "description"
    ? "The user mentioned you in the PR description."
    : ""
}

Analyze the changes and provide helpful feedback based on the user's request. Be specific, actionable, and constructive in your response.
`;
      
      // Try to fetch PR diff and branch info if we have API access
      if (config.bitbucketAccessToken && config.prId) {
        try {
          const api = new BitbucketAPI(config);
          
          // Get PR diff
          const diff = await api.getPullRequestDiff(config.prId);
          if (diff) {
            prompt += `\n## PR Diff\n\`\`\`diff\n${diff}\n\`\`\`\n`;
          }
          
          // Get PR branch info for context
          const client = new BitbucketClient(config);
          const branchInfo = await client.getPullRequestBranch(config.prId);
          if (branchInfo.source) {
            prompt += `\n## PR Branch Information\n- Source Branch: ${branchInfo.source}\n- Target Branch: ${branchInfo.destination || 'main'}\n`;
            prompt += `\nNote: You are working on the source branch (${branchInfo.source}) of this PR.\n`;
          }
        } catch (error) {
          logger.warning("Failed to fetch PR info:", error);
        }
      }
      
    } else if (context.commit) {
      // Handle commit trigger
      const message = context.commit.message;
      const request = message
        .replace(config.triggerPhrase, "")
        .trim();
      
      triggerSource = "commit";

      prompt = `
# Commit Context

**Hash:** ${context.commit.hash}
**Author:** ${context.commit.author}
**Message:** ${message}

## User Request
${request}

## Instructions
You are assisting with a commit in Bitbucket. Help with the requested task.
`;
    } else {
      // General context
      prompt = `
# Repository Context

**Repository:** ${context.repository.fullName}
**Branch:** ${context.branch || context.repository.defaultBranch}
**Triggered by:** ${context.actor}

## Instructions
You are assisting with a Bitbucket repository. Provide help based on the current context.
`;
    }

    // Classify the request and set tools accordingly
    let allowedTools: string[] | undefined = config.allowedTools;
    let blockedTools: string[] | undefined = config.blockedTools;

    if (!config.allowedTools && userRequest && config.autoDetectActionable) {
      const requestType = classifyRequest(userRequest);
      logger.info(`Request classified as: ${requestType}`);
      
      if (requestType === "actionable") {
        // Allow editing for actionable requests
        allowedTools = ["Read", "Edit", "Write", "Grep", "MultiEdit", "Bash", "LS", "Glob"];
        blockedTools = ["Computer"];
        logger.info("Actionable request detected - enabling edit tools");
      } else {
        // Read-only for informational requests
        allowedTools = ["Read", "Grep"];
        blockedTools = ["Write", "Edit", "MultiEdit", "Computer"];
        logger.info("Informational request detected - using read-only tools");
      }
    }

    return {
      prompt,
      files,
      allowedTools,
      blockedTools,
      triggerSource,
      commentId,
      inlineContext,
      parentCommentId,
    };
  }
}