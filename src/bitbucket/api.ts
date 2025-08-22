import fetch from "node-fetch";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export class BitbucketAPI {
  private baseUrl = "https://api.bitbucket.org/2.0";
  private config: PipeConfig;
  private headers: Record<string, string>;

  constructor(config: PipeConfig) {
    this.config = config;
    
    // Only set up auth headers if we have a token
    this.headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    if (config.bitbucketAccessToken) {
      this.headers["Authorization"] = `Bearer ${config.bitbucketAccessToken}`;
    }
  }

  private async fetchAPI(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    if (this.config.verbose) {
      logger.debug(`API Request: ${options.method || 'GET'} ${url}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      logger.error(`API Error: ${error}`);
      throw error;
    }
  }

  async getPullRequest(prId: number): Promise<any> {
    // Only fetch if we really need additional PR data
    // Most info should come from environment variables
    if (!this.config.bitbucketAccessToken) {
      logger.warning("No access token, using environment data only");
      return {
        id: prId,
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
      };
    }

    return this.fetchAPI(
      `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}`
    );
  }

  async getPullRequestDiff(prId: number): Promise<string> {
    if (!this.config.bitbucketAccessToken) {
      return "Diff not available without access token";
    }

    return this.fetchAPI(
      `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/diff`,
      {
        headers: { "Accept": "text/plain" },
      }
    );
  }

  async getPullRequestComments(prId: number): Promise<any[]> {
    if (!this.config.bitbucketAccessToken) {
      return [];
    }

    const data = await this.fetchAPI(
      `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments`
    );
    return data.values || [];
  }

  async createPullRequestComment(prId: number, content: string): Promise<any> {
    if (!this.config.bitbucketAccessToken) {
      logger.warning("Cannot create comment without access token");
      return { id: "dummy", content: { raw: content } };
    }

    return this.fetchAPI(
      `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          content: {
            raw: content,
            markup: "markdown",
          },
        }),
      }
    );
  }

  async updatePullRequestComment(prId: number, commentId: string, content: string): Promise<any> {
    if (!this.config.bitbucketAccessToken) {
      logger.warning("Cannot update comment without access token");
      return { id: commentId, content: { raw: content } };
    }

    return this.fetchAPI(
      `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments/${commentId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          content: {
            raw: content,
            markup: "markdown",
          },
        }),
      }
    );
  }

  async getRepository(): Promise<any> {
    // Use environment variables first
    const envRepo = {
      name: this.config.repoSlug,
      full_name: `${this.config.workspace}/${this.config.repoSlug}`,
      is_private: true,
      mainbranch: {
        name: process.env.BITBUCKET_BRANCH || "main",
      },
      language: "unknown",
    };

    if (!this.config.bitbucketAccessToken) {
      return envRepo;
    }

    try {
      return await this.fetchAPI(
        `/repositories/${this.config.workspace}/${this.config.repoSlug}`
      );
    } catch (error) {
      logger.warning("Failed to fetch repository data, using environment fallback");
      return envRepo;
    }
  }
}