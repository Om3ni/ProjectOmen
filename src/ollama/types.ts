// Core Ollama types for RPR system integration

export type OllamaFreedomLevel = 'conservative' | 'balanced' | 'autonomous';

export interface OllamaSettings {
  enabled: boolean;
  useBundled: boolean;
  freedomLevel: OllamaFreedomLevel;
  endpoint: string;
  model: string;
  temperature: number;
  contextSize: number; // Desired num_ctx sent to Ollama (may differ from model's reported default)
}

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = {
  enabled: false,
  useBundled: true,
  freedomLevel: 'balanced',
  endpoint: 'http://localhost:11434',
  model: 'llama3.2:latest',
  temperature: 0.7,
  contextSize: 8192,
};

// Ollama function calling types
export interface OllamaFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface OllamaFunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaFunctionCall[];
  tool_call_id?: string;
  tool_name?: string;     // Native /api/chat tool response correlation
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  error?: string;
}

// Function execution types
export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export type FunctionHandler = (args: Record<string, any>, context: OllamaContext) => Promise<FunctionResult>;

export interface RegisteredFunction {
  definition: OllamaFunction;
  handler: FunctionHandler;
  category: FunctionCategory;
  requiresApproval: boolean;
}

export type FunctionCategory =
  | 'query'           // Read-only, always allowed
  | 'character'       // Modify player character
  | 'schema'          // Edit RPR system
  | 'combat';         // Combat actions

// Context passed to Ollama agent and (future) cloud LLM function handlers
export interface OllamaContext {
  editorState: any;  // ReturnType<typeof useEditorState>
  combatExecution?: any;  // ReturnType<typeof useCombatExecution>
  trainingDummies?: any;  // ReturnType<typeof useTrainingDummies>
  chatState: any;  // ReturnType<typeof useChatState>
  settings: any;  // Settings type
  recentChangesHandler?: (change: RecentChangeInput) => string;  // Track changes for UI display
  /** Callback to update editor data through React state - triggers UI re-render */
  updateEditorData?: (nextData: Record<string, unknown>) => void;
  // Cloud LLM fields — used by function handlers in functions/ directory.
  // Not wired up for local Ollama (chat-only), but needed for compilation.
  approvalHandler?: (request: ApprovalRequest) => Promise<ApprovalResponse>;
  updateCharacterState?: (update: CharacterStateUpdate) => void;
}

/** Describes a character sheet state mutation — dispatched to React setters in CharacterSheetModal */
export interface CharacterStateUpdate {
  type: 'allocateStat' | 'selectPerk' | 'deselectPerk' | 'setStatCurrent' | 'toggleStatus';
  statId?: number;
  perkId?: number;
  statusId?: number;
  value?: number;
  points?: number;
  active?: boolean;
}

// Input for tracking a recent change
export interface RecentChangeInput {
  type: 'create' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  previousData?: Record<string, unknown>; // For undo
  description: string;
}

// AI Character storage
export interface AiCharacter {
  id: string;
  name: string;
  level: number;
  role: string;  // "tank", "healer", "dps", "balanced"
  allocations: [number, number][];  // [skillId, amount]
  chosenPerks: number[];
  activeStatuses: number[];
  statCurrentValues: [number, number][];  // [statId, currentValue]
  createdAt: number;
  lastUsed: number;
}

// Command handler type
export type CommandHandler = (
  content: string,
  context: OllamaContext
) => Promise<boolean>;

// Documentation search result
export interface DocumentationResult {
  file: string;
  section: string;
  content: string;
  relevance: number;
}

// Approval dialog props
export interface ApprovalRequest {
  functionName: string;
  description: string;
  args: Record<string, any>;
  impact: 'low' | 'medium' | 'high';
}

export interface ApprovalResponse {
  approved: boolean;
  rememberChoice?: boolean;
}
