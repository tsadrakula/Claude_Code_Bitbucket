# Claude Code for Bitbucket Pipelines

Bring Claude's AI-powered code assistance directly into your Bitbucket Pipelines workflows. This pipe enables automated code reviews, intelligent PR responses, and AI-driven development tasks within your CI/CD pipeline.

## 🚀 Quick Start

### Copy this to your `bitbucket-pipelines.yml`:

```yaml
# Basic setup - Claude responds to @claude mentions in PRs
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Assistant
          image: atlassian/default-image:4
          script:
            # Install Bun
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            # Clone and setup Claude pipe
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - bun start
          services:
            - docker
```

### Add these Repository Variables:

1. Go to **Repository settings** → **Repository variables**
2. **REQUIRED for PR comments** (choose one option):
   
   **Option A: Repository Access Token (Recommended)**
   - Go to Repository settings → Access tokens → Create access token
   - Name: "Claude Code"
   - Permissions: Pull requests (write), Repositories (read)
   - Set `BITBUCKET_ACCESS_TOKEN` = `x-token-auth:your_token_here`
   
   **Option B: App Password**
   - `BITBUCKET_ACCESS_TOKEN` = `username:app_password` ([Create app password](https://bitbucket.org/account/settings/app-passwords/))
   
   **Option C: Separate Variables**
   - `BITBUCKET_USERNAME` = Your username
   - `BITBUCKET_APP_PASSWORD` = Your app password

3. Add your Claude API key (choose one):
   - `ANTHROPIC_API_KEY` - For Anthropic Claude API
   - `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` - For AWS Bedrock
   - `GCP_PROJECT_ID` + `GCP_SERVICE_ACCOUNT_KEY` - For Google Vertex AI

### That's it! 🎉

Now Claude will respond when you:
- Create a PR with `@claude` in the description
- Comment `@claude` on any PR
- Tag `@claude` for code reviews

## 📦 Installation Options

### Option 1: Atlassian Default Image (Recommended)

The Atlassian default image has git and other tools pre-installed:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Assistant
          image: atlassian/default-image:4
          script:
            # Install Bun
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            # Clone and setup Claude pipe
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe
            - bun install
            - bun run build
            - bun start
          services:
            - docker
```

### Option 2: Node Alpine Image

Lighter weight option with Node.js:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Assistant
          image: node:20-alpine
          script:
            # Install required tools
            - apk add --no-cache git bash
            - npm install -g bun
            # Clone and setup Claude pipe
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe
            - bun install
            - bun run build
            - bun start
          services:
            - docker
```

### Option 3: Docker Image (Fastest)

Pre-built Docker image:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Assistant
          image: tsadrakula/claude-bitbucket-pipe:latest
          script:
            - /app/run.sh
```

### Option 4: Custom Pipe (Advanced)

1. Fork this repository
2. Customize as needed
3. Build and publish to your workspace:

```bash
# Clone and customize
git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git
cd Claude_Code_Bitbucket

# Install and build
bun install
bun run build

# Build Docker image
docker build -t your-workspace/claude-code-pipe:latest .

# Push to your registry
docker push your-workspace/claude-code-pipe:latest
```

Then use in your pipeline:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Assistant
          script:
            - pipe: your-workspace/claude-code-pipe:latest
              variables:
                MODE: "tag"
                TRIGGER_PHRASE: "@claude"
```

## ⚙️ Configuration Examples

### PR Review Mode (Automatic Reviews)

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Automatic PR Review
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - MODE=experimental-review bun start
```

### Agent Mode (Autonomous Tasks)

```yaml
pipelines:
  custom:
    claude-agent:
      - step:
          name: Claude Agent
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - MODE=agent TASK="Refactor authentication module" bun start
```

### Custom Trigger Phrase

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude with Custom Trigger
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - TRIGGER_PHRASE="@ai-assist" bun start
```

## 📋 Environment Variables

### Required for Full Functionality

| Variable | Description |
|----------|-------------|
| `BITBUCKET_ACCESS_TOKEN` | **REQUIRED for PR comments** - Format: `username:app_password` |
| `BITBUCKET_USERNAME` | Alternative: Your Bitbucket username (use with BITBUCKET_APP_PASSWORD) |
| `BITBUCKET_APP_PASSWORD` | Alternative: Your app password (use with BITBUCKET_USERNAME) |

### Required (Choose One Authentication Method)

| Variable | Description |
|----------|-------------|
| **Anthropic API** | |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| **AWS Bedrock** | |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (default: us-east-1) |
| **Google Vertex AI** | |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_SERVICE_ACCOUNT_KEY` | Service account JSON key |
| `GCP_REGION` | GCP region (default: us-central1) |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MODE` | Operation mode: `tag`, `agent`, or `experimental-review` | `tag` |
| `TRIGGER_PHRASE` | Phrase to trigger Claude in comments | `@claude` |
| `MODEL` | Claude model to use | `claude-3-5-sonnet-20241022` |
| `MAX_TURNS` | Maximum conversation turns | `30` |
| `TIMEOUT_MINUTES` | Execution timeout | `10` |
| `BRANCH_PREFIX` | Prefix for created branches | `claude/` |
| `AUTO_COMMIT` | Automatically commit changes | `false` |
| `AUTO_PR` | Automatically create PRs | `false` |
| `VERBOSE` | Enable verbose logging | `false` |
| `DRY_RUN` | Test without making changes | `false` |

## 💬 Usage Examples

### Ask Claude to Review Code

In a PR comment:
```
@claude Can you review this authentication implementation for security issues?
```

### Request Code Improvements

```
@claude Please add input validation to the user registration function
```

### Get Implementation Suggestions

```
@claude How would you implement rate limiting for this API endpoint?
```

### Fix Issues

```
@claude The tests are failing. Can you help fix them?
```

## 🔧 Advanced Setup

### Using AWS Bedrock

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude via AWS Bedrock
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - |
              export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
              export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
              export AWS_REGION="us-east-1"
              export MODEL="anthropic.claude-3-5-sonnet-20241022-v2:0"
              bun start
```

### Using Google Vertex AI

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude via Google Vertex
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - |
              export GCP_PROJECT_ID=$GCP_PROJECT_ID
              export GCP_SERVICE_ACCOUNT_KEY=$GCP_SERVICE_ACCOUNT_KEY
              export GCP_REGION="us-central1"
              export MODEL="claude-3-5-sonnet-v2@20241022"
              bun start
```

### Complete Pipeline with Multiple Triggers

```yaml
pipelines:
  # Automatic PR reviews
  pull-requests:
    '**':
      - step:
          name: Claude PR Assistant
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - bun start
  
  # Manual agent tasks
  custom:
    run-claude-agent:
      - variables:
          - name: TASK
            default: "Analyze and improve code quality"
      - step:
          name: Claude Agent Task
          image: atlassian/default-image:4
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - MODE=agent TASK="$TASK" bun start
  
  # Scheduled maintenance
  branches:
    main:
      - step:
          name: Weekly Code Review
          image: atlassian/default-image:4
          trigger: manual
          script:
            - curl -fsSL https://bun.sh/install | bash
            - export PATH="$HOME/.bun/bin:$PATH"
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git claude-pipe
            - cd claude-pipe && bun install && bun run build
            - MODE=agent TASK="Review code for potential improvements" bun start
```

## 🚀 Development

### Local Setup

```bash
# Clone the repository
git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git
cd Claude_Code_Bitbucket

# Install dependencies
bun install

# Run tests
bun test

# Build the project
bun run build

# Test locally with your Bitbucket repo
export BITBUCKET_WORKSPACE="your-workspace"
export BITBUCKET_REPO_SLUG="your-repo"
export ANTHROPIC_API_KEY="your-api-key"
bun run dev
```

### Building Docker Image

```bash
# Build image
docker build -t claude-bitbucket-pipe .

# Test locally
docker run --env-file .env claude-bitbucket-pipe

# Push to registry
docker tag claude-bitbucket-pipe your-registry/claude-bitbucket-pipe:latest
docker push your-registry/claude-bitbucket-pipe:latest
```

## 🔒 Security Best Practices

1. **API Keys**: Always use Bitbucket's secured repository variables
2. **Permissions**: Use repository access tokens with minimal required permissions
3. **Review**: Always review Claude's suggestions before merging
4. **Branches**: Use `BRANCH_PREFIX` to isolate Claude's changes
5. **Dry Run**: Test with `DRY_RUN=true` first

## 🐛 Troubleshooting

### Claude not responding?

1. Check the trigger phrase matches (default: `@claude`)
2. Verify API key is set in repository variables
3. Check pipeline logs: Repository → Pipelines → View logs

### Git command not found?

Use `atlassian/default-image:4` or install git:
```yaml
# For alpine images
- apk add --no-cache git

# For debian/ubuntu images
- apt-get update && apt-get install -y git
```

### Authentication errors?

```bash
# Test API key locally
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

### Timeout issues?

```yaml
# Increase timeout in pipeline
script:
  - TIMEOUT_MINUTES=30 bun start
```

### Setting up Bitbucket Authentication?

**Recommended: Repository Access Token**
1. Go to Repository settings → Security → Access tokens
2. Click "Create access token"
3. Name: "Claude Code"
4. Permissions:
   - Pull requests: Write
   - Repositories: Read
5. Copy the token
6. Set `BITBUCKET_ACCESS_TOKEN` = `x-token-auth:TOKEN_HERE`

**Alternative: App Password**
1. Go to [Bitbucket App Passwords](https://bitbucket.org/account/settings/app-passwords/)
2. Click "Create app password"
3. Label: "Claude Code"
4. Permissions:
   - Pull requests: Read and Write
   - Repositories: Read
5. Copy the password
6. Set `BITBUCKET_ACCESS_TOKEN` = `yourusername:password_here`

### Need help?

- 📖 Read the [technical documentation](./CLAUDE.md)
- 🐛 [Report an issue](https://github.com/tsadrakula/Claude_Code_Bitbucket/issues)
- 💬 Check [existing issues](https://github.com/tsadrakula/Claude_Code_Bitbucket/issues)
- 🚀 See [example configurations](./examples/)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

<div align="center">
  <strong>Built with ❤️ for Bitbucket teams using Claude</strong>
  <br>
  <sub>Powered by Anthropic's Claude and Bitbucket Pipelines</sub>
</div>