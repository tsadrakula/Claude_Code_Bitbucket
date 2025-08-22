#!/usr/bin/env bun
import { prepare } from "./prepare/index";
import { runClaudeCode } from "./claude/runner";
import { updateComment } from "./bitbucket/comment";
import { formatTurns } from "./format/turns";
import { collectInputs } from "./entrypoints/collect-inputs";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  try {
    logger.info("Claude Bitbucket Pipe starting...");

    // Collect and validate inputs
    const config = await collectInputs();
    
    // Prepare the execution context
    const prepareResult = await prepare(config);
    
    if (!prepareResult.shouldRun) {
      logger.info("No action needed for this event");
      return;
    }

    // Run Claude Code
    const result = await runClaudeCode({
      config,
      context: prepareResult.context,
      prompt: prepareResult.prompt,
    });

    // Format the conversation turns
    const formattedOutput = await formatTurns(result.turns);

    // Output results (since we're not updating PR comments via API)
    await updateComment({
      commentId: "console",
      content: formattedOutput,
      status: result.status,
    });

    // Log summary
    logger.success(`✅ Claude Code completed successfully`);
    logger.info(`Total turns: ${result.turns.length}`);
    logger.info(`Execution time: ${result.executionTime}ms`);

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
        }, null, 2)
      );
    }

  } catch (error) {
    logger.error("Fatal error in Claude Bitbucket Pipe:", error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  main();
}