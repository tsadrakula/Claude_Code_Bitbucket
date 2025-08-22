#!/usr/bin/env bun
import { updateComment } from "../bitbucket/comment";
import { readFile } from "fs/promises";
import { logger } from "../utils/logger";

async function main() {
  try {
    const commentId = process.argv[2];
    const contentFile = process.argv[3];
    const status = (process.argv[4] || "success") as "success" | "error" | "timeout";
    
    if (!commentId || !contentFile) {
      throw new Error("Usage: update-comment <commentId> <contentFile> [status]");
    }
    
    logger.info(`Updating comment ${commentId} with status: ${status}`);
    
    const content = await readFile(contentFile, "utf-8");
    
    await updateComment({
      commentId,
      content,
      status,
    });
    
    logger.success("Comment updated successfully");
    
  } catch (error) {
    logger.error("Update comment failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}