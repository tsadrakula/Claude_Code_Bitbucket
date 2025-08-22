import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { BitbucketClient } from "../bitbucket/client.js";
import { PipelinesCore } from "../pipelines/core.js";
import type { PipeConfig } from "../types/config.js";
import { logger } from "../utils/logger.js";

/**
 * MCP Server for Bitbucket operations
 * Similar to the GitHub MCP servers in the GitHub Action
 */
export class BitbucketMcpServer {
  private server: Server;
  private client: BitbucketClient;

  constructor(config: PipeConfig) {
    this.client = new BitbucketClient(config);
    this.server = new Server(
      {
        name: "bitbucket-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "bitbucket_comment":
            return await this.handleComment(args);
          case "bitbucket_create_pr":
            return await this.handleCreatePR(args);
          case "bitbucket_get_pr":
            return await this.handleGetPR(args);
          case "bitbucket_get_diff":
            return await this.handleGetDiff(args);
          case "pipeline_set_output":
            return await this.handleSetOutput(args);
          case "pipeline_save_state":
            return await this.handleSaveState(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`MCP tool error: ${name}`, error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: "bitbucket_comment",
        description: "Create a comment on a Bitbucket pull request",
        inputSchema: {
          type: "object",
          properties: {
            pr_id: {
              type: "number",
              description: "Pull request ID",
            },
            content: {
              type: "string",
              description: "Comment content in markdown",
            },
          },
          required: ["pr_id", "content"],
        },
      },
      {
        name: "bitbucket_create_pr",
        description: "Create a new pull request in Bitbucket",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "PR title",
            },
            description: {
              type: "string",
              description: "PR description",
            },
            source_branch: {
              type: "string",
              description: "Source branch name",
            },
            destination_branch: {
              type: "string",
              description: "Destination branch name (default: main)",
            },
          },
          required: ["title", "description", "source_branch"],
        },
      },
      {
        name: "bitbucket_get_pr",
        description: "Get pull request details",
        inputSchema: {
          type: "object",
          properties: {
            pr_id: {
              type: "number",
              description: "Pull request ID",
            },
          },
          required: ["pr_id"],
        },
      },
      {
        name: "bitbucket_get_diff",
        description: "Get the diff of a pull request",
        inputSchema: {
          type: "object",
          properties: {
            pr_id: {
              type: "number",
              description: "Pull request ID",
            },
          },
          required: ["pr_id"],
        },
      },
      {
        name: "pipeline_set_output",
        description: "Set an output variable for the pipeline",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Output variable name",
            },
            value: {
              type: "string",
              description: "Output value",
            },
          },
          required: ["name", "value"],
        },
      },
      {
        name: "pipeline_save_state",
        description: "Save state for sharing between pipeline steps",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "State variable name",
            },
            value: {
              type: "string",
              description: "State value",
            },
          },
          required: ["name", "value"],
        },
      },
    ];
  }

  private async handleComment(args: any) {
    const { pr_id, content } = args;
    const result = await this.client.createPullRequestComment(pr_id, content);
    return {
      content: [
        {
          type: "text",
          text: result
            ? `Comment created successfully: ${result.id}`
            : "Failed to create comment",
        },
      ],
    };
  }

  private async handleCreatePR(args: any) {
    const { title, description, source_branch, destination_branch = "main" } = args;
    const result = await this.client.createPullRequest(
      title,
      description,
      source_branch,
      destination_branch
    );
    return {
      content: [
        {
          type: "text",
          text: result
            ? `Pull request created: #${result.id}`
            : "Failed to create pull request",
        },
      ],
    };
  }

  private async handleGetPR(args: any) {
    const { pr_id } = args;
    const pr = await this.client.getPullRequest(pr_id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(pr, null, 2),
        },
      ],
    };
  }

  private async handleGetDiff(args: any) {
    const { pr_id } = args;
    const diff = await this.client.getPullRequestDiff(pr_id);
    return {
      content: [
        {
          type: "text",
          text: diff || "No diff available",
        },
      ],
    };
  }

  private async handleSetOutput(args: any) {
    const { name, value } = args;
    PipelinesCore.setOutput(name, value);
    return {
      content: [
        {
          type: "text",
          text: `Output set: ${name}=${value}`,
        },
      ],
    };
  }

  private async handleSaveState(args: any) {
    const { name, value } = args;
    PipelinesCore.saveState(name, value);
    return {
      content: [
        {
          type: "text",
          text: `State saved: ${name}=${value}`,
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("Bitbucket MCP Server started");
  }
}

/**
 * Create and configure MCP servers for Bitbucket operations
 * Returns a list of server configurations similar to GitHub Action's approach
 */
export function createMcpServers(config: PipeConfig) {
  const servers = [];

  // Main Bitbucket operations server
  servers.push({
    name: "bitbucket-server",
    command: "bun",
    args: ["run", "src/mcp/start-server.ts"],
    env: {
      BITBUCKET_WORKSPACE: config.workspace,
      BITBUCKET_REPO_SLUG: config.repoSlug,
      BITBUCKET_ACCESS_TOKEN: config.bitbucketAccessToken || "",
    },
  });

  // Add more specialized servers as needed
  // (Similar to GitHub's comment-server, file-ops-server, etc.)

  return servers;
}