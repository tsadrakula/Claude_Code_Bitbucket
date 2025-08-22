#!/usr/bin/env bun
import { BitbucketMcpServer } from "./servers.js";
import { PipeConfigSchema } from "../types/config.js";

async function main() {
  // Parse configuration from environment
  const config = PipeConfigSchema.parse({
    workspace: process.env.BITBUCKET_WORKSPACE,
    repoSlug: process.env.BITBUCKET_REPO_SLUG,
    bitbucketAccessToken: process.env.BITBUCKET_ACCESS_TOKEN,
    mode: process.env.MODE || "tag",
    triggerPhrase: process.env.TRIGGER_PHRASE || "@claude",
    model: process.env.MODEL || "sonnet",
    maxTurns: parseInt(process.env.MAX_TURNS || "30"),
    timeoutMinutes: parseInt(process.env.TIMEOUT_MINUTES || "10"),
    branchPrefix: process.env.BRANCH_PREFIX || "claude/",
    autoCommit: process.env.AUTO_COMMIT === "true",
    autoPR: process.env.AUTO_PR === "true",
    verbose: process.env.VERBOSE === "true",
    dryRun: process.env.DRY_RUN === "true",
  });

  const server = new BitbucketMcpServer(config);
  await server.start();
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  });
}