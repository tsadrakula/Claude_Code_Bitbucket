import { spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";
import type { PipeConfig, BitbucketContext, ClaudeResult, ConversationTurn } from "../types/config";
import { logger } from "../utils/logger";
import { updateCommentStream } from "../bitbucket/comment-stream";

interface RunOptions {
  config: PipeConfig;
  context: BitbucketContext;
  prompt: string;
  prId?: number;
  commentId?: string;
  inlineContext?: {
    path: string;
    from: number | null;
    to: number | null;
  };
  parentCommentId?: string;
  allowedTools?: string[];
  blockedTools?: string[];
}

interface StreamEvent {
  type: string;
  subtype?: string;
  data?: any;
  content?: string;
  tool?: any;
  message?: {
    id: string;
    type: string;
    role: string;
    model: string;
    content: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: any;
    }>;
    stop_reason?: string | null;
    usage?: any;
  };
  result?: string;
}

export async function runClaudeCode(options: RunOptions): Promise<ClaudeResult> {
  const { config, prompt, prId, commentId, inlineContext, parentCommentId, allowedTools, blockedTools } = options;
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
    
    // Prepare environment variables
    const env = prepareEnvironment(config);
    
    // MCP servers are not working with Claude CLI yet, skip for now
    // TODO: Fix MCP server configuration format for Claude CLI
    
    // Build Claude command arguments (include prompt as argument)
    // Pass the tools from RunOptions if provided, otherwise use config defaults
    const args = buildClaudeArgs(
      { ...config, allowedTools: allowedTools || config.allowedTools, blockedTools: blockedTools || config.blockedTools },
      prompt
    );
    
    logger.info(`Executing Claude Code with model: ${config.model}`);
    if (allowedTools && allowedTools.length > 0) {
      logger.info(`Allowed tools: ${allowedTools.join(", ")}`);
    }
    if (blockedTools && blockedTools.length > 0) {
      logger.info(`Blocked tools: ${blockedTools.join(", ")}`);
    }
    logger.info(`Full command: claude ${args.join(" ")}`);
    console.log("[DEBUG] Full args array:", args);
    
    // Post initial comment only if streaming is enabled
    if (prId && config.bitbucketAccessToken && config.enableStreamingComments) {
      await updateCommentStream({
        config,
        prId,
        commentId,
        content: "",  // Start with empty content, the formatter will add the prefix
        isPartial: true,
        inlineContext,
        parentCommentId
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
    
    // Log authentication status
    if (env.ANTHROPIC_API_KEY) {
      logger.info("Using Anthropic API key for authentication");
      console.log("[DEBUG] API key length:", env.ANTHROPIC_API_KEY.length);
      console.log("[DEBUG] API key starts with:", env.ANTHROPIC_API_KEY.substring(0, 10) + "...");
    } else if (env.AWS_ACCESS_KEY_ID) {
      logger.info("Using AWS Bedrock for authentication");
    } else if (env.GCP_PROJECT_ID) {
      logger.info("Using Google Vertex AI for authentication");
    } else {
      logger.warning("⚠️ No authentication configured - Claude may not work!");
    }
    
    // Test Claude CLI is working
    try {
      const { execSync } = await import("child_process");
      const version = execSync(`${claudeBin} --version`, { encoding: "utf-8" });
      logger.info(`Claude CLI version: ${version.trim()}`);
    } catch (e: any) {
      logger.error(`Failed to run claude --version: ${e.message}`);
      logger.error(`Claude binary might not be working correctly at: ${claudeBin}`);
    }
    
    // Determine the working directory - should be the repository being analyzed
    // Priority: 1. Config override, 2. BITBUCKET_CLONE_DIR, 3. Current directory
    const workingDir = config.workingDirectory || process.env.BITBUCKET_CLONE_DIR || process.cwd();
    
    // Spawn Claude process in the correct directory
    logger.debug(`Running command: ${claudeBin} ${args.join(" ")}`);
    logger.debug(`Working directory: ${workingDir}`);
    
    const claudeProcess = spawn(claudeBin, args, {
      env,
      cwd: workingDir,  // Use the repository directory
      stdio: ["pipe", "pipe", "pipe"] // stdin, stdout, stderr all piped
    });
    
    console.log("[DEBUG] Claude process spawned with PID:", claudeProcess.pid);
    
    // Set timeout
    const timeout = setTimeout(() => {
      logger.error("Claude Code execution timed out");
      claudeProcess.kill("SIGTERM");
      status = "timeout";
      error = `Execution timed out after ${config.timeoutMinutes} minutes`;
    }, config.timeoutMinutes * 60 * 1000);
    
    // Handle stderr
    let stderrBuffer = "";
    let stderrOutput = "";
    claudeProcess.stderr.on("data", (chunk) => {
      const chunkStr = chunk.toString();
      stderrBuffer += chunkStr;
      stderrOutput += chunkStr;
      
      // Always log stderr to catch errors
      if (chunkStr.trim()) {
        console.error("CLAUDE STDERR:", chunkStr);
      }
      
      const lines = stderrBuffer.split("\n");
      stderrBuffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.trim()) {
          logger.warning("Claude stderr:", line);
        }
      }
    });
    
    // Handle stdout for streaming JSON
    let buffer = "";
    let hasOutput = false;
    let totalOutput = "";
    let chunkCount = 0;
    claudeProcess.stdout.on("data", async (chunk) => {
      const chunkStr = chunk.toString();
      buffer += chunkStr;
      totalOutput += chunkStr;
      chunkCount++;
      
      // Log first few chunks to see what's happening
      if (chunkCount <= 3) {
        console.log(`CLAUDE STDOUT (chunk ${chunkCount}):\n`, chunkStr);
        hasOutput = true;
      }
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const event: StreamEvent = JSON.parse(line);
          logger.debug("Claude event:", event.type);
          
          // Handle different event types
          if (event.type === "assistant" && event.message) {
            // Handle assistant messages
            const message = event.message;
            if (message.content && Array.isArray(message.content)) {
              for (const content of message.content) {
                if (content.type === "text") {
                  currentContent += content.text;
                  logger.debug("Assistant text:", content.text);
                  
                  // Only update PR comment if streaming is enabled
                  if (prId && config.bitbucketAccessToken && config.enableStreamingComments) {
                    await updateCommentStream({
                      config,
                      prId,
                      commentId,
                      content: currentContent,
                      isPartial: true,
                      inlineContext,
                      parentCommentId
                    });
                  }
                } else if (content.type === "tool_use") {
                  logger.info(`Tool used: ${content.name || "unknown"}`);
                  turns.push({
                    role: "assistant",
                    content: `Using tool: ${content.name}`,
                    timestamp: new Date().toISOString(),
                    tools: [{
                      name: content.name || "unknown",
                      input: content.input || {},
                      output: null
                    }]
                  });
                }
              }
            }
          } else if (event.type === "result") {
            // Final result
            if (event.result) {
              // The final result contains the complete output
              if (!currentContent && event.result) {
                currentContent = event.result;
              }
              logger.debug("Final result received");
            }
          } else if (event.type === "completion") {
            // Legacy completion format
            if (event.data?.content) {
              currentContent = event.data.content;
            }
          }
        } catch (e) {
          // Not JSON, might be regular output
          logger.debug("Non-JSON output:", line);
        }
      }
    });
    
    // Since we're passing the prompt as an argument, we don't need to write to stdin
    // Just close stdin immediately
    claudeProcess.stdin.end();
    
    // Add stdout end handler
    claudeProcess.stdout.on("end", () => {
      console.log("[DEBUG] Stdout ended. Total output length:", totalOutput.length);
      if (buffer.trim()) {
        console.log("[DEBUG] Remaining buffer:", buffer);
      }
    });
    
    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      claudeProcess.on("exit", (code) => {
        clearTimeout(timeout);
        
        logger.info(`Claude process exited with code: ${code}`);
        
        if (!hasOutput) {
          logger.warning("Claude produced no output - check authentication and prompt");
        }
        
        if (stderrOutput) {
          logger.error("Claude stderr output:", stderrOutput);
          error = stderrOutput;
        }
        
        if (code === 0) {
          logger.success("Claude Code completed successfully");
          resolve();
        } else if (status === "timeout") {
          resolve(); // Already handled
        } else {
          status = "error";
          error = error || `Claude exited with code ${code}`;
          logger.error(`Claude failed with exit code ${code}`);
          
          // Log total output for debugging
          if (totalOutput) {
            console.log("[DEBUG] Total Claude output:", totalOutput.substring(0, 1000));
          }
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
    
    // Post final comment (always post unless strategy is 'stream' only)
    if (prId && config.bitbucketAccessToken && currentContent && config.commentUpdateStrategy !== "stream") {
      await updateCommentStream({
        config,
        prId,
        commentId,
        content: currentContent,
        isPartial: false,
        status,
        inlineContext,
        parentCommentId
      });
      logger.success("Posted final Claude response to PR");
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

function buildClaudeArgs(config: PipeConfig, prompt: string): string[] {
  const args: string[] = [
    "-p", // Print mode (non-interactive)
    "--verbose", // Required when using stream-json with -p
    "--output-format", "stream-json"
  ];
  
  // Add model
  if (config.model) {
    args.push("--model", config.model);
  }
  
  // Add fallback model (for when primary model is overloaded)
  if (config.fallbackModel) {
    args.push("--fallback-model", config.fallbackModel);
  }
  
  // Add max turns
  if (config.maxTurns > 0) {
    args.push("--max-turns", config.maxTurns.toString());
  }
  
  // Add allowed tools if specified
  if (config.allowedTools && config.allowedTools.length > 0) {
    args.push("--allowed-tools", config.allowedTools.join(","));
  }
  
  // Add blocked tools if specified
  if (config.blockedTools && config.blockedTools.length > 0) {
    args.push("--disallowed-tools", config.blockedTools.join(","));
  }
  
  // Add the prompt as the last argument
  args.push(prompt);
  
  // Log what args we're using in verbose mode
  if (config.verbose) {
    logger.debug("Claude args:", args);
  }
  
  return args;
}

