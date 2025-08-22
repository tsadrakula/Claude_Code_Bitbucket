import axios, { AxiosInstance } from "axios";
import type { PipeConfig } from "../types/config";
import { logger } from "../utils/logger";

export class BitbucketAPI {
  private client: AxiosInstance;
  private config: PipeConfig;

  constructor(config: PipeConfig) {
    this.config = config;
    
    // Use Bitbucket Cloud API v2
    this.client = axios.create({
      baseURL: "https://api.bitbucket.org/2.0",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    // Add authentication if available
    if (config.bitbucketAccessToken) {
      this.client.defaults.headers.common["Authorization"] = 
        `Bearer ${config.bitbucketAccessToken}`;
    } else {
      logger.warning("No Bitbucket access token provided. Some operations may fail.");
    }

    // Add request/response interceptors for debugging
    if (config.verbose) {
      this.client.interceptors.request.use(
        (config) => {
          logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          logger.error("API Request Error:", error);
          return Promise.reject(error);
        }
      );

      this.client.interceptors.response.use(
        (response) => {
          logger.debug(`API Response: ${response.status} ${response.config.url}`);
          return response;
        },
        (error) => {
          logger.error(`API Response Error: ${error.response?.status} ${error.config?.url}`);
          return Promise.reject(error);
        }
      );
    }
  }

  async getPullRequest(prId: number): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}`;
    const response = await this.client.get(url);
    return response.data;
  }

  async getPullRequestDiff(prId: number): Promise<string> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/diff`;
    const response = await this.client.get(url, {
      headers: { "Accept": "text/plain" }
    });
    return response.data;
  }

  async getPullRequestComments(prId: number): Promise<any[]> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments`;
    const response = await this.client.get(url);
    return response.data.values || [];
  }

  async createPullRequestComment(prId: number, content: string): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments`;
    const response = await this.client.post(url, {
      content: {
        raw: content,
        markup: "markdown",
      },
    });
    return response.data;
  }

  async updatePullRequestComment(prId: number, commentId: string, content: string): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments/${commentId}`;
    const response = await this.client.put(url, {
      content: {
        raw: content,
        markup: "markdown",
      },
    });
    return response.data;
  }

  async createInlineComment(
    prId: number, 
    filePath: string, 
    lineNumber: number, 
    content: string
  ): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests/${prId}/comments`;
    const response = await this.client.post(url, {
      content: {
        raw: content,
        markup: "markdown",
      },
      inline: {
        path: filePath,
        to: lineNumber,
      },
    });
    return response.data;
  }

  async getRepository(): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}`;
    const response = await this.client.get(url);
    return response.data;
  }

  async getBranches(): Promise<any[]> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/refs/branches`;
    const response = await this.client.get(url);
    return response.data.values || [];
  }

  async createBranch(branchName: string, fromBranch: string): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/refs/branches`;
    const response = await this.client.post(url, {
      name: branchName,
      target: {
        hash: fromBranch,
      },
    });
    return response.data;
  }

  async createPullRequest(
    title: string,
    description: string,
    sourceBranch: string,
    destinationBranch: string
  ): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pullrequests`;
    const response = await this.client.post(url, {
      title,
      description,
      source: {
        branch: { name: sourceBranch },
      },
      destination: {
        branch: { name: destinationBranch },
      },
      close_source_branch: true,
    });
    return response.data;
  }

  async getCommit(hash: string): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/commit/${hash}`;
    const response = await this.client.get(url);
    return response.data;
  }

  async getPipelines(): Promise<any[]> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines`;
    const response = await this.client.get(url);
    return response.data.values || [];
  }

  async triggerPipeline(branch: string, variables?: Record<string, string>): Promise<any> {
    const url = `/repositories/${this.config.workspace}/${this.config.repoSlug}/pipelines`;
    const response = await this.client.post(url, {
      target: {
        type: "pipeline_ref_target",
        ref_type: "branch",
        ref_name: branch,
      },
      variables: variables ? Object.entries(variables).map(([key, value]) => ({
        key,
        value,
      })) : undefined,
    });
    return response.data;
  }
}