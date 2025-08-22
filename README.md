# Claude Code for Bitbucket Pipelines

AI-powered code assistance for Bitbucket Pipelines, powered by Claude. This is the Bitbucket equivalent of the [GitHub Actions Claude Code](https://github.com/anthropics/claude-code-action) implementation.

## Features

- 🤖 **AI Code Reviews** - Automatic PR reviews with actionable feedback
- 💬 **Interactive Assistance** - Respond to `@claude` mentions in PR comments
- 🔄 **Multiple Modes** - Tag, Agent, and Review modes for different workflows
- 🔐 **Multi-Provider Support** - Anthropic API, AWS Bedrock, or Google Vertex AI
- 🌿 **Branch Management** - Automatic branch creation and PR submission
- 🛠️ **Tool Configuration** - Fine-grained control over Claude's capabilities
- 📊 **Comprehensive Analysis** - Security audits, performance reviews, and more

## Quick Start

### Option 1: Interactive Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/claude-bitbucket-pipe.git
cd claude-bitbucket-pipe

# Install dependencies
bun install

# Run interactive setup
bun run setup
```

This will guide you through:
- Installing Claude Code CLI
- Configuring Bitbucket access
- Setting up API credentials
- Creating pipeline templates

### Option 2: Manual Setup

#### 1. Add to your `bitbucket-pipelines.yml`:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Review
          script:
            - pipe: claudecode/bitbucket-pipe:latest
              variables:
                MODE: review
                ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
          services:
            - docker
```

### 2. Configure Repository Variables:

Go to Repository Settings → Repository variables and add:
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `BITBUCKET_ACCESS_TOKEN` - App password for PR operations (optional but recommended)

### 3. Enable Pipelines:

Go to Repository Settings → Pipelines → Settings and enable pipelines.

## Usage Examples

### PR Comment Triggers

Mention `@claude` in a PR comment to get assistance:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Assistant
          script:
            - pipe: claudecode/bitbucket-pipe:latest
              variables:
                MODE: tag
                TRIGGER_PHRASE: "@claude"
                ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
                BITBUCKET_ACCESS_TOKEN: ${BITBUCKET_ACCESS_TOKEN}
```

Then comment on a PR:
> @claude Can you review this code for security vulnerabilities?

### Automated Security Audits

```yaml
pipelines:
  schedules:
    - cron: "0 0 * * MON"
      pattern: main
      pipelines:
        - step:
            name: Weekly Security Audit
            script:
              - pipe: claudecode/bitbucket-pipe:latest
                variables:
                  MODE: agent
                  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
                  CLAUDE_AGENT_PROMPT: "Perform security audit"
```

### Manual Code Improvements

```yaml
pipelines:
  custom:
    improve-code:
      - step:
          name: Code Improvements
          script:
            - pipe: claudecode/bitbucket-pipe:latest
              variables:
                MODE: agent
                ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
                AUTO_COMMIT: "true"
                AUTO_PR: "true"
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MODE` | Execution mode: `tag`, `agent`, `experimental-review` | `tag` | No |
| `TRIGGER_PHRASE` | Phrase that triggers Claude | `@claude` | No |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | Yes* |
| `MODEL` | Claude model to use | `claude-3-5-sonnet-20241022` | No |
| `MAX_TURNS` | Maximum conversation turns | `30` | No |
| `TIMEOUT_MINUTES` | Timeout in minutes | `10` | No |
| `ALLOWED_TOOLS` | Comma-separated allowed tools | - | No |
| `BLOCKED_TOOLS` | Comma-separated blocked tools | - | No |
| `BRANCH_PREFIX` | Prefix for created branches | `claude/` | No |
| `AUTO_COMMIT` | Auto-commit changes | `false` | No |
| `AUTO_PR` | Auto-create pull request | `false` | No |
| `BITBUCKET_ACCESS_TOKEN` | Bitbucket API token | - | No |

*One authentication method required (Anthropic, AWS, or GCP)

### Authentication Options

#### Anthropic API
```yaml
ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

#### AWS Bedrock
```yaml
AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
AWS_REGION: us-east-1
MODEL: anthropic.claude-3-5-sonnet-20241022-v2
```

#### Google Vertex AI
```yaml
GCP_PROJECT_ID: ${GCP_PROJECT_ID}
GCP_SERVICE_ACCOUNT_KEY: ${GCP_SERVICE_ACCOUNT_KEY}
GCP_REGION: us-central1
MODEL: claude-3-5-sonnet@20241022
```

## Modes

### Tag Mode (Default)
Responds to trigger phrases in comments or commits.

### Agent Mode
Automated execution for scheduled or manual runs.

### Review Mode (Experimental)
Automatic code review on PR events.

## Advanced Features

### Tool Configuration

Control which tools Claude can use:

```yaml
ALLOWED_TOOLS: "Read,Write,Edit,Grep"
BLOCKED_TOOLS: "Bash,Computer"
```

### Branch Management

Automatically create branches and PRs:

```yaml
AUTO_COMMIT: "true"
AUTO_PR: "true"
BRANCH_PREFIX: "claude/fix-"
```

## Development

### Prerequisites
- [Bun](https://bun.sh) >= 1.2.11
- Docker (for building images)
- TypeScript knowledge

### Setup
```bash
# Install dependencies
bun install

# Run type checking
bun run typecheck

# Run tests
bun test

# Build
bun run build

# Format code
bun run format
```

### Testing Locally
```bash
# Set environment variables
export BITBUCKET_WORKSPACE=your-workspace
export BITBUCKET_REPO_SLUG=your-repo
export ANTHROPIC_API_KEY=your-key

# Run the pipe
bun run src/index.ts
```

### Building Docker Image
```bash
docker build -t claude-bitbucket-pipe .
```

## Architecture

Built with TypeScript and Bun runtime, mirroring the GitHub Actions implementation:

- **TypeScript** for type safety and maintainability
- **Bun** for fast execution and native TypeScript support
- **Modular design** with separate modes and providers
- **Bitbucket API v2** integration
- **Docker** containerization for pipeline execution

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Create an issue for bugs or feature requests
- Check [CLAUDE.md](CLAUDE.md) for detailed documentation
- Review pipeline logs for troubleshooting

## Acknowledgments

This implementation is based on the official [Claude Code GitHub Action](https://github.com/anthropics/claude-code-action) and adapted for Bitbucket Pipelines.