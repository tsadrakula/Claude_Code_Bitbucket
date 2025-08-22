FROM oven/bun:1.2.11-alpine

# Install required system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    jq \
    python3 \
    py3-pip \
    docker-cli \
    openssh-client \
    nodejs \
    npm

# Install Claude Code CLI globally
RUN npm install -g claude-code

# Set working directory
WORKDIR /pipe

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src
COPY pipe.sh ./

# Build TypeScript
RUN bun run build

# Make entrypoint executable
RUN chmod +x pipe.sh

# Set entrypoint
ENTRYPOINT ["/pipe/pipe.sh"]