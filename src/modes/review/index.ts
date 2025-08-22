import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { logger } from "../../utils/logger";

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
  }> {
    logger.info("Preparing review mode context...");

    if (!context.pullRequest) {
      throw new Error("Review mode requires a pull request context");
    }

    // Build prompt from available environment data
    const prompt = `
# Pull Request Review

**Title:** ${context.pullRequest.title}
**Author:** ${context.pullRequest.author}
**Description:** ${context.pullRequest.description || "No description provided"}
**Source:** ${context.pullRequest.sourceBranch} → ${context.pullRequest.destinationBranch}

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
Provide specific, actionable feedback. For each issue found:
1. Specify the file and line number if possible
2. Explain the issue clearly
3. Suggest a concrete improvement
4. Rate severity: 🔴 Critical | 🟡 Important | 🟢 Minor | 💭 Suggestion

Focus on the changes in this pull request and provide constructive feedback.
`;

    // Review mode should have limited tool access
    const allowedTools = config.allowedTools || ["Read"];
    const blockedTools = config.blockedTools || ["Write", "Edit", "Bash", "Computer"];

    return {
      prompt,
      allowedTools,
      blockedTools,
    };
  }
}