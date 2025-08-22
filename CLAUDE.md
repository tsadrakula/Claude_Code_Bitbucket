# Claude Code for Bitbucket Pipelines - Technical Documentation

This document provides technical details about the Bitbucket Pipe implementation of Claude Code, which mirrors the GitHub Actions Claude Code implementation while adapting to Bitbucket's architecture.

## Architecture Overview

The implementation is built with TypeScript and Bun runtime, following the same patterns as the GitHub Actions version while utilizing Bitbucket-specific SDKs and environment.

### Technology Stack

- **Runtime**: Bun 1.2.11+ (matching GitHub Action)
- **Language**: TypeScript with strict typing
- **SDKs**: 
  - `bitbucket` - Official Bitbucket API client (equivalent to `@actions/github`)
  - `@modelcontextprotocol/sdk` - MCP support for Claude tools
- **Container**: Alpine-based Docker image with Bun

### Key Components

```
src/
├── entrypoints/          # Pipeline entry points
│   ├── collect-inputs.ts # Input validation and collection
│   ├── prepare.ts        # Setup and preparation logic
│   ├── format-turns.ts   # Conversation formatting
│   └── update-comment.ts # Bitbucket comment updates
├── bitbucket/           # Bitbucket API integration
│   ├── api.ts           # API wrapper for backward compatibility
│   ├── client.ts        # BitbucketClient using official SDK
│   ├── comment.ts       # PR comment management
│   └── comment-stream.ts # Streaming comment updates (NEW)
├── pipelines/           # Pipeline utilities
│   └── core.ts          # Core utilities (like @actions/core)
├── mcp/                 # Model Context Protocol
│   ├── servers.ts       # MCP server implementation
│   └── start-server.ts  # MCP server entry point
├── modes/               # Operational modes
│   ├── tag/             # @claude mention mode (with intelligent detection)
│   ├── agent/           # Automated/scheduled mode
│   └── review/          # PR review mode (with dynamic tools)
├── claude/              # Claude integration
│   └── runner.ts        # Claude Code CLI execution
├── prepare/             # Preparation workflow
├── format/              # Output formatting
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
    ├── logger.ts        # Logging utilities
    ├── install-claude.ts # Claude CLI installer
    └── request-classifier.ts # Intelligent request classification (NEW)
```

## SDK Comparison with GitHub Action

| Component | GitHub Action | Bitbucket Pipe | Purpose |
|-----------|--------------|----------------|---------|
| Core Utilities | `@actions/core` | `PipelinesCore` class | Input/output, state management |
| API Client | `@actions/github` | `bitbucket` npm package | Platform API integration |
| GraphQL | `@octokit/graphql` | N/A (REST only) | API queries |
| REST API | `@octokit/rest` | Built into `bitbucket` | REST operations |
| MCP SDK | `@modelcontextprotocol/sdk` | `@modelcontextprotocol/sdk` | Claude tool support |

## Core Modules

### BitbucketClient (`src/bitbucket/client.ts`)

Wraps the official Bitbucket SDK to provide a clean interface for Bitbucket operations:

```typescript
const client = new BitbucketClient(config);
await client.createPullRequestComment(prId, "Review complete!");
await client.createPullRequest(title, description, sourceBranch);
```

Features:
- Automatic authentication handling (token or username/password)
- Graceful fallback to environment variables when API unavailable
- Full TypeScript typing from official SDK
- Error handling with informative logging

### PipelinesCore (`src/pipelines/core.ts`)

Provides utilities similar to `@actions/core` for GitHub Actions:

```typescript
// Get inputs
const apiKey = PipelinesCore.getInput('ANTHROPIC_API_KEY', { required: true });
const verbose = PipelinesCore.getBooleanInput('VERBOSE');

// Set outputs
PipelinesCore.setOutput('branch_name', 'claude/fix-123');
PipelinesCore.saveState('pr_id', '456');

// Pipeline context
const context = PipelinesCore.getContext();
```

### MCP Servers (`src/mcp/servers.ts`)

Implements Model Context Protocol servers for Claude to interact with Bitbucket:

```typescript
const server = new BitbucketMcpServer(config);
```

Available tools:
- `bitbucket_comment` - Create PR comments
- `bitbucket_create_pr` - Create pull requests
- `bitbucket_get_pr` - Get PR details
- `bitbucket_get_diff` - Get PR diff
- `pipeline_set_output` - Set pipeline outputs
- `pipeline_save_state` - Save state between steps

## Modes of Operation

### 1. Tag Mode (Default)
- Responds to `@claude` mentions in PR comments or commit messages
- Creates tracking comments (when API available)
- Full implementation capabilities
- Most interactive mode
- **NEW**: Automatically detects actionable vs informational requests
- **NEW**: Responds inline to inline comments

### 2. Agent Mode
- For automated/scheduled runs
- No user interaction required
- Minimal tool access for safety
- Custom prompts via `CLAUDE_AGENT_PROMPT`

### 3. Review Mode (Experimental)
- Automatic PR reviews
- Triggered on PR events
- **NEW**: Dynamically adjusts tools based on request type
- **NEW**: Can make edits when actionable requests detected
- Provides structured feedback

## Environment Variables

### Complete Configuration Reference

| Category | Variable | Type | Default | Description |
|----------|----------|------|---------|-------------|
| **Core** | | | | |
| | `MODE` | `string` | `tag` | Execution mode: `tag`, `agent`, `experimental-review` |
| | `TRIGGER_PHRASE` | `string` | `@claude` | Phrase to trigger Claude in comments |
| | `MODEL` | `string` | `sonnet` | Claude model to use |
| | `FALLBACK_MODEL` | `string` | `opus` | Fallback model when primary is unavailable |
| | `MAX_TURNS` | `number` | `30` | Maximum conversation turns |
| | `TIMEOUT_MINUTES` | `number` | `10` | Execution timeout in minutes |
| **Comment Handling** | | | | |
| | `ENABLE_STREAMING_COMMENTS` | `boolean` | `false` | Show live updates as Claude responds |
| | `AUTO_DETECT_ACTIONABLE` | `boolean` | `true` | Automatically detect actionable requests |
| | `COMMENT_UPDATE_STRATEGY` | `enum` | `final` | Update strategy: `stream`, `final`, `both` |
| **Tools** | | | | |
| | `ALLOWED_TOOLS` | `string[]` | `null` | Comma-separated list of allowed tools |
| | `BLOCKED_TOOLS` | `string[]` | `null` | Comma-separated list of blocked tools |
| **Repository** | | | | |
| | `BRANCH_PREFIX` | `string` | `claude/` | Prefix for created branches |
| | `AUTO_COMMIT` | `boolean` | `false` | Automatically commit changes |
| | `AUTO_PR` | `boolean` | `false` | Automatically create pull requests |
| **Development** | | | | |
| | `VERBOSE` | `boolean` | `false` | Enable verbose logging |
| | `DRY_RUN` | `boolean` | `false` | Test mode without making changes |

### Required Variables
```bash
# One authentication method required:
ANTHROPIC_API_KEY=sk-ant-...        # Anthropic API
# OR
AWS_ACCESS_KEY_ID=...                # AWS Bedrock
AWS_SECRET_ACCESS_KEY=...
# OR
GCP_PROJECT_ID=...                   # Google Vertex AI
GCP_SERVICE_ACCOUNT_KEY=...

# Bitbucket context (auto-set by Pipelines)
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_REPO_SLUG=your-repo
```

### Optional Variables
```bash
# Configuration
MODE=tag|agent|experimental-review   # Execution mode
TRIGGER_PHRASE=@claude               # Trigger phrase
MODEL=sonnet                         # Claude model
MAX_TURNS=30                         # Max conversation turns
TIMEOUT_MINUTES=10                   # Timeout duration

# Tools
ALLOWED_TOOLS=Read,Write,Edit        # Allowed Claude tools
BLOCKED_TOOLS=Bash,Computer          # Blocked tools

# Features
AUTO_COMMIT=true                     # Auto-commit changes
AUTO_PR=true                         # Auto-create PRs
BRANCH_PREFIX=claude/                # Branch name prefix

# Comment Handling (NEW)
ENABLE_STREAMING_COMMENTS=false     # Show live updates as Claude responds
AUTO_DETECT_ACTIONABLE=true         # Auto-detect actionable vs informational requests
COMMENT_UPDATE_STRATEGY=final       # How to post: stream, final, or both

# Authentication
BITBUCKET_ACCESS_TOKEN=...          # For API operations
BITBUCKET_USERNAME=...               # Alternative auth
BITBUCKET_APP_PASSWORD=...          # With username

# Development
VERBOSE=true                         # Verbose logging
DRY_RUN=true                        # Test mode
```

### Bitbucket Pipeline Variables

The pipe automatically uses these Bitbucket-provided variables:

```bash
BITBUCKET_WORKSPACE              # Workspace slug
BITBUCKET_REPO_SLUG             # Repository slug
BITBUCKET_BRANCH                # Current branch
BITBUCKET_COMMIT                # Commit hash
BITBUCKET_PR_ID                 # Pull request ID
BITBUCKET_PR_TITLE              # PR title
BITBUCKET_PR_DESCRIPTION        # PR description
BITBUCKET_BUILD_NUMBER          # Build number
BITBUCKET_PIPELINE_UUID         # Pipeline UUID
BITBUCKET_STEP_UUID            # Step UUID
BITBUCKET_DEPLOYMENT_ENVIRONMENT # Deployment env
```

## Pipeline Configuration

### Minimal Setup

```yaml
image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Review
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude
            - cd /tmp/claude && npm install -g bun && bun install && bun run build
            - cd $BITBUCKET_CLONE_DIR
            - MODE=experimental-review bun run /tmp/claude/dist/index.js
```

### Full Configuration

```yaml
image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Review
          script:
            # Setup
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude
            - cd /tmp/claude
            - npm install -g bun
            - bun install
            - bun run build
            
            # Run Claude
            - cd $BITBUCKET_CLONE_DIR
            - |
              export MODE=experimental-review
              export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
              export BITBUCKET_ACCESS_TOKEN=${BITBUCKET_ACCESS_TOKEN}
              export ALLOWED_TOOLS="Read,Grep"
              export VERBOSE=true
              bun run /tmp/claude/dist/index.js
          after-script:
            - echo "Claude review complete"

  custom:
    claude-help:
      - step:
          name: Claude Assistant
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude
            - cd /tmp/claude && npm install -g bun && bun install && bun run build
            - cd $BITBUCKET_CLONE_DIR
            - |
              export MODE=tag
              export TRIGGER_PHRASE="@claude"
              export ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
              export ALLOWED_TOOLS="Read,Write,Edit"
              bun run /tmp/claude/dist/index.js
```

## Authentication Methods

### 1. Anthropic API (Recommended)
```yaml
ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
MODEL: sonnet
```

### 2. AWS Bedrock
```yaml
AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
AWS_REGION: us-east-1
MODEL: sonnet  # Note: For Bedrock, may need specific model IDs
```

### 3. Google Vertex AI
```yaml
GCP_PROJECT_ID: ${GCP_PROJECT_ID}
GCP_SERVICE_ACCOUNT_KEY: ${GCP_SERVICE_ACCOUNT_KEY}
GCP_REGION: us-central1
MODEL: sonnet  # Note: For Vertex AI, may need specific model IDs
```

## Intelligent Features

### Request Classification System

The pipe includes an intelligent request classifier that automatically determines whether a user request is actionable or informational:

#### Actionable Requests
Requests that require code changes are automatically detected and given appropriate tools:
- Pattern matching for action verbs: change, update, fix, add, remove, etc.
- Imperative forms: "Make this bigger", "Change to blue"
- Bug/issue indicators with fix intent
- Polite requests with action intent: "Could you fix..."

#### Informational Requests
Requests for information are handled with read-only tools:
- Questions: what, where, when, why, how
- Explanations: explain, describe, tell me about
- Analysis: review, check, inspect (without modification intent)
- Understanding: clarify, meaning of, purpose of

#### Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTO_DETECT_ACTIONABLE` | Enable automatic request classification | `true` |
| `ALLOWED_TOOLS` | Override automatic tool selection | `null` |
| `BLOCKED_TOOLS` | Always block specific tools | `["Computer"]` |

### Comment Threading System

The pipe intelligently handles different comment types:

#### Inline Comments
- Automatically detects inline comments on specific code lines
- **Responds as a reply to the original comment** (fixed threading)
- Uses the triggering comment as the parent for proper threading
- Includes line context and file path in Claude's prompt
- Falls back to top-level comment if line numbers are null

#### Top-level Comments
- Replies to the comment that mentioned Claude
- Maintains conversation thread continuity
- Suitable for broad PR feedback

#### Comment Update Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `final` | Single comment after completion | Clean PR history (default) |
| `stream` | Live updates during processing | Real-time feedback |
| `both` | Streaming + final summary | Maximum visibility |

Configuration:
```bash
ENABLE_STREAMING_COMMENTS=false     # Enable/disable streaming
COMMENT_UPDATE_STRATEGY=final       # Choose strategy
```

## Tool Configuration

### Available Tools

Tools can be controlled via `ALLOWED_TOOLS` and `BLOCKED_TOOLS`:

- `Read` - Read files
- `Write` - Write files
- `Edit` - Edit files
- `Grep` - Search in files
- `Bash` - Execute commands (use with caution)
- `Computer` - Computer use (typically blocked)

### MCP Tools

When MCP servers are enabled, additional Bitbucket-specific tools become available to Claude:

- `bitbucket_comment` - Create PR comments
- `bitbucket_create_pr` - Create pull requests
- `bitbucket_get_pr` - Get PR information
- `bitbucket_get_diff` - Get PR diff
- `pipeline_set_output` - Set outputs for pipeline
- `pipeline_save_state` - Save state between steps

## Direct PR Editing via API

### Source API for File Operations

The pipe includes a Source API that allows Claude to edit files directly in pull requests:

```typescript
// Get file content from PR branch
const content = await client.getFileContent(branch, path);

// Update file on PR branch
const result = await client.updateFile(
  branch,
  path,
  newContent,
  "Fix: Update color to lighter shade",
  { name: "Claude Code", email: "noreply@anthropic.com" }
);
```

Features:
- **Direct editing**: Claude can modify files directly on the PR's source branch
- **API-based commits**: Creates proper commits with messages
- **No local access needed**: Works even when Claude can't access local files
- **Maintains PR context**: All changes appear in the existing PR

## API Integration

### Using Bitbucket SDK

The implementation uses the official `bitbucket` npm package:

```typescript
import { Bitbucket } from "bitbucket";

const client = new Bitbucket({
  auth: { token: process.env.BITBUCKET_ACCESS_TOKEN }
});

const pr = await client.pullrequests.get({
  workspace: "team",
  repo_slug: "repo",
  pull_request_id: 123
});
```

### Fallback Strategy

When API access is unavailable (no token), the system falls back to environment variables:

1. Check for `BITBUCKET_ACCESS_TOKEN`
2. Try `BITBUCKET_USERNAME` + `BITBUCKET_APP_PASSWORD`
3. Fall back to environment variables only
4. Log warnings but continue execution

## Differences from GitHub Actions

### Architecture Differences

| Aspect | GitHub Actions | Bitbucket Pipelines |
|--------|---------------|-------------------|
| Execution | Composite actions on runners | Docker containers |
| Configuration | Multiple YAML files | Single `bitbucket-pipelines.yml` |
| Events | Rich event system | Limited trigger types |
| Reusability | Actions marketplace | Pipes |
| State | Action state/outputs | File-based state |

### Implementation Adaptations

1. **No Composite Actions**: Everything runs in a single container
2. **Limited Events**: Uses environment detection for event types
3. **File-Based State**: Uses `BITBUCKET_PIPE_STORAGE_DIR` for persistence
4. **No Real-time Webhooks**: Relies on pipeline triggers
5. **Different API**: REST-only, no GraphQL

## Development

### Local Development

```bash
# Clone repository
git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git
cd Claude_Code_Bitbucket

# Install dependencies
bun install

# Run type checking
bun run typecheck

# Build
bun run build

# Test locally
export BITBUCKET_WORKSPACE=test
export BITBUCKET_REPO_SLUG=test-repo
export ANTHROPIC_API_KEY=your-key
export MODE=agent
bun run dist/index.js
```

### Docker Development

```bash
# Build image
docker build -t claude-bitbucket-pipe .

# Run container
docker run \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e BITBUCKET_WORKSPACE=test \
  -e BITBUCKET_REPO_SLUG=repo \
  -e MODE=agent \
  -v $(pwd):/workspace \
  claude-bitbucket-pipe
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```
   Error: No authentication configured
   ```
   Solution: Ensure `ANTHROPIC_API_KEY` or cloud credentials are set

2. **API Access Issues**
   ```
   Warning: No access token, using environment data only
   ```
   Solution: Add `BITBUCKET_ACCESS_TOKEN` for full API features

3. **Module Not Found**
   ```
   Error: Cannot find module 'bitbucket'
   ```
   Solution: Run `bun install` to install dependencies

4. **Timeout Issues**
   ```
   Error: Execution timed out after 10 minutes
   ```
   Solution: Increase `TIMEOUT_MINUTES` or reduce `MAX_TURNS`

### Debug Mode

Enable verbose logging for troubleshooting:

```yaml
export VERBOSE=true
export DRY_RUN=true  # Test without making changes
```

## Security Considerations

1. **API Keys**: Always use secured repository variables
2. **Tool Access**: Restrict tools in production (`BLOCKED_TOOLS`)
3. **Branch Protection**: Use `AUTO_COMMIT=false` for manual review
4. **Audit Logging**: Review pipeline logs regularly
5. **Permissions**: Use minimal required permissions for tokens

## Performance Optimization

1. **Cache Dependencies**: Use pipeline caches for `node_modules`
2. **Limit Turns**: Set appropriate `MAX_TURNS` for your use case
3. **Tool Restrictions**: Block unnecessary tools to reduce processing
4. **Parallel Steps**: Run independent operations in parallel

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Support

- **Issues**: [GitHub Issues](https://github.com/tsadrakula/Claude_Code_Bitbucket/issues)
- **Documentation**: This file and README.md
- **Examples**: See `examples/` directory

## License

MIT License - See [LICENSE](LICENSE) file for details.