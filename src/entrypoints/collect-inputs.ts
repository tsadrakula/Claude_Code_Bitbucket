import { PipeConfigSchema, type PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export async function collectInputs(): Promise<PipeConfig> {
  logger.info("Collecting pipeline inputs...");

  // Parse environment variables
  const env = process.env;

  // Bitbucket-specific environment variables
  const workspace = env.BITBUCKET_WORKSPACE || "";
  const repoSlug = env.BITBUCKET_REPO_SLUG || "";
  const prId = env.BITBUCKET_PR_ID ? parseInt(env.BITBUCKET_PR_ID) : undefined;
  const commitHash = env.BITBUCKET_COMMIT || "";
  const branch = env.BITBUCKET_BRANCH || "";

  // Parse comma-separated tool lists
  const allowedTools = env.ALLOWED_TOOLS?.split(",").map(t => t.trim()).filter(Boolean);
  const blockedTools = env.BLOCKED_TOOLS?.split(",").map(t => t.trim()).filter(Boolean);

  // Build configuration object
  const rawConfig = {
    // Core settings
    mode: env.MODE || "tag",
    triggerPhrase: env.TRIGGER_PHRASE || "@claude",
    
    // Authentication
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    bitbucketAccessToken: env.BITBUCKET_ACCESS_TOKEN,
    
    // Model settings
    model: env.MODEL || "sonnet",  // Use simple alias for latest Sonnet
    fallbackModel: env.FALLBACK_MODEL || "opus",  // Use simple alias for Opus
    maxTurns: env.MAX_TURNS ? parseInt(env.MAX_TURNS) : 30,
    timeoutMinutes: env.TIMEOUT_MINUTES ? parseInt(env.TIMEOUT_MINUTES) : 10,
    
    // Tools
    allowedTools,
    blockedTools,
    
    // Branch/commit settings
    branchPrefix: env.BRANCH_PREFIX || "claude/",
    autoCommit: env.AUTO_COMMIT === "true",
    autoPR: env.AUTO_PR === "true",
    
    // AWS Bedrock
    awsRegion: env.AWS_REGION,
    awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    
    // Google Vertex AI
    gcpProjectId: env.GCP_PROJECT_ID,
    gcpRegion: env.GCP_REGION,
    gcpServiceAccountKey: env.GCP_SERVICE_ACCOUNT_KEY,
    
    // Bitbucket context
    workspace,
    repoSlug,
    prId,
    commitHash,
    branch,
    
    // Options
    verbose: env.VERBOSE === "true" || true, // Default to true for debugging
    dryRun: env.DRY_RUN === "true",
  };

  // Validate and parse configuration
  try {
    const config = PipeConfigSchema.parse(rawConfig);
    
    // Validate authentication
    if (!config.anthropicApiKey && !config.awsAccessKeyId && !config.gcpProjectId) {
      throw new Error(
        "No authentication configured. Please provide one of: ANTHROPIC_API_KEY, AWS credentials, or GCP credentials"
      );
    }
    
    // Validate Bitbucket context
    if (!config.workspace || !config.repoSlug) {
      throw new Error(
        "Missing Bitbucket context. Ensure BITBUCKET_WORKSPACE and BITBUCKET_REPO_SLUG are set"
      );
    }
    
    logger.success("✅ Configuration validated successfully");
    
    if (config.verbose) {
      logger.debug("Configuration:", {
        mode: config.mode,
        model: config.model,
        workspace: config.workspace,
        repoSlug: config.repoSlug,
        prId: config.prId,
        branch: config.branch,
      });
    }
    
    return config;
  } catch (error) {
    logger.error("Configuration validation failed:", error);
    throw error;
  }
}