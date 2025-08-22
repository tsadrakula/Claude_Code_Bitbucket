import type { ConversationTurn } from "../types/config";
import { logger } from "../utils/logger";

export async function formatTurns(turns: ConversationTurn[]): Promise<string> {
  if (turns.length === 0) {
    return "*No conversation turns recorded*";
  }

  logger.info(`Formatting ${turns.length} conversation turns`);

  const formatted = turns.map((turn, index) => {
    const header = turn.role === "user" ? "👤 **User**" : "🤖 **Claude**";
    const timestamp = new Date(turn.timestamp).toLocaleTimeString();
    
    let content = turn.content;
    
    // Format tool uses if present
    if (turn.tools && turn.tools.length > 0) {
      const toolsSection = formatTools(turn.tools);
      content = `${content}\n\n${toolsSection}`;
    }
    
    // Escape code blocks properly for Bitbucket markdown
    content = escapeCodeBlocks(content);
    
    return `
### Turn ${index + 1} - ${header} (${timestamp})

${content}
`;
  }).join("\n---\n");

  return formatted;
}

function formatTools(tools: any[]): string {
  const toolSections = tools.map(tool => {
    let output = `**Tool:** \`${tool.name}\`\n`;
    
    if (tool.input) {
      output += `**Input:**\n\`\`\`json\n${JSON.stringify(tool.input, null, 2)}\n\`\`\`\n`;
    }
    
    if (tool.output) {
      output += `**Output:**\n\`\`\`\n${
        typeof tool.output === "string" 
          ? tool.output 
          : JSON.stringify(tool.output, null, 2)
      }\n\`\`\``;
    }
    
    return output;
  });
  
  return `<details>
<summary>🔧 Tools Used (${tools.length})</summary>

${toolSections.join("\n\n")}
</details>`;
}

function escapeCodeBlocks(content: string): string {
  // Bitbucket uses slightly different markdown parsing
  // Ensure code blocks are properly formatted
  return content
    .replace(/```(\w*)\n/g, '```$1\n')
    .replace(/\n```/g, '\n```');
}