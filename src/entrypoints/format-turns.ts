#!/usr/bin/env bun
import { formatTurns } from "../format/turns";
import { readFile } from "fs/promises";
import { logger } from "../utils/logger";

async function main() {
  try {
    const turnsFile = process.argv[2];
    if (!turnsFile) {
      throw new Error("No turns file specified");
    }
    
    logger.info(`Reading turns from: ${turnsFile}`);
    
    const content = await readFile(turnsFile, "utf-8");
    const turns = JSON.parse(content);
    
    const formatted = await formatTurns(turns);
    console.log(formatted);
    
  } catch (error) {
    logger.error("Format turns failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}