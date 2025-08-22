import { BitbucketClient } from "./client";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

/**
 * BitbucketAPI class that wraps the BitbucketClient
 * Maintains backward compatibility with existing code
 */
export class BitbucketAPI {
  private client: BitbucketClient;

  constructor(config: PipeConfig) {
    this.client = new BitbucketClient(config);
  }

  async getPullRequest(prId: number): Promise<any> {
    return this.client.getPullRequest(prId);
  }

  async getPullRequestDiff(prId: number): Promise<string> {
    return this.client.getPullRequestDiff(prId);
  }

  async getPullRequestComments(prId: number): Promise<any[]> {
    return this.client.getPullRequestComments(prId);
  }

  async createPullRequestComment(prId: number, content: string): Promise<any> {
    return this.client.createPullRequestComment(prId, content);
  }

  async updatePullRequestComment(prId: number, _commentId: string, content: string): Promise<any> {
    // The Bitbucket SDK doesn't have a direct update method, 
    // but we can delete and recreate if needed
    logger.warning("Comment update not directly supported, creating new comment");
    return this.client.createPullRequestComment(prId, content);
  }

  async getRepository(): Promise<any> {
    return this.client.getRepository();
  }

  async createBranch(branchName: string, fromBranch: string): Promise<any> {
    return this.client.createBranch(branchName, fromBranch);
  }

  async createPullRequest(
    title: string,
    description: string,
    sourceBranch: string,
    destinationBranch: string
  ): Promise<any> {
    return this.client.createPullRequest(title, description, sourceBranch, destinationBranch);
  }
}