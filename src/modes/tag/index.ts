import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { BitbucketAPI } from "../../bitbucket/api";
import { logger } from "../../utils/logger";

export class TagMode implements Mode {
  name = "tag";

  shouldTrigger(config: PipeConfig, context: BitbucketContext): boolean {
    // Check if this is a PR comment event
    if (context.eventType === "pullrequest:comment_created") {
      return true;
    }

    // Check if this is a manual trigger
    if (context.eventType === "custom:manual") {
      return true;
    }

    // Check for trigger phrase in commit message
    if (context.commit?.message.includes(config.triggerPhrase)) {
      return true;
    }

    return false;
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

    const api = new BitbucketAPI(config);
    let prompt = "";
    let files: string[] = [];

    // Handle PR comment
    if (context.pullRequest) {
      // Get PR details
      const pr = await api.getPullRequest(context.pullRequest.id);
      
      // Get changed files
      const diff = await api.getPullRequestDiff(context.pullRequest.id);
      files = this.extractFilesFromDiff(diff);

      // Check for trigger phrase in comments
      const comments = await api.getPullRequestComments(context.pullRequest.id);
      const triggerComment = comments.find(c => 
        c.content.raw.includes(config.triggerPhrase)
      );

      if (triggerComment) {
        // Extract the request from the comment
        const request = triggerComment.content.raw
          .replace(config.triggerPhrase, "")
          .trim();

        prompt = `
# Pull Request Context

**Title:** ${pr.title}
**Description:** ${pr.description || "No description provided"}
**Author:** ${pr.author.display_name}
**Source Branch:** ${pr.source.branch.name}
**Destination Branch:** ${pr.destination.branch.name}

## User Request
${request || "Please review this pull request and provide feedback."}

## Changed Files
${files.map(f => `- ${f}`).join("\n")}

## Instructions
You are reviewing a pull request in Bitbucket. Analyze the changes and provide helpful feedback based on the user's request.
`;
      }
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
    }

    return {
      prompt,
      files,
      allowedTools: config.allowedTools,
      blockedTools: config.blockedTools,
    };
  }

  private extractFilesFromDiff(diff: string): string[] {
    const files: string[] = [];
    const lines = diff.split("\n");
    
    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        const match = line.match(/b\/(.+)$/);
        if (match) {
          files.push(match[1]);
        }
      }
    }
    
    return files;
  }
}