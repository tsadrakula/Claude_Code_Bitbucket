#!/usr/bin/env bun
import { execa } from "execa";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log(chalk.bold.cyan("\n🚀 Bitbucket Claude Code Setup\n"));
  
  try {
    // Step 1: Check for Claude Code CLI
    console.log(chalk.yellow("Step 1: Checking Claude Code CLI installation..."));
    
    try {
      await execa("npx", ["claude-code", "--version"]);
      console.log(chalk.green("✓ Claude Code CLI is available"));
    } catch {
      console.log(chalk.blue("Installing Claude Code CLI..."));
      await execa("npm", ["install", "-g", "claude-code"], { stdio: "inherit" });
      console.log(chalk.green("✓ Claude Code CLI installed"));
    }
    
    // Step 2: Configure Bitbucket credentials
    console.log(chalk.yellow("\nStep 2: Configure Bitbucket Access"));
    
    const workspace = await question("Enter your Bitbucket workspace slug: ");
    const username = await question("Enter your Bitbucket username: ");
    
    console.log(chalk.blue("\nTo create an app password:"));
    console.log("1. Go to https://bitbucket.org/account/settings/app-passwords/");
    console.log("2. Click 'Create app password'");
    console.log("3. Label it 'Claude Code'");
    console.log("4. Select these permissions:");
    console.log("   - Account: Read");
    console.log("   - Repositories: Read, Write");
    console.log("   - Pull requests: Read, Write");
    console.log("   - Pipelines: Read, Write");
    console.log("5. Click 'Create' and copy the password\n");
    
    const appPassword = await question("Enter your Bitbucket app password: ");
    
    // Step 3: Configure Anthropic API
    console.log(chalk.yellow("\nStep 3: Configure Claude API"));
    
    const apiChoice = await question(
      "Choose API provider:\n1. Anthropic (recommended)\n2. AWS Bedrock\n3. Google Vertex AI\nEnter choice (1-3): "
    );
    
    let apiConfig: any = {};
    
    if (apiChoice === "1") {
      console.log(chalk.blue("\nGet your API key from: https://console.anthropic.com/api-keys"));
      apiConfig.provider = "anthropic";
      apiConfig.anthropicApiKey = await question("Enter your Anthropic API key: ");
    } else if (apiChoice === "2") {
      apiConfig.provider = "bedrock";
      apiConfig.awsAccessKeyId = await question("Enter AWS Access Key ID: ");
      apiConfig.awsSecretAccessKey = await question("Enter AWS Secret Access Key: ");
      apiConfig.awsRegion = await question("Enter AWS Region (default: us-east-1): ") || "us-east-1";
    } else if (apiChoice === "3") {
      apiConfig.provider = "vertex";
      apiConfig.gcpProjectId = await question("Enter GCP Project ID: ");
      apiConfig.gcpRegion = await question("Enter GCP Region (default: us-central1): ") || "us-central1";
      apiConfig.gcpKeyPath = await question("Enter path to service account JSON key: ");
    }
    
    // Step 4: Save configuration
    console.log(chalk.yellow("\nStep 4: Saving configuration..."));
    
    const configDir = join(homedir(), ".claude-bitbucket");
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }
    
    const config = {
      bitbucket: {
        workspace,
        username,
        appPassword: Buffer.from(appPassword).toString("base64"), // Basic encoding
      },
      api: apiConfig,
      preferences: {
        model: "sonnet",
        maxTurns: 30,
        timeoutMinutes: 10,
      },
    };
    
    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify(config, null, 2)
    );
    
    console.log(chalk.green("✓ Configuration saved to ~/.claude-bitbucket/config.json"));
    
    // Step 5: Create pipeline template
    console.log(chalk.yellow("\nStep 5: Creating pipeline template..."));
    
    const pipelineTemplate = `# Add this to your bitbucket-pipelines.yml

pipelines:
  pull-requests:
    '**':
      - step:
          name: Claude Code Review
          script:
            - pipe: claudecode/bitbucket-pipe:latest
              variables:
                MODE: review
                ANTHROPIC_API_KEY: \${ANTHROPIC_API_KEY}
                BITBUCKET_ACCESS_TOKEN: \${BITBUCKET_ACCESS_TOKEN}

  custom:
    claude-assist:
      - step:
          name: Claude Assistant
          script:
            - pipe: claudecode/bitbucket-pipe:latest
              variables:
                MODE: tag
                TRIGGER_PHRASE: "@claude"
                ANTHROPIC_API_KEY: \${ANTHROPIC_API_KEY}
                BITBUCKET_ACCESS_TOKEN: \${BITBUCKET_ACCESS_TOKEN}
`;
    
    await writeFile("bitbucket-pipelines-claude.yml", pipelineTemplate);
    console.log(chalk.green("✓ Pipeline template created: bitbucket-pipelines-claude.yml"));
    
    // Step 6: Setup repository variables
    console.log(chalk.yellow("\nStep 6: Next steps"));
    console.log(chalk.blue("\nTo complete setup in your Bitbucket repository:"));
    console.log("1. Go to Repository Settings → Repository variables");
    console.log("2. Add these variables:");
    
    if (apiConfig.provider === "anthropic") {
      console.log(`   - ANTHROPIC_API_KEY = ${apiConfig.anthropicApiKey.substring(0, 10)}...`);
    }
    console.log(`   - BITBUCKET_ACCESS_TOKEN = ${appPassword.substring(0, 10)}...`);
    
    console.log("\n3. Copy the pipeline configuration from bitbucket-pipelines-claude.yml");
    console.log("4. Add it to your bitbucket-pipelines.yml");
    console.log("5. Enable Pipelines in Repository Settings → Pipelines → Settings");
    
    console.log(chalk.green.bold("\n✅ Setup complete!"));
    console.log(chalk.cyan("\nYou can now use Claude Code in your Bitbucket pipelines!"));
    console.log(chalk.gray("For more information, see: https://github.com/your-org/claude-bitbucket-pipe"));
    
  } catch (error) {
    console.error(chalk.red("\n❌ Setup failed:"), error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (import.meta.main) {
  main();
}