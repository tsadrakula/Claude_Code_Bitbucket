# Setup Guide: Implementing Claude Code in Your Bitbucket Repository

This guide will walk you through setting up Claude Code in your Bitbucket repository step by step.

## Prerequisites

1. A Bitbucket account with a repository
2. An Anthropic API key (or AWS/GCP credentials)
3. Repository admin access to configure variables and enable pipelines

## Step 1: Get Your API Credentials

### Option A: Anthropic API (Recommended)
1. Go to https://console.anthropic.com/api-keys
2. Create a new API key
3. Copy and save it securely

### Option B: AWS Bedrock
- AWS Access Key ID
- AWS Secret Access Key
- AWS Region (e.g., us-east-1)

### Option C: Google Vertex AI
- GCP Project ID
- GCP Service Account JSON key
- GCP Region (e.g., us-central1)

## Step 2: Create a Bitbucket App Password

1. Go to **Bitbucket** → **Personal Settings** (click your avatar)
2. Navigate to **App passwords** under Access management
3. Click **Create app password**
4. Label it: `Claude Code`
5. Select these permissions:
   - **Account**: Read
   - **Repositories**: Read, Write
   - **Pull requests**: Read, Write
   - **Pipelines**: Read, Write
6. Click **Create**
7. **Copy the password immediately** (you won't see it again!)

## Step 3: Configure Repository Variables

1. Go to your Bitbucket repository
2. Click **Repository settings** (gear icon)
3. Navigate to **Repository variables** under Pipelines
4. Add these variables:

### Required Variables:
| Variable Name | Value | Secured |
|--------------|-------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | ✅ Yes |
| `BITBUCKET_ACCESS_TOKEN` | Your app password from Step 2 | ✅ Yes |

### Optional Variables (if using AWS/GCP):
| Variable Name | Value | Secured |
|--------------|-------|---------|
| `AWS_ACCESS_KEY_ID` | Your AWS key | ✅ Yes |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret | ✅ Yes |
| `AWS_REGION` | e.g., us-east-1 | No |
| `GCP_PROJECT_ID` | Your GCP project | No |
| `GCP_SERVICE_ACCOUNT_KEY` | JSON key content | ✅ Yes |

## Step 4: Add Pipeline Configuration

1. In your repository root, create or edit `bitbucket-pipelines.yml`
2. Add the following configuration:

```yaml
image: node:20

pipelines:
  # Automatic PR reviews
  pull-requests:
    '**':
      - step:
          name: Claude Code Review
          script:
            # Option 1: Build and run locally
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude-pipe
            - cd /tmp/claude-pipe
            - npm install -g bun
            - bun install
            - bun run build
            - cd $BITBUCKET_CLONE_DIR
            - MODE=experimental-review bun run /tmp/claude-pipe/dist/index.js
          
          # Option 2: Use Docker (when published)
          # script:
          #   - pipe: docker://claudecode/bitbucket-pipe:latest
          #     variables:
          #       MODE: experimental-review
          #       ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
          #       BITBUCKET_ACCESS_TOKEN: ${BITBUCKET_ACCESS_TOKEN}

  # Manual Claude assistance
  custom:
    claude-help:
      - step:
          name: Claude Assistant
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude-pipe
            - cd /tmp/claude-pipe
            - npm install -g bun
            - bun install
            - bun run build
            - cd $BITBUCKET_CLONE_DIR
            - MODE=tag TRIGGER_PHRASE="@claude" bun run /tmp/claude-pipe/dist/index.js
```

## Step 5: Enable Pipelines

1. In your repository, go to **Repository settings**
2. Navigate to **Pipelines** → **Settings**
3. Toggle **Enable Pipelines** to ON

## Step 6: Test Your Setup

### Test 1: Manual Pipeline Run
1. Go to **Pipelines** in your repository
2. Click **Run pipeline**
3. Choose **Custom: claude-help**
4. Click **Run**

### Test 2: PR Review
1. Create a new branch with some changes
2. Open a Pull Request
3. Claude should automatically review the PR

### Test 3: PR Comment Trigger
1. In an open PR, add a comment with: `@claude please review this code`
2. Run the custom pipeline `claude-help`
3. Claude should respond to your request

## Troubleshooting

### Common Issues:

1. **"No authentication configured"**
   - Verify your API key variables are set correctly
   - Check that variable names match exactly

2. **"Pipeline not found"**
   - Ensure `bitbucket-pipelines.yml` is in the repository root
   - Check YAML syntax is valid

3. **"Permission denied"**
   - Verify app password has correct permissions
   - Ensure repository variables are marked as secured

4. **"Claude Code CLI not found"**
   - The npm install step may have failed
   - Try adding `npm install -g claude-code` to your pipeline

### Debug Mode

Add `VERBOSE: "true"` to your pipeline variables for detailed logging:

```yaml
variables:
  MODE: review
  VERBOSE: "true"
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

## Advanced Configuration

### Custom Prompts

For agent mode, you can provide custom prompts:

```yaml
variables:
  MODE: agent
  CLAUDE_AGENT_PROMPT: |
    Review this code for:
    1. Security vulnerabilities
    2. Performance issues
    3. Best practices
```

### Tool Restrictions

Control which tools Claude can use:

```yaml
variables:
  ALLOWED_TOOLS: "Read,Write,Edit"
  BLOCKED_TOOLS: "Bash,Computer"
```

### Branch Management

Enable automatic branch creation and PRs:

```yaml
variables:
  AUTO_COMMIT: "true"
  AUTO_PR: "true"
  BRANCH_PREFIX: "claude/fix-"
```

## Support

- **Issues**: https://github.com/tsadrakula/Claude_Code_Bitbucket/issues
- **Documentation**: See CLAUDE.md for detailed API reference
- **Examples**: Check the `examples/` directory for more configurations

## Next Steps

1. ✅ Configure your first pipeline
2. ✅ Test with a simple PR
3. 🎯 Customize for your workflow
4. 🚀 Explore advanced features

Happy coding with Claude! 🤖