import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { logger } from "./logger";

/**
 * Installs Claude CLI if not already present
 */
export async function ensureClaudeCLI(): Promise<void> {
  try {
    // Check if claude is already available
    try {
      execSync("which claude", { stdio: "ignore" });
      logger.debug("Claude CLI is already installed");
      return;
    } catch {
      // Claude not found, proceed with installation
    }

    logger.info("Installing Claude CLI...");
    
    // Install Claude CLI using the official script
    try {
      execSync("curl -fsSL https://claude.ai/install.sh | bash -s 1.0.88", {
        stdio: "inherit",
        shell: "/bin/bash"
      });
      
      // Expand ~ to actual home directory and add to PATH
      const homeDir = homedir();
      const claudePath = join(homeDir, ".local", "bin");
      
      // Update PATH for current process
      process.env.PATH = `${claudePath}:${process.env.PATH || ""}`;
      
      // Also export PATH for child processes
      process.env.CLAUDE_BIN_PATH = claudePath;
      
      logger.success("Claude CLI installed successfully");
      logger.info(`Added to PATH: ${claudePath}`);
    } catch (error) {
      logger.error("Failed to install Claude CLI:", error);
      throw new Error("Claude CLI installation failed. Please ensure curl is available and you have internet access.");
    }
    
    // Verify installation with full path
    try {
      const claudeBinPath = join(homedir(), ".local", "bin", "claude");
      execSync(`${claudeBinPath} --version`, { stdio: "ignore" });
      logger.debug("Claude CLI verified at:", claudeBinPath);
    } catch {
      // Try with PATH
      try {
        execSync("claude --version", { 
          stdio: "ignore",
          env: { ...process.env }
        });
      } catch {
        throw new Error("Claude CLI installed but not accessible. Check PATH configuration.");
      }
    }
  } catch (error) {
    logger.error("Failed to ensure Claude CLI:", error);
    throw error;
  }
}