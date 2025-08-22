#!/usr/bin/env bun
import { prepare } from "../prepare/index";
import { collectInputs } from "./collect-inputs";
import { logger } from "../utils/logger";

async function main() {
  try {
    logger.info("Running prepare entrypoint...");
    
    const config = await collectInputs();
    const result = await prepare(config);
    
    // Output result for next step
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(result.shouldRun ? 0 : 1);
  } catch (error) {
    logger.error("Prepare failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}