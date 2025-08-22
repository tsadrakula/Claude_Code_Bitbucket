import type { Mode } from "../index";
import type { PipeConfig, BitbucketContext } from "../../types/config";
import { logger } from "../../utils/logger";

export class AgentMode implements Mode {
  name = "agent";

  shouldTrigger(config: PipeConfig, _context: BitbucketContext): boolean {
    // Agent mode is for automated/scheduled runs
    // Always triggers when explicitly set
    return config.mode === "agent";
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
    logger.info("Preparing agent mode context...");

    // Agent mode uses a predefined prompt from environment or config
    const customPrompt = process.env.CLAUDE_AGENT_PROMPT || "";
    
    let prompt = customPrompt || `
# Automated Agent Execution

**Repository:** ${context.repository.fullName}
**Branch:** ${context.branch || context.repository.defaultBranch || "main"}
**Triggered:** Automated/Scheduled

## Task
Perform automated code analysis and improvements:
1. Check for code quality issues
2. Identify potential bugs or security vulnerabilities
3. Suggest performance optimizations
4. Review documentation completeness
5. Check test coverage

## Instructions
You are running in agent mode as an automated assistant. Provide a comprehensive analysis of the codebase and suggest improvements.
`;

    // In agent mode, we typically want minimal MCP tools
    const allowedTools = config.allowedTools || ["Read", "Write", "Edit"];
    const blockedTools = config.blockedTools || ["Bash", "Computer"];

    return {
      prompt,
      allowedTools,
      blockedTools,
    };
  }
}