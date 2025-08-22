#!/usr/bin/env bun
import { prepare } from "./prepare/index";
import { runClaudeCode } from "./claude/runner";
import { updateComment } from "./bitbucket/comment";
import { formatTurns } from "./format/turns";
import { collectInputs } from "./entrypoints/collect-inputs";
import { logger } from "./utils/logger";
import { ensureClaudeCLI } from "./utils/install-claude";

async function main(): Promise<void> {
  try {
    logger.info("Claude Bitbucket Pipe starting...");
    
    // Ensure Claude CLI is installed
    await ensureClaudeCLI();

    // Collect and validate inputs
    const config = await collectInputs();
    
    // Check for Bitbucket access token early
    if (!config.bitbucketAccessToken) {
      logger.warning("⚠️ BITBUCKET_ACCESS_TOKEN not set - Claude cannot post responses to PRs");
      logger.warning("Please set BITBUCKET_ACCESS_TOKEN in repository variables for full functionality");
    }
    
    // Prepare the execution context
    const prepareResult = await prepare(config);
    
    if (!prepareResult.shouldRun) {
      logger.info("No action needed for this event");
      return;
    }

    // Run Claude Code with streaming
    logger.info("Starting Claude Code execution...");
    
    const result = await runClaudeCode({
      config,
      context: prepareResult.context,
      prompt: prepareResult.prompt,
      prId: config.prId,
      commentId: prepareResult.commentId,
      inlineContext: prepareResult.inlineContext,
      parentCommentId: prepareResult.parentCommentId,
      allowedTools: prepareResult.allowedTools,
      blockedTools: prepareResult.blockedTools,
    });

    // Format the conversation turns if needed for logging
    const formattedOutput = await formatTurns(result.turns);

    // If streaming didn't work or no PR access, output to console
    if (!config.bitbucketAccessToken || !config.prId) {
      await updateComment({
        config,
        prId: config.prId,
        commentId: prepareResult.commentId,
        content: formattedOutput,
        status: result.status,
      });
    }

    // Log summary
    logger.success(`Claude Code completed successfully`);
    logger.info(`Total turns: ${result.turns.length}`);
    logger.info(`Execution time: ${result.executionTime}ms`);
    if (prepareResult.triggerSource) {
      logger.info(`Trigger source: ${prepareResult.triggerSource}`);
    }

    // Set output variables for pipeline
    if (process.env.BITBUCKET_PIPE_STORAGE_DIR) {
      const fs = await import("fs/promises");
      const path = await import("path");
      const outputFile = path.join(
        process.env.BITBUCKET_PIPE_STORAGE_DIR,
        "claude_output.json"
      );
      
      await fs.writeFile(
        outputFile,
        JSON.stringify({
          branch: prepareResult.branch,
          executionFile: result.executionFile,
          status: result.status,
          turns: result.turns.length,
          triggerSource: prepareResult.triggerSource,
        }, null, 2)
      );
    }

  } catch (error) {
    logger.error("Fatal error in Claude Bitbucket Pipe:", error);
    
    // Try to post error to PR if possible
    const config = await collectInputs().catch(() => null);
    if (config?.prId && config?.bitbucketAccessToken) {
      try {
        await updateComment({
          config,
          prId: config.prId,
          content: `## Error

An error occurred while processing your request:

\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

Please check the pipeline logs for more details.`,
          status: "error",
        });
      } catch {
        // Ignore errors when posting error comment
      }
    }
    
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  main();
}