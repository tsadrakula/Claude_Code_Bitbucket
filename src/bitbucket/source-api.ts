/**
 * Bitbucket Source API for file operations
 * Provides methods to read and update files directly via Bitbucket API
 */

import { Bitbucket } from "bitbucket";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export class BitbucketSourceAPI {
  private client: InstanceType<typeof Bitbucket>;
  private config: PipeConfig;

  constructor(config: PipeConfig) {
    this.config = config;

    const clientOptions: any = {
      baseUrl: "https://api.bitbucket.org/2.0",
      request: {
        timeout: 30000,
      },
    };

    // Add authentication
    if (config.bitbucketAccessToken) {
      if (config.bitbucketAccessToken.includes(':')) {
        const [username, password] = config.bitbucketAccessToken.split(':');
        
        if (username === 'x-token-auth') {
          clientOptions.auth = {
            token: password,
          };
        } else {
          clientOptions.auth = {
            username,
            password,
          };
        }
      } else {
        clientOptions.auth = {
          token: config.bitbucketAccessToken,
        };
      }
    }

    this.client = new Bitbucket(clientOptions);
  }

  /**
   * Get file content from a specific branch
   */
  async getFileContent(branch: string, path: string): Promise<string | null> {
    try {
      const { data } = await this.client.repositories.readSrc({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        commit: branch,
        path: path,
      });

      // The data could be a string (file content) or an object (directory listing)
      if (typeof data === 'string') {
        return data;
      } else {
        logger.warning(`Path ${path} is not a file`);
        return null;
      }
    } catch (error) {
      logger.error(`Failed to get file content: ${path} on branch ${branch}`, error);
      return null;
    }
  }

  /**
   * Create or update a file on a branch
   * This creates a new commit with the file change
   */
  async updateFile(
    branch: string,
    path: string,
    content: string,
    message: string,
    author?: { name: string; email: string }
  ): Promise<{ commit?: string; error?: string }> {
    try {
      // First, get the current file to check if it exists
      await this.getFileContent(branch, path);
      
      // Prepare the form data for the API
      const formData = new FormData();
      formData.append(path, new Blob([content], { type: 'text/plain' }), path);
      formData.append('message', message);
      formData.append('branch', branch);
      
      if (author) {
        formData.append('author', `${author.name} <${author.email}>`);
      }

      // Use the source API to create a commit with the file change
      const { data } = await this.client.repositories.createSrcFileCommit({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        _body: formData as any,
      });

      logger.success(`File ${path} updated on branch ${branch}`);
      return { commit: data.hash };
    } catch (error: any) {
      logger.error(`Failed to update file: ${path}`, error);
      return { error: error.message || 'Failed to update file' };
    }
  }

  /**
   * Create multiple file changes in a single commit
   */
  async createCommit(
    branch: string,
    changes: Array<{ path: string; content: string; action: 'create' | 'update' | 'delete' }>,
    message: string,
    author?: { name: string; email: string }
  ): Promise<{ commit?: string; error?: string }> {
    try {
      // Note: Bitbucket API doesn't support batch file operations in a single commit
      // We need to make sequential commits or use a different approach
      
      // For now, we'll make sequential updates (not ideal but functional)
      let lastCommit: string | undefined;
      
      for (const change of changes) {
        if (change.action === 'delete') {
          // Handle file deletion
          logger.warning('File deletion via API not yet implemented');
          continue;
        }
        
        const result = await this.updateFile(
          branch,
          change.path,
          change.content,
          message,
          author
        );
        
        if (result.error) {
          return result;
        }
        
        lastCommit = result.commit;
      }
      
      return { commit: lastCommit };
    } catch (error: any) {
      logger.error('Failed to create commit:', error);
      return { error: error.message || 'Failed to create commit' };
    }
  }

  /**
   * Get the latest commit on a branch
   */
  async getLatestCommit(branch: string): Promise<string | null> {
    try {
      const { data } = await this.client.repositories.listCommits({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        include: branch,
        pagelen: 1,
      });

      if (data.values && data.values.length > 0) {
        return data.values[0].hash ?? null;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get latest commit on branch ${branch}`, error);
      return null;
    }
  }

  /**
   * Get pull request details to find source branch
   */
  async getPullRequestBranch(prId: number): Promise<{ source?: string; destination?: string }> {
    try {
      const { data } = await this.client.pullrequests.get({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        pull_request_id: prId,
      });

      return {
        source: data.source?.branch?.name,
        destination: data.destination?.branch?.name,
      };
    } catch (error) {
      logger.error(`Failed to get PR ${prId} branch info`, error);
      return {};
    }
  }
}