/**
 * Core utilities for Bitbucket Pipelines
 * Similar to @actions/core for GitHub Actions
 */

import { logger } from "../utils/logger";

export class PipelinesCore {
  /**
   * Get an input variable from environment
   */
  static getInput(name: string, options?: { required?: boolean }): string {
    const envName = name.toUpperCase().replace(/-/g, "_");
    const value = process.env[envName] || "";

    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }

    return value.trim();
  }

  /**
   * Get multiple inputs as an array
   */
  static getMultilineInput(name: string, options?: { required?: boolean }): string[] {
    const input = this.getInput(name, options);
    return input
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Get a boolean input
   */
  static getBooleanInput(name: string, options?: { required?: boolean }): boolean {
    const input = this.getInput(name, options);
    return input.toLowerCase() === "true";
  }

  /**
   * Set an output variable (writes to a file in Bitbucket Pipelines)
   */
  static setOutput(name: string, value: any): void {
    const outputValue = typeof value === "string" ? value : JSON.stringify(value);
    
    // In Bitbucket Pipelines, we can write to a file that persists between steps
    if (process.env.BITBUCKET_PIPE_STORAGE_DIR) {
      const fs = require("fs");
      const path = require("path");
      const outputFile = path.join(
        process.env.BITBUCKET_PIPE_STORAGE_DIR,
        "outputs.env"
      );
      
      // Append to the outputs file
      fs.appendFileSync(outputFile, `${name}=${outputValue}\n`);
    }
    
    // Also log it
    logger.info(`Output: ${name}=${outputValue}`);
  }

  /**
   * Export a variable for use in subsequent steps
   */
  static exportVariable(name: string, value: string): void {
    process.env[name] = value;
    
    // In Bitbucket Pipelines, we need to echo to export
    console.log(`export ${name}="${value}"`);
  }

  /**
   * Add a path to the PATH environment variable
   */
  static addPath(path: string): void {
    process.env.PATH = `${path}:${process.env.PATH}`;
    console.log(`export PATH="${path}:$PATH"`);
  }

  /**
   * Get a secret value (masked in logs)
   */
  static getSecret(name: string): string {
    const value = this.getInput(name, { required: true });
    // Mask the value in logs
    this.setSecret(value);
    return value;
  }

  /**
   * Mark a value as secret (will be masked in logs)
   */
  static setSecret(_value: string): void {
    // In Bitbucket, we can't dynamically mask values, but we can warn
    logger.warning(`Secret value registered (will be masked if configured as secured variable)`);
  }

  /**
   * Save state for sharing between steps
   */
  static saveState(name: string, value: string): void {
    if (process.env.BITBUCKET_PIPE_STORAGE_DIR) {
      const fs = require("fs");
      const path = require("path");
      const stateFile = path.join(
        process.env.BITBUCKET_PIPE_STORAGE_DIR,
        "state.json"
      );
      
      let state: Record<string, any> = {};
      if (fs.existsSync(stateFile)) {
        state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      }
      
      state[name] = value;
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    }
  }

  /**
   * Get saved state
   */
  static getState(name: string): string {
    if (process.env.BITBUCKET_PIPE_STORAGE_DIR) {
      const fs = require("fs");
      const path = require("path");
      const stateFile = path.join(
        process.env.BITBUCKET_PIPE_STORAGE_DIR,
        "state.json"
      );
      
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
        return state[name] || "";
      }
    }
    return "";
  }

  /**
   * Log an info message
   */
  static info(message: string): void {
    logger.info(message);
  }

  /**
   * Log a warning message
   */
  static warning(message: string): void {
    logger.warning(message);
  }

  /**
   * Log an error message
   */
  static error(message: string | Error): void {
    logger.error(message);
  }

  /**
   * Log a debug message
   */
  static debug(message: string): void {
    logger.debug(message);
  }

  /**
   * Start a group for logging
   */
  static startGroup(name: string): void {
    logger.group(name);
  }

  /**
   * End the current group
   */
  static endGroup(): void {
    logger.groupEnd();
  }

  /**
   * Check if running in CI environment
   */
  static isCI(): boolean {
    return !!process.env.CI || !!process.env.BITBUCKET_BUILD_NUMBER;
  }

  /**
   * Set the pipeline to failed state
   */
  static setFailed(message: string): void {
    logger.error(message);
    process.exit(1);
  }

  /**
   * Get pipeline context information
   */
  static getContext() {
    return {
      workspace: process.env.BITBUCKET_WORKSPACE || "",
      repoSlug: process.env.BITBUCKET_REPO_SLUG || "",
      branch: process.env.BITBUCKET_BRANCH || "",
      commit: process.env.BITBUCKET_COMMIT || "",
      buildNumber: process.env.BITBUCKET_BUILD_NUMBER || "",
      prId: process.env.BITBUCKET_PR_ID || "",
      tag: process.env.BITBUCKET_TAG || "",
      stepUuid: process.env.BITBUCKET_STEP_UUID || "",
      pipelineUuid: process.env.BITBUCKET_PIPELINE_UUID || "",
      deploymentEnvironment: process.env.BITBUCKET_DEPLOYMENT_ENVIRONMENT || "",
      triggerType: process.env.BITBUCKET_PIPELINE_TRIGGER_TYPE || "",
      actor: process.env.BITBUCKET_STEP_TRIGGERER_UUID || "",
    };
  }
}