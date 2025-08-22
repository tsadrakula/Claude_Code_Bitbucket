import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { logger } from "../../utils/logger";
import { classifyRequest } from "../../utils/request-classifier";
import { BitbucketAPI } from "../../bitbucket/api";
import { BitbucketClient } from "../../bitbucket/client";

export class ReviewMode implements Mode {
  name = "experimental-review";

  shouldTrigger(_config: PipeConfig, context: BitbucketContext): boolean {
    // Review mode triggers on PR events
    const reviewEvents = [
      "pullrequest:created",
      "pullrequest:updated",
      "pullrequest:approved",
      "pullrequest:unapproved",
    ];

    return reviewEvents.includes(context.eventType);
  }

  async prepareContext(
    config: PipeConfig,
    context: BitbucketContext
  ): Promise<{
    prompt: string;
    files?: string[];
    allowedTools?: string[];
    blockedTools?: string[];
    inlineContext?: any;
    parentCommentId?: string;
  }> {
    logger.info("Preparing review mode context...");

    if (!context.pullRequest) {
      throw new Error("Review mode requires a pull request context");
    }

    let userRequest = "";
    let inlineContext: any = null;
    let parentCommentId: string | undefined = undefined;
    let requestType: "actionable" | "informational" = "informational";

    // Check for user comments if we have API access
    if (config.bitbucketAccessToken && config.prId) {
      try {
        const api = new BitbucketAPI(config);
        const comments = await api.getPullRequestComments(config.prId);
        
        // Find the most recent comment with trigger phrase
        for (let i = comments.length - 1; i >= 0; i--) {
          const comment = comments[i];
          const content = comment.content?.raw || "";
          
          if (content && content.includes(config.triggerPhrase)) {
            logger.info(`Found trigger phrase in comment ${comment.id}`);
            
            // Extract user request
            userRequest = content
              .split(config.triggerPhrase)[1]
              ?.trim() || "";
            
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
              parentCommentId = comment.id;
            }
            
            break;
          }
        }
      } catch (error) {
        logger.warning("Failed to fetch PR comments:", error);
      }
    }

    // Classify the request if we found one
    if (userRequest && config.autoDetectActionable) {
      requestType = classifyRequest(userRequest);
      logger.info(`Request classified as: ${requestType}`);
    }

    // Build prompt from available environment data
    let prompt = `
# Pull Request Review

**Title:** ${context.pullRequest.title}
**Author:** ${context.pullRequest.author}
**Description:** ${context.pullRequest.description || "No description provided"}
**Source:** ${context.pullRequest.sourceBranch} → ${context.pullRequest.destinationBranch}
${userRequest ? `\n## User Request\n${userRequest}\n` : ""}
${inlineContext ? `\n## Inline Comment Context\nThe user commented on **${inlineContext.path}** (lines ${inlineContext.from}-${inlineContext.to})\n` : ""}

## Review Guidelines

Please provide a comprehensive code review covering:

### 1. Code Quality
- Readability and maintainability
- Adherence to coding standards
- Proper naming conventions
- Code organization and structure

### 2. Functionality
- Logic correctness
- Edge case handling
- Input validation
- Error handling

### 3. Performance
- Algorithm efficiency
- Resource usage
- Potential bottlenecks
- Optimization opportunities

### 4. Security
- Input sanitization
- Authentication/authorization checks
- Sensitive data handling
- Common vulnerability patterns

### 5. Testing
- Test coverage adequacy
- Test case quality
- Missing test scenarios

### 6. Documentation
- Code comments clarity
- API documentation
- README updates if needed

## Instructions
${userRequest 
  ? requestType === "actionable" 
    ? `The user has made an actionable request. Implement the requested changes directly.`
    : `The user is asking for information. Provide a detailed explanation without making changes.`
  : "Provide specific, actionable feedback. For each issue found:\n1. Specify the file and line number if possible\n2. Explain the issue clearly\n3. Suggest a concrete improvement\n4. Rate severity: 🔴 Critical | 🟡 Important | 🟢 Minor | 💭 Suggestion"}

Focus on the changes in this pull request and provide constructive feedback.
`;

    // Add PR branch info if available
    if (config.bitbucketAccessToken && config.prId) {
      try {
        const client = new BitbucketClient(config);
        const branchInfo = await client.getPullRequestBranch(config.prId);
        if (branchInfo.source) {
          prompt += `\n## PR Branch Information\n- Source Branch: ${branchInfo.source}\n- Target Branch: ${branchInfo.destination || 'main'}\n`;
          prompt += `\nNote: You are working on the source branch (${branchInfo.source}) of this PR.\n`;
        }
      } catch (error) {
        logger.warning("Failed to fetch PR branch info:", error);
      }
    }

    // Set tools based on request type and configuration
    let allowedTools: string[];
    let blockedTools: string[];

    if (config.allowedTools) {
      // User has explicitly configured tools
      allowedTools = config.allowedTools;
      blockedTools = config.blockedTools || [];
    } else if (userRequest && config.autoDetectActionable) {
      // Auto-detect based on request type
      if (requestType === "actionable") {
        // Allow editing for actionable requests
        allowedTools = ["Read", "Edit", "Write", "Grep", "MultiEdit", "LS", "Glob"];
        blockedTools = ["Computer"];  // Only block Computer, allow Bash for git operations
        logger.info("Actionable request detected - enabling edit tools");
      } else {
        // Read-only for informational requests
        allowedTools = ["Read", "Grep"];
        blockedTools = ["Write", "Edit", "MultiEdit", "Bash", "Computer"];
        logger.info("Informational request detected - using read-only tools");
      }
    } else {
      // Default review mode (read-only)
      allowedTools = ["Read", "Grep"];
      blockedTools = ["Write", "Edit", "MultiEdit", "Bash", "Computer"];
    }

    return {
      prompt,
      allowedTools,
      blockedTools,
      inlineContext,
      parentCommentId,
    };
  }
}