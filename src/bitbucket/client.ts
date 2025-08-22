import { Bitbucket } from "bitbucket";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

/**
 * Creates and configures a Bitbucket API client
 * Similar to how GitHub Action uses @actions/github
 */
export class BitbucketClient {
  private client: InstanceType<typeof Bitbucket>;
  private config: PipeConfig;

  constructor(config: PipeConfig) {
    this.config = config;

    // Initialize Bitbucket client with authentication if available
    const clientOptions: any = {
      baseUrl: "https://api.bitbucket.org/2.0",
      request: {
        timeout: 30000,
      },
    };

    // Add authentication if available
    if (config.bitbucketAccessToken) {
      clientOptions.auth = {
        token: config.bitbucketAccessToken,
      };
    } else if (process.env.BITBUCKET_USERNAME && process.env.BITBUCKET_APP_PASSWORD) {
      // Fallback to username/app password if available
      clientOptions.auth = {
        username: process.env.BITBUCKET_USERNAME,
        password: process.env.BITBUCKET_APP_PASSWORD,
      };
    }

    this.client = new Bitbucket(clientOptions);

    if (config.verbose) {
      logger.debug("Bitbucket client initialized", {
        workspace: config.workspace,
        repoSlug: config.repoSlug,
        hasAuth: !!clientOptions.auth,
      });
    }
  }

  /**
   * Get pull request details
   */
  async getPullRequest(pullRequestId: number) {
    try {
      const { data } = await this.client.pullrequests.get({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        pull_request_id: pullRequestId,
      });
      return data;
    } catch (error) {
      logger.warning(`Failed to fetch PR ${pullRequestId}:`, error);
      // Return fallback data from environment
      return this.getPullRequestFromEnv(pullRequestId);
    }
  }

  /**
   * Get pull request diff
   */
  async getPullRequestDiff(pullRequestId: number): Promise<string> {
    try {
      const { data } = await this.client.pullrequests.getDiff({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        pull_request_id: pullRequestId,
      });
      return data as string;
    } catch (error) {
      logger.warning(`Failed to fetch PR diff:`, error);
      return "";
    }
  }

  /**
   * Get pull request comments
   */
  async getPullRequestComments(pullRequestId: number) {
    try {
      const { data } = await this.client.pullrequests.listComments({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        pull_request_id: pullRequestId,
      });
      return data.values || [];
    } catch (error) {
      logger.warning(`Failed to fetch PR comments:`, error);
      return [];
    }
  }

  /**
   * Create a pull request comment
   */
  async createPullRequestComment(pullRequestId: number, content: string) {
    try {
      const { data } = await this.client.pullrequests.createComment({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        pull_request_id: pullRequestId,
        _body: {
          type: "pullrequest_comment",
          content: {
            raw: content,
            markup: "markdown",
          },
        } as any,
      });
      return data;
    } catch (error) {
      logger.warning(`Failed to create PR comment:`, error);
      return null;
    }
  }

  /**
   * Get repository information
   */
  async getRepository() {
    try {
      const { data } = await this.client.repositories.get({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
      });
      return data;
    } catch (error) {
      logger.warning(`Failed to fetch repository:`, error);
      return this.getRepositoryFromEnv();
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, fromBranch: string) {
    try {
      const { data } = await this.client.refs.createBranch({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        _body: {
          name: branchName,
          target: {
            hash: fromBranch,
          },
        },
      });
      return data;
    } catch (error) {
      logger.warning(`Failed to create branch ${branchName}:`, error);
      return null;
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    title: string,
    description: string,
    sourceBranch: string,
    destinationBranch: string = "main"
  ) {
    try {
      const { data } = await this.client.pullrequests.create({
        workspace: this.config.workspace,
        repo_slug: this.config.repoSlug,
        _body: {
          type: "pullrequest",
          title,
          description,
          source: {
            branch: {
              name: sourceBranch,
            },
          },
          destination: {
            branch: {
              name: destinationBranch,
            },
          },
          close_source_branch: true,
        } as any,
      });
      return data;
    } catch (error) {
      logger.warning(`Failed to create pull request:`, error);
      return null;
    }
  }

  /**
   * Fallback: Get PR data from environment variables
   */
  private getPullRequestFromEnv(pullRequestId: number) {
    return {
      id: pullRequestId,
      title: process.env.BITBUCKET_PR_TITLE || "Pull Request",
      description: process.env.BITBUCKET_PR_DESCRIPTION || "",
      source: {
        branch: {
          name: process.env.BITBUCKET_BRANCH || "unknown",
        },
      },
      destination: {
        branch: {
          name: process.env.BITBUCKET_PR_DESTINATION_BRANCH || "main",
        },
      },
      author: {
        display_name: process.env.BITBUCKET_STEP_TRIGGERER_UUID || "unknown",
      },
      state: "OPEN",
      created_on: new Date().toISOString(),
      updated_on: new Date().toISOString(),
    };
  }

  /**
   * Fallback: Get repository data from environment variables
   */
  private getRepositoryFromEnv() {
    return {
      name: this.config.repoSlug,
      full_name: `${this.config.workspace}/${this.config.repoSlug}`,
      is_private: true,
      mainbranch: {
        name: process.env.BITBUCKET_BRANCH || "main",
      },
      language: process.env.BITBUCKET_PROJECT_LANGUAGE || "unknown",
    };
  }
}