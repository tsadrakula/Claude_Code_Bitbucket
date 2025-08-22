#!/usr/bin/env bun
import { prepare } from "./prepare/index";
import { runClaudeCode } from "./claude/runner";
import { updateComment } from "./bitbucket/comment";
import { ClaudeLoader } from "./bitbucket/loader";
import { formatTurns } from "./format/turns";
import { collectInputs } from "./entrypoints/collect-inputs";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  try {
    logger.info("Claude Bitbucket Pipe starting...");

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

    // Initialize loader if we have a PR
    let loader: ClaudeLoader | undefined;
    if (config.prId && config.bitbucketAccessToken) {
      logger.info("Initializing Claude loader for PR #" + config.prId);
      loader = new ClaudeLoader(config, config.prId);
      await loader.postInitialLoader();
    }

    // Update loader: analyzing
    if (loader) {
      await loader.updateState({ analyzing: "in_progress" });
    }

    // Run Claude Code
    logger.info("Starting Claude Code execution...");
    
    // Update loader: reading files
    if (loader) {
      await loader.updateState({ 
        analyzing: "completed",
        reading: "in_progress" 
      });
    }

    const result = await runClaudeCode({
      config,
      context: prepareResult.context,
      prompt: prepareResult.prompt,
    });

    // Update loader: generating response
    if (loader) {
      await loader.updateState({ 
        reading: "completed",
        generating: "in_progress" 
      });
    }

    // Format the conversation turns
    const formattedOutput = await formatTurns(result.turns);

    // Post final response
    if (loader) {
      // Replace loader with final response
      await loader.replaceWithFinalResponse(formattedOutput, result.status);
    } else {
      // Output results (fallback to console or basic comment)
      await updateComment({
        config,
        prId: config.prId,
        commentId: prepareResult.commentId,
        content: formattedOutput,
        status: result.status,
      });
    }

    // Log summary
    logger.success(`✅ Claude Code completed successfully`);
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
          content: `## ❌ Error

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