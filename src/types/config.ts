import { z } from "zod";

export const PipeConfigSchema = z.object({
  // Core configuration
  mode: z.enum(["tag", "agent", "experimental-review"]).default("tag"),
  triggerPhrase: z.string().default("@claude"),
  
  // Authentication
  anthropicApiKey: z.string().optional(),
  bitbucketAccessToken: z.string().optional(),
  
  // Model configuration
  model: z.string().default("sonnet"),
  fallbackModel: z.string().default("opus").optional(),
  maxTurns: z.number().default(30),
  timeoutMinutes: z.number().default(10),
  
  // Tool configuration
  allowedTools: z.array(z.string()).optional(),
  blockedTools: z.array(z.string()).optional(),
  
  // Branch and commit configuration
  branchPrefix: z.string().default("claude/"),
  autoCommit: z.boolean().default(false),
  autoPR: z.boolean().default(false),
  
  // AWS Bedrock configuration
  awsRegion: z.string().optional(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  
  // Google Vertex AI configuration
  gcpProjectId: z.string().optional(),
  gcpRegion: z.string().optional(),
  gcpServiceAccountKey: z.string().optional(),
  
  // Bitbucket-specific
  workspace: z.string(),
  repoSlug: z.string(),
  prId: z.number().optional(),
  commitHash: z.string().optional(),
  branch: z.string().optional(),
  
  // Additional options
  verbose: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

export type PipeConfig = z.infer<typeof PipeConfigSchema>;

export interface PrepareResult {
  shouldRun: boolean;
  context: BitbucketContext;
  prompt: string;
  commentId?: string;
  branch?: string;
  triggerSource?: "description" | "comment" | "commit";
}

export interface BitbucketContext {
  workspace: string;
  repoSlug: string;
  eventType: string;
  actor: string;
  branch?: string;
  pullRequest?: {
    id: number;
    title: string;
    description: string;
    sourceBranch: string;
    destinationBranch: string;
    author: string;
    state: string;
    createdOn: string;
    updatedOn: string;
  };
  commit?: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  repository: {
    name: string;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
    language: string;
  };
  files?: Array<{
    path: string;
    type: string;
    size: number;
  }>;
}

export interface ClaudeResult {
  turns: ConversationTurn[];
  status: "success" | "error" | "timeout";
  executionTime: number;
  executionFile?: string;
  error?: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  tools?: ToolUse[];
}

export interface ToolUse {
  name: string;
  input: any;
  output: any;
}