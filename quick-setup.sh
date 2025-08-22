#!/bin/bash

# Quick Setup Script for Claude Code Bitbucket Pipe
# This script helps you set up Claude Code in your Bitbucket repository

echo "🚀 Claude Code Bitbucket - Quick Setup"
echo "======================================"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository"
    echo "Please run this script from your Bitbucket repository root"
    exit 1
fi

# Check for existing pipelines file
if [ -f bitbucket-pipelines.yml ]; then
    echo "⚠️  Found existing bitbucket-pipelines.yml"
    echo "Creating backup: bitbucket-pipelines.yml.backup"
    cp bitbucket-pipelines.yml bitbucket-pipelines.yml.backup
fi

# Create pipelines configuration
echo "📝 Creating bitbucket-pipelines.yml..."

cat > bitbucket-pipelines.yml << 'EOF'
image: node:20

pipelines:
  # Automatic PR reviews
  pull-requests:
    '**':
      - step:
          name: Claude Code Review
          script:
            # Clone and build Claude Bitbucket Pipe
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude-pipe
            - cd /tmp/claude-pipe
            - npm install -g bun claude-code
            - bun install
            - bun run build
            
            # Return to repo and run Claude
            - cd $BITBUCKET_CLONE_DIR
            - export MODE=experimental-review
            - bun run /tmp/claude-pipe/dist/index.js
          caches:
            - node

  # Manual Claude assistance triggered by comments
  custom:
    claude-assist:
      - step:
          name: Claude Assistant
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude-pipe
            - cd /tmp/claude-pipe
            - npm install -g bun claude-code
            - bun install
            - bun run build
            - cd $BITBUCKET_CLONE_DIR
            - export MODE=tag
            - export TRIGGER_PHRASE="@claude"
            - bun run /tmp/claude-pipe/dist/index.js
          caches:
            - node

    # Security audit
    security-audit:
      - step:
          name: Security Audit with Claude
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude-pipe
            - cd /tmp/claude-pipe
            - npm install -g bun claude-code
            - bun install
            - bun run build
            - cd $BITBUCKET_CLONE_DIR
            - export MODE=agent
            - export CLAUDE_AGENT_PROMPT="Perform a comprehensive security audit"
            - export ALLOWED_TOOLS="Read,Grep"
            - bun run /tmp/claude-pipe/dist/index.js
          caches:
            - node

    # Performance analysis
    performance-check:
      - step:
          name: Performance Analysis
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git /tmp/claude-pipe
            - cd /tmp/claude-pipe
            - npm install -g bun claude-code
            - bun install
            - bun run build
            - cd $BITBUCKET_CLONE_DIR
            - export MODE=agent
            - export CLAUDE_AGENT_PROMPT="Analyze code performance and suggest optimizations"
            - bun run /tmp/claude-pipe/dist/index.js
          caches:
            - node

definitions:
  caches:
    node: node_modules
EOF

echo "✅ Created bitbucket-pipelines.yml"
echo ""

# Create .env.example for local testing
echo "📝 Creating .env.example for reference..."

cat > .env.example << 'EOF'
# Copy this to .env and fill in your values for local testing

# Required: Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-api03-...

# Required: Bitbucket App Password
BITBUCKET_ACCESS_TOKEN=your-app-password-here

# Required: Bitbucket Context
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_REPO_SLUG=your-repo-slug

# Optional: AWS Bedrock (instead of Anthropic)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1

# Optional: Google Vertex AI (instead of Anthropic)
# GCP_PROJECT_ID=
# GCP_SERVICE_ACCOUNT_KEY=
# GCP_REGION=us-central1

# Configuration
MODE=review
MODEL=sonnet
MAX_TURNS=30
TIMEOUT_MINUTES=10
VERBOSE=false
EOF

echo "✅ Created .env.example"
echo ""

# Instructions
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Configure Bitbucket Repository Variables:"
echo "   Go to: Repository Settings → Repository variables"
echo "   Add these secured variables:"
echo "   • ANTHROPIC_API_KEY = your-api-key"
echo "   • BITBUCKET_ACCESS_TOKEN = your-app-password"
echo ""
echo "2. Create Bitbucket App Password:"
echo "   Go to: https://bitbucket.org/account/settings/app-passwords/"
echo "   Permissions needed: Account (Read), Repositories (Read/Write),"
echo "                      Pull requests (Read/Write), Pipelines (Read/Write)"
echo ""
echo "3. Get Anthropic API Key:"
echo "   Go to: https://console.anthropic.com/api-keys"
echo ""
echo "4. Enable Pipelines:"
echo "   Go to: Repository Settings → Pipelines → Settings"
echo "   Toggle: Enable Pipelines = ON"
echo ""
echo "5. Commit and push the pipeline configuration:"
echo "   git add bitbucket-pipelines.yml"
echo "   git commit -m 'Add Claude Code pipeline configuration'"
echo "   git push"
echo ""
echo "6. Test your setup:"
echo "   • Create a PR to trigger automatic review"
echo "   • Or go to Pipelines → Run pipeline → Custom: claude-assist"
echo ""
echo "✅ Setup complete! Check SETUP_GUIDE.md for detailed instructions."
EOF