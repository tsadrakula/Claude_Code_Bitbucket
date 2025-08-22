import chalk from "chalk";

export class Logger {
  private verbose: boolean;

  constructor() {
    this.verbose = process.env.VERBOSE === "true";
  }

  info(...args: any[]): void {
    console.log(chalk.blue("ℹ"), ...args);
  }

  success(...args: any[]): void {
    console.log(chalk.green("✓"), ...args);
  }

  warning(...args: any[]): void {
    console.log(chalk.yellow("⚠"), ...args);
  }

  error(...args: any[]): void {
    console.error(chalk.red("✗"), ...args);
  }

  debug(...args: any[]): void {
    if (this.verbose) {
      console.log(chalk.gray("🔍"), ...args);
    }
  }

  group(title: string): void {
    console.log(chalk.bold.cyan(`\n▶ ${title}`));
  }

  groupEnd(): void {
    // No-op for now, but could add visual separation
  }

  table(data: any): void {
    console.table(data);
  }

  json(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

export const logger = new Logger();