import type { PipeConfig, PrepareResult, BitbucketContext } from "../types/config";
import { getModeHandler } from "../modes/index";
import { logger } from "../utils/logger";

export async function prepare(config: PipeConfig): Promise<PrepareResult> {
  logger.group("Preparing execution context");

  try {
    // Build context from environment variables (no API calls needed)
    const context = buildContextFromEnv(config);
    
    // Get mode handler
    const mode = getModeHandler(config.mode);
    
    // Check if mode should trigger
    const shouldRun = mode.shouldTrigger(config, context);
    
    if (!shouldRun) {
      logger.info(`Mode "${config.mode}" conditions not met for event "${context.eventType}"`);
      return {
        shouldRun: false,
        context,
        prompt: "",
      };
    }
    
    // Prepare mode-specific context
    const modeContext = await mode.prepareContext(config, context);
    
    logger.success("Context prepared successfully");
    logger.groupEnd();
    
    return {
      shouldRun: true,
      context,
      prompt: modeContext.prompt,
      commentId: modeContext.commentId,
      triggerSource: modeContext.triggerSource,
      inlineContext: modeContext.inlineContext,
      parentCommentId: modeContext.parentCommentId,
      commentType: modeContext.inlineContext ? "inline" : "top-level",
      allowedTools: modeContext.allowedTools,
      blockedTools: modeContext.blockedTools,
    };
  } catch (error) {
    logger.error("Failed to prepare context:", error);
    throw error;
  }
}

function buildContextFromEnv(config: PipeConfig): BitbucketContext {
  // Use Bitbucket Pipeline environment variables directly
  // No API calls needed for basic context
  
  const eventType = detectEventType();
  
  const context: BitbucketContext = {
    workspace: config.workspace,
    repoSlug: config.repoSlug,
    eventType,
    actor: process.env.BITBUCKET_STEP_TRIGGERER_UUID || "unknown",
    branch: config.branch || process.env.BITBUCKET_BRANCH,
    repository: {
      name: config.repoSlug,
      fullName: `${config.workspace}/${config.repoSlug}`,
      isPrivate: true, // Assume private by default
      defaultBranch: process.env.BITBUCKET_DEFAULT_BRANCH || "main",
      language: process.env.BITBUCKET_PROJECT_LANGUAGE || "unknown",
    },
  };
  
  // Add PR context if available from environment
  if (config.prId || process.env.BITBUCKET_PR_ID) {
    const prId = config.prId || parseInt(process.env.BITBUCKET_PR_ID!);
    context.pullRequest = {
      id: prId,
      title: process.env.BITBUCKET_PR_TITLE || "Pull Request",
      description: process.env.BITBUCKET_PR_DESCRIPTION || "",
      sourceBranch: process.env.BITBUCKET_BRANCH || "unknown",
      destinationBranch: process.env.BITBUCKET_PR_DESTINATION_BRANCH || "main",
      author: process.env.BITBUCKET_STEP_TRIGGERER_UUID || "unknown",
      state: "OPEN",
      createdOn: new Date().toISOString(),
      updatedOn: new Date().toISOString(),
    };
  }
  
  // Add commit context if available from environment
  if (config.commitHash || process.env.BITBUCKET_COMMIT) {
    const hash = config.commitHash || process.env.BITBUCKET_COMMIT!;
    context.commit = {
      hash,
      message: process.env.BITBUCKET_COMMIT_MESSAGE || "Commit",
      author: process.env.BITBUCKET_STEP_TRIGGERER_UUID || "unknown",
      date: new Date().toISOString(),
    };
  }
  
  return context;
}

function detectEventType(): string {
  // Check pipeline trigger type from Bitbucket environment
  const trigger = process.env.BITBUCKET_PIPELINE_TRIGGER_TYPE;
  
  if (trigger === "PULL_REQUEST") {
    return "pullrequest:created";
  } else if (trigger === "PUSH") {
    return "push";
  } else if (trigger === "TAG") {
    return "tag:created";
  } else if (trigger === "MANUAL") {
    return "custom:manual";
  } else if (trigger === "SCHEDULE") {
    return "custom:schedule";
  }
  
  // Check for PR environment variables
  if (process.env.BITBUCKET_PR_ID) {
    return "pullrequest:updated";
  }
  
  return "unknown";
}