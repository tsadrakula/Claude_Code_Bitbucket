import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { BitbucketAPI } from "../../bitbucket/api";
import { logger } from "../../utils/logger";

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
            const content = comment.content?.raw || comment.content || "";
            
            if (content.includes(triggerPhrase)) {
              logger.info(`Found trigger phrase in comment ${comment.id}`);
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

## Instructions
You are reviewing a pull request in Bitbucket. ${
  triggerSource === "comment" 
    ? "The user mentioned you in a PR comment." 
    : triggerSource === "description"
    ? "The user mentioned you in the PR description."
    : ""
}

Analyze the changes and provide helpful feedback based on the user's request. Be specific, actionable, and constructive in your response.
`;
      
      // Try to fetch PR diff if we have API access
      if (config.bitbucketAccessToken && config.prId) {
        try {
          const api = new BitbucketAPI(config);
          const diff = await api.getPullRequestDiff(config.prId);
          if (diff) {
            prompt += `\n## PR Diff\n\`\`\`diff\n${diff}\n\`\`\`\n`;
          }
        } catch (error) {
          logger.warning("Failed to fetch PR diff:", error);
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

    return {
      prompt,
      files,
      allowedTools: config.allowedTools,
      blockedTools: config.blockedTools,
      triggerSource,
      commentId,
    };
  }
}