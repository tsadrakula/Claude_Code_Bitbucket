import { BitbucketAPI } from "./api";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export interface LoaderState {
  analyzing: "pending" | "in_progress" | "completed";
  reading: "pending" | "in_progress" | "completed";
  generating: "pending" | "in_progress" | "completed";
  startTime: Date;
  commentId?: any;
}

export class ClaudeLoader {
  private api: BitbucketAPI;
  private config: PipeConfig;
  private state: LoaderState;
  private prId: number;

  constructor(config: PipeConfig, prId: number) {
    this.config = config;
    this.prId = prId;
    this.api = new BitbucketAPI(config);
    this.state = {
      analyzing: "pending",
      reading: "pending",
      generating: "pending",
      startTime: new Date(),
    };
  }

  /**
   * Post initial loader comment to PR
   */
  async postInitialLoader(): Promise<void> {
    const content = this.formatLoaderContent();
    
    try {
      if (this.config.bitbucketAccessToken) {
        const comment = await this.api.createPullRequestComment(this.prId, content);
        this.state.commentId = comment?.id;
        logger.info(`Posted initial loader comment: ${this.state.commentId}`);
      } else {
        logger.warning("No Bitbucket access token, outputting to console");
        console.log(content);
      }
    } catch (error) {
      logger.error("Failed to post loader comment:", error);
    }
  }

  /**
   * Update loader state and post update
   */
  async updateState(updates: Partial<LoaderState>): Promise<void> {
    this.state = { ...this.state, ...updates };
    await this.updateComment();
  }

  /**
   * Update the loader comment with current state
   */
  private async updateComment(): Promise<void> {
    const content = this.formatLoaderContent();
    
    try {
      if (this.config.bitbucketAccessToken && this.state.commentId) {
        // Bitbucket doesn't have direct comment update, so we create a new one
        // In a real implementation, we might want to delete the old one first
        await this.api.createPullRequestComment(this.prId, content);
        logger.info("Updated loader comment");
      } else {
        console.log(content);
      }
    } catch (error) {
      logger.error("Failed to update loader comment:", error);
    }
  }

  /**
   * Replace loader with final response
   */
  async replaceWithFinalResponse(response: string, status: "success" | "error" | "timeout"): Promise<void> {
    const elapsed = this.getElapsedTime();
    const statusEmoji = status === "success" ? "✅" : status === "error" ? "❌" : "⏱️";
    const statusText = status === "success" ? "Complete" : status === "error" ? "Failed" : "Timed Out";
    
    const finalContent = `## 🤖 Claude Response ${statusEmoji}

${response}

---
*⏱️ Total time: ${elapsed} | Status: ${statusText}*`;

    try {
      if (this.config.bitbucketAccessToken) {
        await this.api.createPullRequestComment(this.prId, finalContent);
        logger.success("Posted final Claude response");
      } else {
        console.log(finalContent);
      }
    } catch (error) {
      logger.error("Failed to post final response:", error);
    }
  }

  /**
   * Format the loader content based on current state
   */
  private formatLoaderContent(): string {
    const elapsed = this.getElapsedTime();
    const startTime = this.state.startTime.toLocaleTimeString();
    
    const getCheckbox = (state: "pending" | "in_progress" | "completed") => {
      switch (state) {
        case "pending": return "[ ]";
        case "in_progress": return "[-]";
        case "completed": return "[x]";
      }
    };
    
    const getEmoji = (state: "pending" | "in_progress" | "completed") => {
      switch (state) {
        case "pending": return "";
        case "in_progress": return "🔄";
        case "completed": return "✅";
      }
    };

    return `## 🤖 **Claude is ${this.getStatusText()}...**

${getCheckbox(this.state.analyzing)} Analyzing your request ${getEmoji(this.state.analyzing)}
${getCheckbox(this.state.reading)} Reading relevant files ${getEmoji(this.state.reading)}
${getCheckbox(this.state.generating)} Generating response ${getEmoji(this.state.generating)}

---
*⏱️ Started: ${startTime} | Elapsed: ${elapsed}*`;
  }

  /**
   * Get status text based on current state
   */
  private getStatusText(): string {
    if (this.state.generating === "in_progress") {
      return "generating a response";
    } else if (this.state.reading === "in_progress") {
      return "reading the code";
    } else if (this.state.analyzing === "in_progress") {
      return "thinking";
    }
    return "processing";
  }

  /**
   * Get elapsed time as formatted string
   */
  private getElapsedTime(): string {
    const elapsed = Date.now() - this.state.startTime.getTime();
    const seconds = Math.floor(elapsed / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}