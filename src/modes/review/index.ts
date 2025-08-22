import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { BitbucketAPI } from "../../bitbucket/api";
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

    const api = new BitbucketAPI(config);
    
    // Get PR details
    const pr = await api.getPullRequest(context.pullRequest.id);
    
    // Get diff
    const diff = await api.getPullRequestDiff(context.pullRequest.id);
    
    // Get existing comments for context
    const comments = await api.getPullRequestComments(context.pullRequest.id);
    
    // Extract files from diff
    const files = this.extractFilesFromDiff(diff);

    const prompt = `
# Pull Request Review

**Title:** ${pr.title}
**Author:** ${pr.author.display_name}
**Description:** ${pr.description || "No description provided"}
**Source:** ${pr.source.branch.name} → ${pr.destination.branch.name}
**Files Changed:** ${files.length}
**Lines Added:** ${pr.lines_added || "N/A"}
**Lines Removed:** ${pr.lines_removed || "N/A"}

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

## Diff Summary
\`\`\`diff
${diff.substring(0, 10000)}${diff.length > 10000 ? "\n... (truncated)" : ""}
\`\`\`

## Previous Comments
${comments.length > 0 ? comments.slice(-5).map(c => 
  `- @${c.user.display_name}: ${c.content.raw.substring(0, 200)}`
).join("\n") : "No previous comments"}

## Instructions
Provide specific, actionable feedback. For each issue found:
1. Specify the file and line number
2. Explain the issue clearly
3. Suggest a concrete improvement
4. Rate severity: 🔴 Critical | 🟡 Important | 🟢 Minor | 💭 Suggestion

Format your response as inline comments that can be posted to the PR.
`;

    // Review mode should have limited tool access
    const allowedTools = config.allowedTools || ["Read"];
    const blockedTools = config.blockedTools || ["Write", "Edit", "Bash", "Computer"];

    return {
      prompt,
      files,
      allowedTools,
      blockedTools,
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