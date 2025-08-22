import { execSync } from "child_process";
import { existsSync } from "fs";
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
        shell: true
      });
      
      // Add to PATH if needed
      const claudePath = join(homedir(), ".local", "bin");
      if (!process.env.PATH?.includes(claudePath)) {
        process.env.PATH = `${claudePath}:${process.env.PATH}`;
      }
      
      logger.success("Claude CLI installed successfully");
    } catch (error) {
      logger.error("Failed to install Claude CLI:", error);
      throw new Error("Claude CLI installation failed. Please ensure curl is available and you have internet access.");
    }
    
    // Verify installation
    try {
      execSync("claude --version", { stdio: "ignore" });
    } catch {
      throw new Error("Claude CLI installed but not accessible. Check PATH configuration.");
    }
  } catch (error) {
    logger.error("Failed to ensure Claude CLI:", error);
    throw error;
  }
}