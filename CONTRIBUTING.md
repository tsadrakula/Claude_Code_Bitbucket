# Contributing to Claude Code for Bitbucket

Thank you for your interest in contributing to Claude Code for Bitbucket! This document provides guidelines and instructions for contributing to the project.

## 🤝 Code of Conduct

By participating in this project, you agree to:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.2.11
- Git
- A Bitbucket account for testing
- An API key (Anthropic, AWS, or GCP)

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR-USERNAME/Claude_Code_Bitbucket.git
   cd Claude_Code_Bitbucket
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

## 📝 Development Workflow

### Running Locally

```bash
# Run in development mode
bun run dev

# Run type checking
bun run typecheck

# Run tests
bun test

# Format code
bun run format

# Build the project
bun run build
```

### Testing Your Changes

1. **Unit Tests**: Write tests for new features
   ```bash
   bun test
   ```

2. **Integration Testing**: Test with a real Bitbucket repository
   ```bash
   export BITBUCKET_WORKSPACE=your-workspace
   export BITBUCKET_REPO_SLUG=test-repo
   bun run src/main.ts
   ```

3. **Pipeline Testing**: Test in actual Bitbucket Pipelines
   - Create a test repository
   - Add your modified pipeline configuration
   - Trigger a pipeline run

## 🏗️ Project Structure

```
claude_bitbucket/
├── src/
│   ├── main.ts           # Entry point
│   ├── modes/            # Operation modes (tag, agent, review)
│   ├── bitbucket/        # Bitbucket API integration
│   ├── pipelines/        # Pipeline-specific utilities
│   ├── claude/           # Claude Code CLI runner
│   ├── mcp/              # Model Context Protocol servers
│   ├── utils/            # Shared utilities
│   └── types/            # TypeScript type definitions
├── scripts/              # Setup and utility scripts
├── examples/             # Example configurations
└── tests/                # Test files
```

## 🎯 Areas for Contribution

### High Priority

- [ ] Improve error handling and recovery
- [ ] Add more comprehensive test coverage
- [ ] Enhance documentation with more examples
- [ ] Add support for more Bitbucket events
- [ ] Optimize performance for large repositories

### Feature Ideas

- [ ] Support for multiple models simultaneously
- [ ] Custom tool development framework
- [ ] Integration with other Bitbucket features
- [ ] Advanced caching strategies
- [ ] Metrics and monitoring

### Documentation

- [ ] Add more real-world examples
- [ ] Create video tutorials
- [ ] Translate documentation
- [ ] Improve troubleshooting guides

## 📊 Coding Standards

### TypeScript

- Use strict TypeScript settings
- Define types for all function parameters
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes

### Code Style

```typescript
// Good
export interface PipeConfig {
  workspace: string;
  repoSlug: string;
  mode: "tag" | "agent" | "experimental-review";
}

// Bad
export interface PipeConfig {
  workspace: any
  repoSlug: any
  mode: string
}
```

### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Maintenance tasks

Examples:
```
feat: add support for custom trigger phrases
fix: handle authentication errors gracefully
docs: update setup instructions for AWS Bedrock
```

## 🔄 Pull Request Process

1. **Before submitting**:
   - Ensure all tests pass
   - Update documentation if needed
   - Add tests for new features
   - Run formatter: `bun run format`

2. **PR Description**:
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Tested in Bitbucket Pipelines
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] Tests added/updated
   ```

3. **Review Process**:
   - PRs require at least one review
   - Address all feedback constructively
   - Keep PRs focused and small when possible

## 🐛 Reporting Issues

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Bun version, OS, etc.)
- Relevant logs or error messages

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions considered
- Impact on existing functionality

## 📚 Resources

### Documentation
- [Bitbucket API Documentation](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Claude Documentation](https://docs.anthropic.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Bun Documentation](https://bun.sh/docs)

### Community
- [GitHub Issues](https://github.com/tsadrakula/Claude_Code_Bitbucket/issues)
- [GitHub Discussions](https://github.com/tsadrakula/Claude_Code_Bitbucket/discussions)

## 🙏 Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Special thanks section

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Claude Code for Bitbucket! Your efforts help make AI-assisted development accessible to more teams. 🚀