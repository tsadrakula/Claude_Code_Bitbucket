/**
 * Utility to classify user requests as actionable or informational
 * This helps determine whether Claude should edit files or just provide information
 */

export type RequestType = "actionable" | "informational";

/**
 * Patterns that indicate an actionable request requiring code changes
 */
const ACTIONABLE_PATTERNS = [
  // Direct action verbs
  /\b(change|update|fix|add|remove|delete|modify|replace|rename|move|create|implement|refactor|optimize|improve|enhance|correct|adjust|alter|revise|edit|write|make|set|turn|switch|convert|transform|migrate)\b/i,
  
  // Polite requests with action intent
  /\b(could you|can you|please|would you|will you|help me|i need you to|i want you to)\s+\w*\s*(change|update|fix|add|remove|delete|modify|replace|rename|move|create|implement|refactor|optimize|improve|enhance|correct|adjust|alter|revise|edit|write|make|set|turn|switch|convert|transform|migrate)/i,
  
  // Imperative forms
  /^(change|update|fix|add|remove|delete|modify|replace|rename|move|create|implement|refactor|optimize|improve|enhance|correct|adjust|alter|revise|edit|write|make|set|turn|switch|convert|transform|migrate)\s+/i,
  
  // Color/style changes (common in UI work)
  /\b(darker|lighter|bigger|smaller|larger|wider|narrower|thicker|thinner)\s+(shade|color|size|width|height|margin|padding)/i,
  /\bto\s+(a\s+)?(darker|lighter|different|another|new)\s+(shade|color|style|theme)/i,
  
  // Bug/issue indicators
  /\b(bug|issue|problem|error|broken|wrong|incorrect|failing|not working|doesn't work|isn't working)\b.*\b(fix|solve|resolve|correct)/i,
  
  // Feature requests
  /\b(add|implement|create)\s+(a\s+)?(new\s+)?(feature|functionality|capability|option|setting|button|component|page|endpoint|api|method|function)/i,
];

/**
 * Patterns that indicate an informational request
 */
const INFORMATIONAL_PATTERNS = [
  // Question words without action verbs
  /^(what|where|when|why|how|which|who|whose)\s+(?!.*(change|update|fix|add|remove|delete|modify|replace|create|implement))/i,
  
  // Explanation requests
  /\b(explain|describe|tell me about|what does|how does|show me how|walk me through|guide me|teach me)\b/i,
  
  // Analysis requests without modification
  /\b(analyze|review|check|inspect|look at|examine|evaluate|assess)\b(?!.*(and\s+(fix|change|update|modify)))/i,
  
  // Documentation requests
  /\b(document|documentation|docs|readme|comments?|explanation)\b(?!.*(update|add|write|create))/i,
  
  // Understanding requests
  /\b(understand|clarify|meaning of|purpose of|reason for)\b/i,
];

/**
 * Classify a user request as actionable or informational
 * @param text The user's request text
 * @returns "actionable" if the request requires code changes, "informational" otherwise
 */
export function classifyRequest(text: string): RequestType {
  // Normalize the text
  const normalizedText = text.trim();
  
  // Empty or very short requests are typically informational
  if (normalizedText.length < 10) {
    return "informational";
  }
  
  // Check for explicit informational patterns first (they're more specific)
  for (const pattern of INFORMATIONAL_PATTERNS) {
    if (pattern.test(normalizedText)) {
      // Double-check it's not actually actionable
      const hasActionableWords = ACTIONABLE_PATTERNS.some(p => p.test(normalizedText));
      if (!hasActionableWords) {
        return "informational";
      }
    }
  }
  
  // Check for actionable patterns
  for (const pattern of ACTIONABLE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return "actionable";
    }
  }
  
  // Default to informational for safety (read-only is safer)
  return "informational";
}

/**
 * Extract the specific action from an actionable request
 * @param text The user's request text
 * @returns The primary action verb if found, null otherwise
 */
export function extractAction(text: string): string | null {
  const actionVerbs = [
    "change", "update", "fix", "add", "remove", "delete", "modify", 
    "replace", "rename", "move", "create", "implement", "refactor",
    "optimize", "improve", "enhance", "correct", "adjust", "alter",
    "revise", "edit", "write", "make", "set", "turn", "switch",
    "convert", "transform", "migrate"
  ];
  
  const normalizedText = text.toLowerCase();
  
  for (const verb of actionVerbs) {
    if (normalizedText.includes(verb)) {
      return verb;
    }
  }
  
  return null;
}

/**
 * Determine confidence level for the classification
 * @param text The user's request text
 * @returns Confidence level between 0 and 1
 */
export function getClassificationConfidence(text: string): number {
  const normalizedText = text.trim();
  
  // Count matches for each type
  let actionableMatches = 0;
  let informationalMatches = 0;
  
  for (const pattern of ACTIONABLE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      actionableMatches++;
    }
  }
  
  for (const pattern of INFORMATIONAL_PATTERNS) {
    if (pattern.test(normalizedText)) {
      informationalMatches++;
    }
  }
  
  // Calculate confidence based on the difference
  const totalMatches = actionableMatches + informationalMatches;
  if (totalMatches === 0) {
    return 0.5; // No clear signal
  }
  
  const dominantMatches = Math.max(actionableMatches, informationalMatches);
  return dominantMatches / totalMatches;
}