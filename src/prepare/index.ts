import type { PipeConfig, PrepareResult, BitbucketContext } from "../types/config";
import { getModeHandler } from "../modes/index";
import { BitbucketAPI } from "../bitbucket/api";
import { logger } from "../utils/logger";
import { createTrackingComment } from "../bitbucket/comment";

export async function prepare(config: PipeConfig): Promise<PrepareResult> {
  logger.group("Preparing execution context");

  try {
    // Build Bitbucket context
    const context = await buildContext(config);
    
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
    
    // Create tracking comment if in tag mode with PR
    let commentId: string | undefined;
    if (config.mode === "tag" && context.pullRequest) {
      commentId = await createTrackingComment(config, context.pullRequest.id);
    }
    
    // Prepare branch if auto-commit is enabled
    let branch: string | undefined;
    if (config.autoCommit) {
      branch = await prepareBranch(config, context);
    }
    
    logger.success("Context prepared successfully");
    logger.groupEnd();
    
    return {
      shouldRun: true,
      context,
      prompt: modeContext.prompt,
      commentId,
      branch,
    };
  } catch (error) {
    logger.error("Failed to prepare context:", error);
    throw error;
  }
}

async function buildContext(config: PipeConfig): Promise<BitbucketContext> {
  const api = new BitbucketAPI(config);
  
  // Determine event type from environment
  const eventType = detectEventType();
  
  // Get repository information
  const repository = await api.getRepository();
  
  // Build base context
  const context: BitbucketContext = {
    workspace: config.workspace,
    repoSlug: config.repoSlug,
    eventType,
    actor: process.env.BITBUCKET_STEP_TRIGGERER_UUID || "unknown",
    branch: config.branch,
    repository: {
      name: repository.name,
      fullName: repository.full_name,
      isPrivate: repository.is_private,
      defaultBranch: repository.mainbranch?.name || "main",
      language: repository.language || "unknown",
    },
  };
  
  // Add PR context if available
  if (config.prId) {
    const pr = await api.getPullRequest(config.prId);
    context.pullRequest = {
      id: pr.id,
      title: pr.title,
      description: pr.description || "",
      sourceBranch: pr.source.branch.name,
      destinationBranch: pr.destination.branch.name,
      author: pr.author.display_name,
      state: pr.state,
      createdOn: pr.created_on,
      updatedOn: pr.updated_on,
    };
  }
  
  // Add commit context if available
  if (config.commitHash) {
    const commit = await api.getCommit(config.commitHash);
    context.commit = {
      hash: commit.hash,
      message: commit.message,
      author: commit.author.user?.display_name || commit.author.raw,
      date: commit.date,
    };
  }
  
  return context;
}

function detectEventType(): string {
  // Check pipeline trigger type
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

async function prepareBranch(config: PipeConfig, context: BitbucketContext): Promise<string> {
  const api = new BitbucketAPI(config);
  
  // Generate branch name
  const timestamp = Date.now();
  const branchName = `${config.branchPrefix}${context.eventType}-${timestamp}`;
  
  logger.info(`Creating branch: ${branchName}`);
  
  // Create branch from current ref
  const sourceBranch = config.branch || context.repository.defaultBranch;
  await api.createBranch(branchName, sourceBranch);
  
  return branchName;
}