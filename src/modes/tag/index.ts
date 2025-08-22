import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { logger } from "../../utils/logger";

export class TagMode implements Mode {
  name = "tag";

  shouldTrigger(_config: PipeConfig, _context: BitbucketContext): boolean {
    // Tag mode always runs when explicitly set
    // We'll check for trigger phrase in the PR description or commit message
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
  }> {
    logger.info("Preparing tag mode context...");

    let prompt = "";
    let files: string[] = [];

    // Handle PR context
    if (context.pullRequest) {
      // Build prompt from PR information available in environment
      const prDescription = context.pullRequest.description || "No description provided";
      const triggerPhrase = config.triggerPhrase;
      
      // Check if description contains trigger phrase
      const hasTrigger = prDescription.includes(triggerPhrase);
      const request = hasTrigger 
        ? prDescription.replace(triggerPhrase, "").trim()
        : prDescription;

      prompt = `
# Pull Request Context

**Title:** ${context.pullRequest.title}
**Description:** ${prDescription}
**Author:** ${context.pullRequest.author}
**Source Branch:** ${context.pullRequest.sourceBranch}
**Destination Branch:** ${context.pullRequest.destinationBranch}

## User Request
${request || "Please review this pull request and provide feedback."}

## Instructions
You are reviewing a pull request in Bitbucket. Analyze the changes and provide helpful feedback based on the user's request.
`;
    } else if (context.commit) {
      // Handle commit trigger
      const message = context.commit.message;
      const request = message
        .replace(config.triggerPhrase, "")
        .trim();

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
    };
  }
}