#!/bin/bash
set -e

# Source Bitbucket Pipelines environment
source /opt/atlassian/pipelines/agent/tmp/bashrc 2>/dev/null || true

# Export environment variables
export NODE_ENV=production
export BITBUCKET_PIPE=true

# Log pipe execution start
echo "🚀 Starting Claude Bitbucket Pipe..."
echo "Mode: ${MODE:-tag}"
echo "Model: ${MODEL:-claude-3-5-sonnet-20241022}"

# Run the TypeScript entry point with Bun
exec bun run /pipe/dist/index.js "$@"