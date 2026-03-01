import * as fs from 'fs';
import { EnConvoResponse } from './enconvo-client';
import { IMAGE_EXTS } from '../utils/file-types';

export interface DelegationDirective {
  targetAgentId: string;
  message: string;
}

export interface ParsedResponse {
  text: string;
  filePaths: string[];
  delegations: DelegationDirective[];
}

const ALL_FILE_EXTENSIONS = new Set([
  ...IMAGE_EXTS,
  '.txt', '.pdf', '.doc', '.docx', '.csv', '.json', '.xml',
  '.mp3', '.mp4', '.wav', '.mov', '.zip', '.tar', '.gz',
]);

function hasKnownExtension(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return ALL_FILE_EXTENSIONS.has(ext);
}

// Extract absolute file paths from any string
function extractAbsolutePaths(text: string): string[] {
  const paths: string[] = [];
  // Match absolute paths with file extensions
  const regex = /(\/[\w .~\-/]+\.[\w]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const p = match[1];
    if (hasKnownExtension(p) && fs.existsSync(p)) {
      paths.push(p);
    }
  }
  return paths;
}

function extractDeliverableFiles(flowParams: string): string[] {
  try {
    const params = JSON.parse(flowParams);
    if (!Array.isArray(params.deliverables)) return [];
    return params.deliverables
      .filter((d: any) => d.type === 'file' && d.url && fs.existsSync(d.url))
      .map((d: any) => d.url as string);
  } catch {
    return [];
  }
}

/**
 * Detect @agent mentions in response text against a known roster.
 * Matches both agent IDs (e.g. @elena) and bot handles (e.g. @Enconvo_Elena_Content_Dept_bot).
 * handleMap maps lowercase bot handles to agent IDs for resolution.
 */
export function detectDelegations(
  text: string,
  rosterIds?: string[],
  handleMap?: Record<string, string>,
): DelegationDirective[] {
  if (!rosterIds || rosterIds.length === 0) return [];

  const delegations: DelegationDirective[] = [];

  // Build combined patterns: agent IDs + bot handles
  const allPatterns = [...rosterIds];
  const handleToId: Record<string, string> = {};
  if (handleMap) {
    for (const [handle, agentId] of Object.entries(handleMap)) {
      // Strip leading @ from handle for matching
      const clean = handle.replace(/^@/, '');
      allPatterns.push(clean);
      handleToId[clean.toLowerCase()] = agentId;
    }
  }

  const pattern = new RegExp(`(?:@|→\\s*)(?:@)?(${allPatterns.join('|')})\\b`, 'gi');
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const matched = match[1].toLowerCase();
    // Resolve to agent ID (either direct match or via handle map)
    const targetId = handleToId[matched] ?? matched;

    // Skip self-mentions or unknown IDs
    if (!rosterIds.includes(targetId)) continue;

    // Use remaining text after the mention as delegation context
    const afterMention = text.slice(match.index + match[0].length).trim();
    // Take the sentence or up to 200 chars as the delegation message
    const sentenceEnd = afterMention.search(/[.!?\n]/);
    const message = sentenceEnd > 0 ? afterMention.slice(0, sentenceEnd + 1).trim() : afterMention.slice(0, 200).trim();
    if (message && !delegations.find(d => d.targetAgentId === targetId)) {
      delegations.push({ targetAgentId: targetId, message });
    }
  }
  return delegations;
}

export function parseResponse(
  response: EnConvoResponse,
  rosterIds?: string[],
  handleMap?: Record<string, string>,
): ParsedResponse {
  const textParts: string[] = [];
  const filePaths: string[] = [];

  // Handle simple { "result": "..." } format (e.g. Translator)
  if (response.result) {
    return { text: response.result, filePaths: [], delegations: [] };
  }

  if (!response.messages) {
    return { text: '', filePaths: [], delegations: [] };
  }

  for (const msg of response.messages) {
    if (msg.role !== 'assistant') continue;

    for (const item of msg.content) {
      if (item.type === 'text' && item.text) {
        textParts.push(item.text);
        filePaths.push(...extractAbsolutePaths(item.text));
      }

      if (item.type === 'flow_step' && item.flowParams) {
        // Deliverable tool has structured file references
        if (item.flowName === 'Deliverable') {
          filePaths.push(...extractDeliverableFiles(item.flowParams));
        }
        // Also scan any flow_step params for file paths (e.g. file_system--read_file)
        filePaths.push(...extractAbsolutePaths(item.flowParams));
      }
    }
  }

  const fullText = textParts.join('\n\n');
  const delegations = detectDelegations(fullText, rosterIds, handleMap);

  return {
    text: fullText,
    filePaths: [...new Set(filePaths)],
    delegations,
  };
}
