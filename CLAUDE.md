# Claude Code for Bitbucket Pipelines

This project provides a Bitbucket Pipe implementation of Claude Code, enabling AI-powered code assistance directly in your Bitbucket workflows. It's the Bitbucket equivalent of the GitHub Actions Claude Code implementation.

## Architecture Overview

The implementation is built with TypeScript and Bun runtime, mirroring the GitHub Actions version's architecture while adapting to Bitbucket's pipeline-based execution model.

### Key Components

```
src/
├── entrypoints/          # Pipeline entry points
│   ├── collect-inputs.ts # Input validation and collection
│   ├── prepare.ts        # Setup and preparation logic
│   ├── format-turns.ts   # Conversation formatting
│   └── update-comment.ts # Bitbucket comment updates
├── bitbucket/           # Bitbucket API integration
│   ├── api.ts           # API client for Bitbucket Cloud
│   └── comment.ts       # PR comment management
├── modes/               # Operational modes
│   ├── tag/             # @claude mention mode
│   ├── agent/           # Automated/scheduled mode
│   └── review/          # PR review mode
├── claude/              # Claude integration
│   └── runner.ts        # Claude Code execution
├── prepare/             # Preparation workflow
├── format/              # Output formatting
├── types/               # TypeScript types
└── utils/               # Utility functions
```

## Modes of Operation

### 1. Tag Mode (Default)
Responds to `@claude` mentions in PR comments, commit messages, or manual triggers.

```yaml
- pipe: claude-code/bitbucket-pipe:latest
  variables:
    MODE: tag
    TRIGGER_PHRASE: "@claude"
```

### 2. Agent Mode
For automated/scheduled runs without user interaction.

```yaml
- pipe: claude-code/bitbucket-pipe:latest
  variables:
    MODE: agent
    CLAUDE_AGENT_PROMPT: "Perform security audit and suggest improvements"
```

### 3. Review Mode (Experimental)
Automatic PR reviews on pull request events.

```yaml
- pipe: claude-code/bitbucket-pipe:latest
  variables:
    MODE: experimental-review
```

## Authentication Providers

### Anthropic API (Primary)
```yaml
variables:
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  MODEL: claude-3-5-sonnet-20241022
```

### AWS Bedrock
```yaml
variables:
  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  AWS_REGION: us-east-1
  MODEL: anthropic.claude-3-5-sonnet-20241022-v2
```

### Google Vertex AI
```yaml
variables:
  GCP_PROJECT_ID: ${GCP_PROJECT_ID}
  GCP_SERVICE_ACCOUNT_KEY: ${GCP_SERVICE_ACCOUNT_KEY}
  GCP_REGION: us-central1
  MODEL: claude-3-5-sonnet@20241022
```

## Environment Variables

### Required
- `BITBUCKET_WORKSPACE` - Workspace slug (auto-set by Pipelines)
- `BITBUCKET_REPO_SLUG` - Repository slug (auto-set by Pipelines)
- One of: `ANTHROPIC_API_KEY`, AWS credentials, or GCP credentials

### Optional
- `MODE` - Execution mode: `tag`, `agent`, `experimental-review` (default: `tag`)
- `TRIGGER_PHRASE` - Phrase that triggers Claude (default: `@claude`)
- `MODEL` - Claude model to use (default: `claude-3-5-sonnet-20241022`)
- `MAX_TURNS` - Maximum conversation turns (default: `30`)
- `TIMEOUT_MINUTES` - Timeout in minutes (default: `10`)
- `ALLOWED_TOOLS` - Comma-separated list of allowed tools
- `BLOCKED_TOOLS` - Comma-separated list of blocked tools
- `BRANCH_PREFIX` - Prefix for created branches (default: `claude/`)
- `AUTO_COMMIT` - Automatically commit changes (default: `false`)
- `AUTO_PR` - Automatically create pull request (default: `false`)
- `BITBUCKET_ACCESS_TOKEN` - For API operations (recommended)
- `VERBOSE` - Enable verbose logging (default: `false`)
- `DRY_RUN` - Run without making changes (default: `false`)

## Pipeline Configuration Examples

### Basic PR Review
```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Review
          script:
            - pipe: claude-code/bitbucket-pipe:latest
              variables:
                MODE: review
                ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

### PR Comment Triggers
```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude PR Assistant
          script:
            - pipe: claude-code/bitbucket-pipe:latest
              variables:
                MODE: tag
                TRIGGER_PHRASE: "@claude"
                ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
                BITBUCKET_ACCESS_TOKEN: ${BITBUCKET_ACCESS_TOKEN}
```

### Scheduled Code Analysis
```yaml
pipelines:
  schedules:
    - cron: "0 0 * * MON"
      pattern: main
      pipelines:
        - step:
            name: Weekly Code Analysis
            script:
              - pipe: claude-code/bitbucket-pipe:latest
                variables:
                  MODE: agent
                  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
                  CLAUDE_AGENT_PROMPT: "Analyze code quality and suggest improvements"
```

### Manual Trigger with Custom Prompt
```yaml
pipelines:
  custom:
    claude-assist:
      - step:
          name: Claude Manual Assistance
          script:
            - pipe: claude-code/bitbucket-pipe:latest
              variables:
                MODE: tag
                ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

## Tool Configuration

### Allowed Tools
Specify which tools Claude can use:
```yaml
ALLOWED_TOOLS: "Read,Write,Edit,Grep"
```

### Blocked Tools
Prevent specific tools from being used:
```yaml
BLOCKED_TOOLS: "Bash,Computer"
```

## Branch and Commit Management

### Automatic Branch Creation
```yaml
variables:
  AUTO_COMMIT: "true"
  BRANCH_PREFIX: "claude/fix-"
```

### Automatic PR Creation
```yaml
variables:
  AUTO_COMMIT: "true"
  AUTO_PR: "true"
```

## Bitbucket API Integration

The pipe integrates with Bitbucket Cloud API v2 for:
- Pull request management
- Comment creation and updates
- Branch operations
- Pipeline triggers
- Repository information

### API Authentication
Provide a Bitbucket access token for full functionality:
```yaml
BITBUCKET_ACCESS_TOKEN: ${BITBUCKET_ACCESS_TOKEN}
```

Create an access token at: https://bitbucket.org/account/settings/app-passwords/

## Event Detection

The pipe automatically detects Bitbucket events:
- `PULL_REQUEST` - PR created/updated
- `PUSH` - Code pushed to branch
- `TAG` - Tag created
- `MANUAL` - Manual pipeline trigger
- `SCHEDULE` - Scheduled pipeline

## Output and Artifacts

Results are saved to `BITBUCKET_PIPE_STORAGE_DIR` when available:
```json
{
  "branch": "claude/fix-123456",
  "executionFile": "/tmp/claude/execution.json",
  "status": "success",
  "turns": 5
}
```

## Differences from GitHub Actions

### Architecture
- **Bitbucket**: Docker container-based pipes
- **GitHub**: Composite actions with runners

### Configuration
- **Bitbucket**: Single `bitbucket-pipelines.yml`
- **GitHub**: Multiple workflow files in `.github/workflows/`

### Event System
- **Bitbucket**: Limited event types, branch-based triggers
- **GitHub**: Rich event system with fine-grained triggers

### Execution Model
- **Bitbucket**: Sequential steps in pipelines
- **GitHub**: Parallel jobs and matrix builds

### Tool Reusability
- **Bitbucket**: Pipes for reusable components
- **GitHub**: Composite actions and reusable workflows

## Development

### Building the Pipe
```bash
# Install dependencies
bun install

# Build TypeScript
bun run build

# Run tests
bun test

# Type check
bun run typecheck

# Format code
bun run format
```

### Local Testing
```bash
# Set environment variables
export BITBUCKET_WORKSPACE=your-workspace
export BITBUCKET_REPO_SLUG=your-repo
export ANTHROPIC_API_KEY=your-key

# Run the pipe
bun run src/index.ts
```

### Docker Build
```bash
# Build the Docker image
docker build -t claude-bitbucket-pipe .

# Run locally
docker run -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
           -e BITBUCKET_WORKSPACE=workspace \
           -e BITBUCKET_REPO_SLUG=repo \
           claude-bitbucket-pipe
```

## Deployment

### Using Pre-built Pipe
```yaml
- pipe: claude-code/bitbucket-pipe:latest
```

### Self-hosted Pipe
1. Fork this repository
2. Build and push to your Docker registry
3. Reference your custom pipe:
```yaml
- pipe: your-org/claude-bitbucket-pipe:version
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify API keys are correctly set
   - Check token permissions

2. **Timeout Issues**
   - Increase `TIMEOUT_MINUTES`
   - Reduce `MAX_TURNS`

3. **API Rate Limits**
   - Add delays between requests
   - Use caching where possible

4. **Permission Errors**
   - Ensure `BITBUCKET_ACCESS_TOKEN` has required scopes
   - Check repository permissions

### Debug Mode
Enable verbose logging:
```yaml
variables:
  VERBOSE: "true"
```

## Security Considerations

1. **Secret Management**
   - Use Bitbucket repository variables for secrets
   - Never commit API keys to code
   - Use secured variables for sensitive data

2. **Access Control**
   - Limit pipe permissions with appropriate scopes
   - Use deployment environments for production

3. **Tool Restrictions**
   - Block dangerous tools in production
   - Review allowed tools regularly

4. **Audit Logging**
   - Monitor pipeline executions
   - Review Claude's actions

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- Create an issue in the repository
- Check existing documentation
- Review pipeline logs for errors

## Acknowledgments

This implementation is inspired by the official [Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) and adapted for Bitbucket Pipelines.