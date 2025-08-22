import { spawn } from "child_process";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";
import type { PipeConfig, BitbucketContext, ClaudeResult, ConversationTurn } from "../types/config";
import { logger } from "../utils/logger";
import { createMcpServers } from "../mcp/servers";
import { updateCommentStream } from "../bitbucket/comment-stream";

interface RunOptions {
  config: PipeConfig;
  context: BitbucketContext;
  prompt: string;
  prId?: number;
  commentId?: string;
}

interface StreamEvent {
  type: string;
  data?: any;
  content?: string;
  tool?: any;
}

export async function runClaudeCode(options: RunOptions): Promise<ClaudeResult> {
  const { config, prompt, prId, commentId } = options;
  const startTime = Date.now();
  
  logger.group("Running Claude Code");
  
  let tempDir: string | null = null;
  const turns: ConversationTurn[] = [];
  let currentContent = "";
  let status: "success" | "error" | "timeout" = "success";
  let error: string | undefined;
  
  try {
    // Create temporary directory for execution
    tempDir = await mkdtemp(join(tmpdir(), "claude-"));
    logger.debug(`Created temp directory: ${tempDir}`);
    
    // Write prompt to file
    const promptFile = join(tempDir, "prompt.md");
    await writeFile(promptFile, prompt);
    
    // Prepare environment variables
    const env = prepareEnvironment(config);
    
    // Set up MCP servers for Bitbucket operations
    const mcpServers = createMcpServers(config);
    if (mcpServers.length > 0) {
      logger.info("MCP servers configured for Bitbucket operations");
      // Write MCP config to file
      const mcpConfigFile = join(tempDir, "mcp-config.json");
      await writeFile(mcpConfigFile, JSON.stringify({ servers: mcpServers }, null, 2));
      env.MCP_CONFIG_FILE = mcpConfigFile;
    }
    
    // Build Claude command arguments
    const args = buildClaudeArgs(config, mcpServers.length > 0 ? join(tempDir, "mcp-config.json") : undefined);
    
    logger.info(`Executing Claude Code with model: ${config.model}`);
    logger.debug(`Command: claude ${args.join(" ")}`);
    
    // Post initial comment if we have PR access
    if (prId && config.bitbucketAccessToken) {
      await updateCommentStream({
        config,
        prId,
        commentId,
        content: "🤖 Claude is responding...\n\n",
        isPartial: true
      });
    }
    
    // Determine claude binary path
    let claudeBin = "claude";
    if (process.env.CLAUDE_BIN_PATH) {
      claudeBin = join(process.env.CLAUDE_BIN_PATH, "claude");
    } else if (!env.PATH?.includes(".local/bin")) {
      // Fallback to full path if PATH might not be set correctly
      claudeBin = join(homedir(), ".local", "bin", "claude");
    }
    
    // Spawn Claude process
    const claudeProcess = spawn(claudeBin, args, {
      env,
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "inherit"]
    });
    
    // Set timeout
    const timeout = setTimeout(() => {
      logger.error("Claude Code execution timed out");
      claudeProcess.kill("SIGTERM");
      status = "timeout";
      error = `Execution timed out after ${config.timeoutMinutes} minutes`;
    }, config.timeoutMinutes * 60 * 1000);
    
    // Handle stdout for streaming JSON
    let buffer = "";
    claudeProcess.stdout.on("data", async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const event: StreamEvent = JSON.parse(line);
          
          // Handle different event types
          if (event.type === "message" && event.content) {
            currentContent += event.content;
            
            // Update PR comment with partial content
            if (prId && config.bitbucketAccessToken) {
              await updateCommentStream({
                config,
                prId,
                commentId,
                content: currentContent,
                isPartial: true
              });
            }
          } else if (event.type === "tool_use") {
            // Log tool usage
            logger.info(`Tool used: ${event.tool?.name || "unknown"}`);
            
            // Add to conversation turns
            turns.push({
              role: "assistant",
              content: `Using tool: ${event.tool?.name}`,
              timestamp: new Date().toISOString(),
              tools: [event.tool]
            });
          } else if (event.type === "completion") {
            // Final completion
            if (event.data?.content) {
              currentContent = event.data.content;
            }
          }
        } catch (e) {
          // Not JSON, might be regular output
          if (config.verbose) {
            logger.debug("Non-JSON output:", line);
          }
        }
      }
    });
    
    // Send prompt file to stdin
    claudeProcess.stdin.write(await readFile(promptFile));
    claudeProcess.stdin.end();
    
    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      claudeProcess.on("exit", (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          logger.success("Claude Code completed successfully");
          resolve();
        } else if (status === "timeout") {
          resolve(); // Already handled
        } else {
          status = "error";
          error = `Claude exited with code ${code}`;
          resolve();
        }
      });
      
      claudeProcess.on("error", (err) => {
        clearTimeout(timeout);
        logger.error("Claude process error:", err);
        status = "error";
        error = err.message;
        reject(err);
      });
    });
    
    // Add final turn
    if (currentContent) {
      turns.push({
        role: "assistant",
        content: currentContent,
        timestamp: new Date().toISOString(),
        tools: []
      });
    }
    
    const executionTime = Date.now() - startTime;
    
    // Post final comment
    if (prId && config.bitbucketAccessToken && currentContent) {
      await updateCommentStream({
        config,
        prId,
        commentId,
        content: currentContent,
        isPartial: false,
        status
      });
    }
    
    return {
      turns,
      status,
      executionTime,
      error
    };
  } catch (error: any) {
    logger.error("Failed to run Claude Code:", error);
    return {
      turns,
      status: "error",
      executionTime: Date.now() - startTime,
      error: error.message
    };
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        logger.debug("Failed to clean up temp directory:", e);
      }
    }
    logger.groupEnd();
  }
}

function prepareEnvironment(config: PipeConfig): Record<string, string> {
  const env: Record<string, string> = {};
  
  // Copy existing environment variables, filtering out undefined values
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  
  // Set authentication based on provider
  if (config.anthropicApiKey) {
    env.ANTHROPIC_API_KEY = config.anthropicApiKey;
  } else if (config.awsAccessKeyId) {
    // For AWS Bedrock
    env.AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
    env.AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey || "";
    env.AWS_REGION = config.awsRegion || "us-east-1";
  } else if (config.gcpProjectId) {
    // For Google Vertex AI
    env.GCP_PROJECT_ID = config.gcpProjectId;
    env.GCP_REGION = config.gcpRegion || "us-central1";
    if (config.gcpServiceAccountKey) {
      env.GOOGLE_APPLICATION_CREDENTIALS = config.gcpServiceAccountKey;
    }
  }
  
  return env;
}

function buildClaudeArgs(config: PipeConfig, mcpConfigFile?: string): string[] {
  const args: string[] = [
    "-p", // Pipe mode
    "--verbose",
    "--output-format", "stream-json"
  ];
  
  // Add model
  if (config.model) {
    args.push("--model", config.model);
  }
  
  // Add max turns
  if (config.maxTurns > 0) {
    args.push("--max-turns", config.maxTurns.toString());
  }
  
  // Add allowed tools
  if (config.allowedTools && config.allowedTools.length > 0) {
    args.push("--allowed-tools", config.allowedTools.join(","));
  }
  
  // Add blocked tools
  if (config.blockedTools && config.blockedTools.length > 0) {
    args.push("--disallowed-tools", config.blockedTools.join(","));
  }
  
  // Add MCP config if available
  if (mcpConfigFile) {
    args.push("--mcp-config", mcpConfigFile);
  }
  
  // Note: Custom instructions/system prompt would go here if supported
  // The config doesn't currently have a customInstructions field
  
  return args;
}

// Helper function to read file (import was missing)
import { readFile } from "fs/promises";