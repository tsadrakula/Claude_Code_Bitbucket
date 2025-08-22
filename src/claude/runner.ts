import { execa } from "execa";
import { writeFile, readFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { PipeConfig, BitbucketContext, ClaudeResult, ConversationTurn } from "../types/config";
import { logger } from "../utils/logger";
import { createMcpServers } from "../mcp/servers";

interface RunOptions {
  config: PipeConfig;
  context: BitbucketContext;
  prompt: string;
}

export async function runClaudeCode(options: RunOptions): Promise<ClaudeResult> {
  const { config, prompt } = options;
  const startTime = Date.now();
  
  logger.group("Running Claude Code");
  
  try {
    // Create temporary directory for execution
    const tempDir = await mkdtemp(join(tmpdir(), "claude-"));
    logger.debug(`Created temp directory: ${tempDir}`);
    
    // Write context files
    const contextFile = join(tempDir, "context.md");
    await writeFile(contextFile, prompt);
    
    // Write configuration file for Claude Code
    const configFile = join(tempDir, "claude-config.json");
    const claudeConfig = {
      model: config.model,
      maxTurns: config.maxTurns,
      allowedTools: config.allowedTools,
      blockedTools: config.blockedTools,
    };
    await writeFile(configFile, JSON.stringify(claudeConfig, null, 2));
    
    // Prepare environment variables
    const env = prepareEnvironment(config);
    
    // Set up MCP servers for Bitbucket operations
    const mcpServers = createMcpServers(config);
    if (mcpServers.length > 0) {
      logger.info("MCP servers configured for Bitbucket operations");
      // Add MCP server configuration to environment
      env.MCP_SERVERS = JSON.stringify(mcpServers);
    }
    
    // Build Claude Code command
    const args = buildClaudeCommand(config, contextFile, tempDir);
    
    logger.info(`Executing Claude Code with model: ${config.model}`);
    logger.debug(`Command: npx claude-code ${args.join(" ")}`);
    
    // Execute Claude Code CLI
    const result = await execa("npx", ["claude-code", ...args], {
      env,
      cwd: process.cwd(),
      timeout: config.timeoutMinutes * 60 * 1000,
      reject: false,
      preferLocal: false,
    });
    
    // Parse execution results
    const turns = await parseExecutionResults(tempDir);
    
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
    
    const executionTime = Date.now() - startTime;
    
    if (result.exitCode === 0) {
      logger.success(`Claude Code completed successfully in ${executionTime}ms`);
      return {
        turns,
        status: "success",
        executionTime,
        executionFile: join(tempDir, "execution.json"),
      };
    } else {
      logger.error(`Claude Code failed with exit code ${result.exitCode}`);
      return {
        turns,
        status: "error",
        executionTime,
        error: result.stderr || "Unknown error",
      };
    }
  } catch (error: any) {
    if (error.code === "ETIMEDOUT") {
      logger.error("Claude Code execution timed out");
      return {
        turns: [],
        status: "timeout",
        executionTime: config.timeoutMinutes * 60 * 1000,
        error: `Execution timed out after ${config.timeoutMinutes} minutes`,
      };
    }
    
    logger.error("Failed to run Claude Code:", error);
    throw error;
  } finally {
    logger.groupEnd();
  }
}

function prepareEnvironment(config: PipeConfig): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env,
    // Claude Code CLI will read these environment variables
    CLAUDE_MODEL: config.model,
    CLAUDE_MAX_TURNS: config.maxTurns.toString(),
  };
  
  // Set authentication based on provider
  if (config.anthropicApiKey) {
    env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  } else if (config.awsAccessKeyId) {
    // For AWS Bedrock via Claude Code
    env.AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
    env.AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey || "";
    env.AWS_REGION = config.awsRegion || "us-east-1";
    env.CLAUDE_PROVIDER = "bedrock";
  } else if (config.gcpProjectId) {
    // For Google Vertex AI via Claude Code
    env.GCP_PROJECT_ID = config.gcpProjectId;
    env.GCP_REGION = config.gcpRegion || "us-central1";
    if (config.gcpServiceAccountKey) {
      env.GOOGLE_APPLICATION_CREDENTIALS = config.gcpServiceAccountKey;
    }
    env.CLAUDE_PROVIDER = "vertex";
  }
  
  return env;
}

function buildClaudeCommand(
  config: PipeConfig, 
  contextFile: string,
  outputDir: string
): string[] {
  const args: string[] = [];
  
  // Add context/prompt
  args.push("--prompt-file", contextFile);
  
  // Add output directory
  args.push("--output", outputDir);
  
  // Add model
  args.push("--model", config.model);
  
  // Add max turns
  args.push("--max-turns", config.maxTurns.toString());
  
  // Add timeout
  args.push("--timeout", `${config.timeoutMinutes}m`);
  
  // Add allowed tools
  if (config.allowedTools && config.allowedTools.length > 0) {
    args.push("--allowed-tools", config.allowedTools.join(","));
  }
  
  // Add blocked tools
  if (config.blockedTools && config.blockedTools.length > 0) {
    args.push("--blocked-tools", config.blockedTools.join(","));
  }
  
  // Add verbose flag
  if (config.verbose) {
    args.push("--verbose");
  }
  
  // Add no-interactive flag for CI/CD environments
  args.push("--no-interactive");
  
  // Add JSON output for parsing
  args.push("--format", "json");
  
  return args;
}

async function parseExecutionResults(outputDir: string): Promise<ConversationTurn[]> {
  try {
    // Claude Code outputs results in a specific format
    const executionFile = join(outputDir, "execution.json");
    const content = await readFile(executionFile, "utf-8");
    const data = JSON.parse(content);
    
    // Convert Claude Code output format to our ConversationTurn format
    if (data.conversation && Array.isArray(data.conversation)) {
      return data.conversation.map((turn: any) => ({
        role: turn.role,
        content: turn.content,
        timestamp: turn.timestamp || new Date().toISOString(),
        tools: turn.tools || [],
      }));
    }
    
    return data.turns || [];
  } catch (error) {
    logger.warning("Could not parse execution results:", error);
    return [];
  }
}