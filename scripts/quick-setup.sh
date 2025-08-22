#!/bin/bash

# Claude Code for Bitbucket - Quick Setup Script
# This script helps you quickly set up Claude Code in your Bitbucket repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Claude Code for Bitbucket - Quick Setup Script      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local response
    
    read -p "$prompt [$default]: " response
    echo "${response:-$default}"
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists git; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

print_success "Git is installed"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository. Please run this script from your repository root."
    exit 1
fi

print_success "In a git repository"

# Get repository information
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

print_info "Repository root: $REPO_ROOT"

# Check if bitbucket-pipelines.yml already exists
if [ -f "bitbucket-pipelines.yml" ]; then
    print_warning "bitbucket-pipelines.yml already exists."
    read -p "Do you want to backup the existing file? (y/n): " backup_choice
    if [[ "$backup_choice" =~ ^[Yy]$ ]]; then
        backup_file="bitbucket-pipelines.yml.backup.$(date +%Y%m%d%H%M%S)"
        cp bitbucket-pipelines.yml "$backup_file"
        print_success "Backed up to $backup_file"
    fi
fi

# Select setup mode
echo ""
print_info "Select setup mode:"
echo "  1) Basic - PR mentions only (@claude)"
echo "  2) Advanced - All features (PR mentions, auto-review, agent mode)"
echo "  3) Custom - Choose specific features"
echo ""
read -p "Enter your choice (1-3): " setup_mode

# Select authentication provider
echo ""
print_info "Select your Claude provider:"
echo "  1) Anthropic API (recommended)"
echo "  2) AWS Bedrock"
echo "  3) Google Vertex AI"
echo ""
read -p "Enter your choice (1-3): " auth_provider

# Create environment variables guide
ENV_VARS_FILE=".bitbucket-env-setup.txt"
echo "# Bitbucket Repository Variables to Configure" > "$ENV_VARS_FILE"
echo "# Go to: Repository Settings → Repository variables" >> "$ENV_VARS_FILE"
echo "# Add these as SECURED variables:" >> "$ENV_VARS_FILE"
echo "" >> "$ENV_VARS_FILE"

case "$auth_provider" in
    1)
        echo "ANTHROPIC_API_KEY=<your-anthropic-api-key>" >> "$ENV_VARS_FILE"
        AUTH_SECTION="            # Using Anthropic API
            - export ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}"
        ;;
    2)
        echo "AWS_ACCESS_KEY_ID=<your-aws-access-key>" >> "$ENV_VARS_FILE"
        echo "AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>" >> "$ENV_VARS_FILE"
        AWS_REGION=$(prompt_with_default "Enter AWS region" "us-east-1")
        AUTH_SECTION="            # Using AWS Bedrock
            - export AWS_ACCESS_KEY_ID=\${AWS_ACCESS_KEY_ID}
            - export AWS_SECRET_ACCESS_KEY=\${AWS_SECRET_ACCESS_KEY}
            - export AWS_REGION=\"$AWS_REGION\"
            - export MODEL=\"anthropic.claude-3-5-sonnet-20241022-v2:0\""
        ;;
    3)
        echo "GCP_PROJECT_ID=<your-gcp-project-id>" >> "$ENV_VARS_FILE"
        echo "GCP_SERVICE_ACCOUNT_KEY=<your-service-account-key-json>" >> "$ENV_VARS_FILE"
        GCP_REGION=$(prompt_with_default "Enter GCP region" "us-central1")
        AUTH_SECTION="            # Using Google Vertex AI
            - export GCP_PROJECT_ID=\${GCP_PROJECT_ID}
            - export GCP_SERVICE_ACCOUNT_KEY=\${GCP_SERVICE_ACCOUNT_KEY}
            - export GCP_REGION=\"$GCP_REGION\"
            - export MODEL=\"claude-3-5-sonnet-v2@20241022\""
        ;;
esac

# Optional: Bitbucket access token
echo "" >> "$ENV_VARS_FILE"
echo "# Optional (but recommended for PR operations):" >> "$ENV_VARS_FILE"
echo "BITBUCKET_ACCESS_TOKEN=<your-bitbucket-app-password>" >> "$ENV_VARS_FILE"

# Create bitbucket-pipelines.yml based on setup mode
case "$setup_mode" in
    1) # Basic setup
        cat > bitbucket-pipelines.yml << EOF
# Claude Code for Bitbucket - Basic Setup
# Claude will respond to @claude mentions in PR comments

image: oven/bun:latest

pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude PR Assistant
          script:
            # Setup Claude pipe
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
            
            # Run Claude
$AUTH_SECTION
            - export MODE=tag
            - export TRIGGER_PHRASE=@claude
            - bun run src/main.ts
          services:
            - docker
EOF
        print_success "Created basic bitbucket-pipelines.yml"
        ;;
        
    2) # Advanced setup
        cat > bitbucket-pipelines.yml << EOF
# Claude Code for Bitbucket - Advanced Setup
# Includes PR mentions, auto-review, and manual agent tasks

image: oven/bun:latest

pipelines:
  # Automatic PR assistant
  pull-requests:
    '**':
      - parallel:
          # Respond to @claude mentions
          - step:
              name: Claude PR Mentions
              script:
                - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
                - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
                - export MODE=tag
                - export TRIGGER_PHRASE=@claude
                - bun run src/main.ts
              services:
                - docker
          
          # Automatic PR review
          - step:
              name: Claude Auto Review
              script:
                - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
                - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
                - export MODE=experimental-review
                - bun run src/main.ts
              services:
                - docker

  # Manual tasks
  custom:
    claude-task:
      - variables:
          - name: TASK
            default: "Review code and suggest improvements"
      - step:
          name: Run Claude Agent
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
            - export MODE=agent
            - export TASK="\${TASK}"
            - bun run src/main.ts
          services:
            - docker

    security-audit:
      - step:
          name: Security Audit
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
            - export MODE=agent
            - export TASK="Perform security audit and identify vulnerabilities"
            - bun run src/main.ts
          services:
            - docker

definitions:
  services:
    docker:
      memory: 2048
EOF
        print_success "Created advanced bitbucket-pipelines.yml"
        ;;
        
    3) # Custom setup
        print_info "Select features to enable:"
        
        # Ask for each feature
        read -p "Enable PR mentions (@claude)? (y/n): " enable_mentions
        read -p "Enable automatic PR reviews? (y/n): " enable_reviews
        read -p "Enable manual agent tasks? (y/n): " enable_agent
        read -p "Enable security audits? (y/n): " enable_security
        
        # Custom trigger phrase
        if [[ "$enable_mentions" =~ ^[Yy]$ ]]; then
            TRIGGER_PHRASE=$(prompt_with_default "Enter trigger phrase" "@claude")
        fi
        
        # Build custom pipeline file
        echo "# Claude Code for Bitbucket - Custom Setup" > bitbucket-pipelines.yml
        echo "" >> bitbucket-pipelines.yml
        echo "image: oven/bun:latest" >> bitbucket-pipelines.yml
        echo "" >> bitbucket-pipelines.yml
        echo "pipelines:" >> bitbucket-pipelines.yml
        
        if [[ "$enable_mentions" =~ ^[Yy]$ ]] || [[ "$enable_reviews" =~ ^[Yy]$ ]]; then
            echo "  pull-requests:" >> bitbucket-pipelines.yml
            echo "    '**':" >> bitbucket-pipelines.yml
            
            if [[ "$enable_mentions" =~ ^[Yy]$ ]]; then
                cat >> bitbucket-pipelines.yml << EOF
      - step:
          name: Claude PR Assistant
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
            - export MODE=tag
            - export TRIGGER_PHRASE=$TRIGGER_PHRASE
            - bun run src/main.ts
          services:
            - docker
EOF
            fi
            
            if [[ "$enable_reviews" =~ ^[Yy]$ ]]; then
                cat >> bitbucket-pipelines.yml << EOF
      - step:
          name: Claude Auto Review
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
            - export MODE=experimental-review
            - bun run src/main.ts
          services:
            - docker
EOF
            fi
        fi
        
        if [[ "$enable_agent" =~ ^[Yy]$ ]] || [[ "$enable_security" =~ ^[Yy]$ ]]; then
            echo "" >> bitbucket-pipelines.yml
            echo "  custom:" >> bitbucket-pipelines.yml
            
            if [[ "$enable_agent" =~ ^[Yy]$ ]]; then
                cat >> bitbucket-pipelines.yml << EOF
    claude-task:
      - variables:
          - name: TASK
            default: "Review code and suggest improvements"
      - step:
          name: Run Claude Agent
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
            - export MODE=agent
            - export TASK="\${TASK}"
            - bun run src/main.ts
          services:
            - docker
EOF
            fi
            
            if [[ "$enable_security" =~ ^[Yy]$ ]]; then
                cat >> bitbucket-pipelines.yml << EOF
    security-audit:
      - step:
          name: Security Audit
          script:
            - git clone https://github.com/tsadrakula/Claude_Code_Bitbucket.git .claude-pipe
            - cd .claude-pipe && bun install --production && bun run build
$AUTH_SECTION
            - export MODE=agent
            - export TASK="Perform security audit"
            - bun run src/main.ts
          services:
            - docker
EOF
            fi
        fi
        
        print_success "Created custom bitbucket-pipelines.yml"
        ;;
esac

# Create .gitignore entries
if [ -f ".gitignore" ]; then
    if ! grep -q ".claude-pipe" .gitignore; then
        echo "" >> .gitignore
        echo "# Claude Code temporary files" >> .gitignore
        echo ".claude-pipe/" >> .gitignore
        echo ".bitbucket-env-setup.txt" >> .gitignore
        print_success "Updated .gitignore"
    fi
else
    cat > .gitignore << EOF
# Claude Code temporary files
.claude-pipe/
.bitbucket-env-setup.txt
EOF
    print_success "Created .gitignore"
fi

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
print_info "Next steps:"
echo ""
echo "  1. Review the generated bitbucket-pipelines.yml file"
echo ""
echo "  2. Configure repository variables in Bitbucket:"
echo "     Repository Settings → Repository variables"
echo "     (See $ENV_VARS_FILE for the list of variables)"
echo ""
echo "  3. Commit and push the changes:"
echo "     git add bitbucket-pipelines.yml .gitignore"
echo "     git commit -m 'Add Claude Code pipeline configuration'"
echo "     git push"
echo ""

if [[ "$setup_mode" == "1" ]] || [[ "$enable_mentions" =~ ^[Yy]$ ]]; then
    echo "  4. Create a PR and mention '${TRIGGER_PHRASE:-@claude}' to test!"
else
    echo "  4. Create a PR to trigger Claude!"
fi

echo ""
print_warning "Important: Make sure to set repository variables as SECURED!"
echo ""

# Ask if user wants to see the environment variables
read -p "Would you like to see the required environment variables now? (y/n): " show_env
if [[ "$show_env" =~ ^[Yy]$ ]]; then
    echo ""
    cat "$ENV_VARS_FILE"
fi

echo ""
print_success "Happy coding with Claude! 🤖"