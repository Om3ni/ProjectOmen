import type { OllamaMessage, OllamaContext, OllamaSettings } from './types';
import { getOllamaClient, type OllamaModelInfo, type OllamaVramInfo } from './utils/ollamaClient';
import { SYSTEM_WIZARD_PROMPT, shouldStartWizard } from './utils/systemWizard';
import { filterContent, emergencyStop } from './utils/contentFilter';
import { detectRawRprOutput, OUTPUT_REJECTION_MESSAGE } from './utils/outputGate';
import type { Conversation } from './utils/conversationManager';
import { saveConversation } from './utils/conversationManager';
import { loadRPRContext, generateContextSummary } from './utils/contextLoader';
import { readBaseline, readMemory } from './functions/fileSystemFunctions';
import { readRefinements } from './functions/refinementFunctions';
import { documentationLoader } from './utils/documentationLoader';
import { PromptLoader } from './utils/promptLoader';
import { PromptBuilder, buildSelectedRecordContext } from './utils/PromptBuilder';
import { selectAddenda, type AddendaTab } from './utils/addendaPolicy';

/**
 * Ollama Agent — streaming chat client for local LLM.
 *
 * The local model handles "soft skills": explanations, brainstorming,
 * descriptions, flavor text, and RPR knowledge Q&A. Tool calling
 * (schema mutations, character sheet changes) is reserved for a
 * future cloud LLM API integration.
 */

export interface AgentOptions {
  settings: OllamaSettings;
  context: OllamaContext;
  systemPrompt?: string;
  conversationId?: string; // If provided, agent will save conversation history
}

export interface AgentResponse {
  content: string;
  contextUsage?: ContextUsage;
}

export interface ContextUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  contextWindow: number;
  percentUsed: number;
}

export class OllamaAgent {
  private settings: OllamaSettings;
  private context: OllamaContext;
  private conversationHistory: OllamaMessage[] = [];
  private systemPrompt: string;
  private wizardMode: boolean = false;
  private conversationId?: string; // For persistent conversations
  private contextLoaded: boolean = false; // Track if we've loaded RPR examples
  private fullContextLoaded: boolean = false; // Track if full (non-lite) bootstrap ran
  private modelInfo: OllamaModelInfo | null = null;
  private vramInfo: OllamaVramInfo | null = null;
  private lastPromptTokens: number = 0;
  private lastCompletionTokens: number = 0;
  private abortController: AbortController | null = null;
  private conversationCreatedAt: string; // Stable creation timestamp
  private userMessageCount: number = 0; // For incremental summarization
  private promptLoader: PromptLoader = new PromptLoader();
  private promptBuilder: PromptBuilder = new PromptBuilder(this.promptLoader);
  private currentAddenda: AddendaTab[] = [];
  private lastSelectedId: string | undefined = undefined;
  private lastEditorSummary: string = ''; // Cached to avoid redundant loadRPRContext calls

  constructor(options: AgentOptions) {
    this.settings = options.settings;
    this.context = options.context;
    this.conversationId = options.conversationId;
    this.conversationCreatedAt = new Date().toISOString();

    // Check if we should start in wizard mode
    const editorData = options.context.editorState?.data;
    this.wizardMode = shouldStartWizard(editorData);

    // Use wizard prompt if empty system, otherwise minimal prompt (full prompt built in bootstrap)
    this.systemPrompt = this.wizardMode
      ? SYSTEM_WIZARD_PROMPT
      : (options.systemPrompt || this.getMinimalSystemPrompt());

    // Initialize with system message
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });

    if (this.wizardMode) {
      console.log('[Sigil] Starting in Wizard Mode - empty system detected');
    }

    if (this.conversationId) {
      console.log(`[Ollama] Agent initialized with conversation: ${this.conversationId}`);
    }

    // Pre-warm the model so it loads into VRAM while the user types
    this.prewarmModel();
  }

  /**
   * Send a lightweight request to Ollama so the model loads into VRAM
   * before the user's first real message. Uses the real num_ctx so the
   * KV cache is pre-allocated — avoids a costly reload on first message.
   * Runs in background, errors are ignored.
   */
  private prewarmModel(): void {
    // Skip — the app-level prewarm in main.tsx already handles this with
    // the correct context size. A duplicate prewarm would just waste time.
    // If main.tsx prewarm didn't fire (e.g. settings changed), the model
    // will load on first real request.
  }

  /**
   * Bootstrap Sigil with training docs, memory, and refinements.
   * Called once on first sendMessage. Instead of telling Sigil to call
   * readMemory()/readRefinements() (which wastes LLM turns and often fails),
   * we execute them directly and inject results into conversation history.
   *
   * All bootstrap content goes into a SINGLE system message to avoid
   * instruction conflicts from multiple system messages.
   */
  private async bootstrap(firstMessage?: string): Promise<void> {
    if (this.contextLoaded) return;
    this.contextLoaded = true;

    // Detect if first message is purely conversational (no RPR context needed)
    const isConversational = firstMessage
      ? !(/\b(show|list|what|how|explain|create|make|build|add|update|modify|delete|stat|skill|perk|ability|status|rune|dice|system|attribute|describe|tell|look|check|find|search|get|info|details|overview|structure|config|mutator|memory|refinement|docs?|file|read|guidance)\b/i.test(firstMessage))
      : false;

    // For purely conversational messages ("hi", "hey", "what's up"), skip ALL heavy context.
    // The system prompt already has personality + RPR overview. Heavy context drowns personality
    // and causes the model to respond robotically.
    if (isConversational) {
      console.log('[Sigil] Lite bootstrap — conversational first message, skipping heavy context');
      // Only load Tier B memory (user preferences affect personality)
      try {
        const memoryResult = await readMemory({}, this.context);
        if (memoryResult?.success && memoryResult.data) {
          const content = typeof memoryResult.data === 'string'
            ? memoryResult.data
            : memoryResult.data.content;
          if (content && content !== null) {
            this.conversationHistory.splice(1, 0, {
              role: 'system',
              content: `## Your Persistent Memory\n\n${content}`,
            });
            console.log(`[Sigil] ✅ Tier B memory loaded (${String(content).length} chars)`);
          }
        }
      } catch {
        // Fine — personality works without memory
      }
      console.log(`[Sigil] Lite bootstrap complete — ${this.conversationHistory.length} messages in history`);
      return;
    }

    await this.loadFullContext();
  }

  /**
   * Load full RPR context, docs, baseline, memory, refinements.
   * Called during full bootstrap or when upgrading from lite bootstrap.
   */
  private async loadFullContext(): Promise<void> {
    if (this.fullContextLoaded) return;
    this.fullContextLoaded = true;

    console.log('[Sigil] Full bootstrap — loading context, training docs, memory...');

    const contextParts: string[] = [];

    // 1. Load RPR context (system guide + editor data summary)
    try {
      const editorData = this.context.editorState?.data;
      const rprContext = await loadRPRContext(editorData);
      if (rprContext) {
        const editorSummary = generateContextSummary(rprContext);
        this.lastEditorSummary = editorSummary; // Cache for updateAddendaIfNeeded
        contextParts.push(editorSummary);
        console.log('[Sigil] ✅ RPR context loaded from editor data');
        if (editorData) {
          const safeLen = (t: string) => (Array.isArray(editorData[t]) ? editorData[t].length : 0);
          console.log(`[Sigil]    ${safeLen('SkillDef')} SkillDef, ${safeLen('SpellDef')} SpellDef, ${safeLen('PerkDef')} PerkDef, ${safeLen('Stat')} Stat`);
        }

        // Rebuild system prompt from files + editor summary
        this.currentAddenda = selectAddenda(
          this.context.editorState?.activeCategory,
          '' // No user message at bootstrap time
        );
        const builtPrompt = await this.buildSystemPrompt(editorSummary);
        this.systemPrompt = builtPrompt;
        this.conversationHistory[0] = {
          role: 'system',
          content: builtPrompt,
        };
      }
    } catch (error) {
      console.error('[Sigil] ❌ Failed to load RPR context:', error);
    }

    // 2. Load doc index (for reference — Sigil can describe what docs cover)
    try {
      const docs = await documentationLoader.loadAll();
      if (docs.length > 0) {
        const docIndex = docs.map(d => `- **${d.name}**: ${this.getDocSummary(d.name)}`).join('\n');
        contextParts.push(`## Available Documentation

You have knowledge of these reference documents:

${docIndex}`);
        console.log(`[Sigil] ✅ Doc index loaded (${docs.length} files indexed)`);
      }
    } catch (error) {
      console.warn('[Sigil] ⚠️ Could not load doc index:', error);
    }

    // 3. Load Tier A baseline (shipped, read-only product contract)
    try {
      const baselineResult = await readBaseline({}, this.context);
      if (baselineResult?.success && baselineResult.data) {
        const content = typeof baselineResult.data === 'string'
          ? baselineResult.data
          : baselineResult.data.content;
        if (content) {
          contextParts.push(`## Baseline Contract (Tier A — immutable)\n\n${content}`);
          console.log(`[Sigil] ✅ Tier A baseline loaded (${String(content).length} chars)`);
        }
      }
    } catch (error) {
      console.warn('[Sigil] ⚠️ Could not load Tier A baseline:', error);
    }

    // 4. Load Tier B memory (per-user, mutable)
    try {
      const memoryResult = await readMemory({}, this.context);
      if (memoryResult?.success && memoryResult.data) {
        const content = typeof memoryResult.data === 'string'
          ? memoryResult.data
          : memoryResult.data.content;
        if (content && content !== null) {
          contextParts.push(`## Your Persistent Memory — Tier B (from sigil-memory.md)\n\nApply all of this to your behavior:\n\n${content}`);
          console.log(`[Sigil] ✅ Tier B memory loaded (${String(content).length} chars)`);
        } else {
          console.log('[Sigil] No Tier B memory file exists yet');
        }
      }
    } catch (error) {
      console.warn('[Sigil] ⚠️ Could not load Tier B memory:', error);
    }

    // 5. Load refinements
    try {
      const refResult = await readRefinements({}, this.context);
      if (refResult?.success && refResult.data) {
        const content = typeof refResult.data === 'string' ? refResult.data : '';
        if (content && !content.includes('No refinements file found')) {
          contextParts.push(`## Your Refinements & Corrections\n\nApply ALL of these corrections to your behavior:\n\n${content}`);
          console.log(`[Sigil] ✅ Refinements loaded (${content.length} chars)`);
        }
      }
    } catch (error) {
      console.warn('[Sigil] ⚠️ Could not load refinements:', error);
    }

    // Inject all bootstrap content as ONE system message after the main system prompt
    if (contextParts.length > 0) {
      this.conversationHistory.splice(1, 0, {
        role: 'system',
        content: contextParts.join('\n\n---\n\n'),
      });
    }

    console.log(`[Sigil] Bootstrap complete — ${this.conversationHistory.length} messages in history`);
  }

  /**
   * If the initial bootstrap was lite (conversational first message) but the
   * current message is about RPR topics, upgrade by loading full context now.
   */
  private async upgradeBootstrapIfNeeded(userMessage: string): Promise<void> {
    if (this.fullContextLoaded) return; // Already loaded
    if (!this.contextLoaded) return; // bootstrap() hasn't run yet — it will handle it

    const needsContext = /\b(show|list|what|how|explain|create|make|build|add|update|modify|delete|stat|skill|perk|ability|status|rune|dice|system|attribute|describe|tell|look|check|find|search|get|info|details|overview|structure|config|mutator|memory|refinement|docs?|file|read|guidance|race|class|spell|feat|scratch|setup|standard|go with)\b/i.test(userMessage);

    if (!needsContext) return;

    console.log('[Sigil] Upgrading from lite → full bootstrap (RPR topic detected)');
    await this.loadFullContext();
  }

  /**
   * Re-evaluate addenda selection on each message. If the needed addenda
   * have changed (user switched tabs or topics), rebuild the system prompt.
   * This is lightweight — only rebuilds if the addenda set actually changed.
   */
  private async updateAddendaIfNeeded(userMessage: string): Promise<void> {
    if (!this.fullContextLoaded) return; // Not bootstrapped yet, nothing to update
    if (this.wizardMode) return; // Wizard mode uses its own prompt

    const newAddenda = selectAddenda(
      this.context.editorState?.activeCategory,
      userMessage
    );

    // Check if addenda changed
    const addendaChanged = newAddenda.length !== this.currentAddenda.length ||
      newAddenda.some((tab, i) => tab !== this.currentAddenda[i]);

    // Check if selected record changed (user clicked a different record)
    const currentSelectedId = String(
      this.context.editorState?.selected?.['ID'] ??
      this.context.editorState?.selected?.['Node ID'] ?? ''
    );
    const recordChanged = currentSelectedId !== this.lastSelectedId;

    if (!addendaChanged && !recordChanged) return;

    this.currentAddenda = newAddenda;
    this.lastSelectedId = currentSelectedId;

    // Use cached editor summary (set during loadFullContext) to avoid
    // redundant loadRPRContext calls on every message
    const builtPrompt = await this.buildSystemPrompt(this.lastEditorSummary);
    this.systemPrompt = builtPrompt;
    this.conversationHistory[0] = {
      role: 'system',
      content: builtPrompt,
    };

    if (addendaChanged) {
      console.log(`[Sigil] Addenda updated: [${newAddenda.join(', ')}]`);
    }
    if (recordChanged) {
      const name = this.context.editorState?.selected?.['Name'] ?? '(unnamed)';
      console.log(`[Sigil] Selected record updated: ID ${currentSelectedId} "${name}"`);
    }
  }

  /**
   * Heuristic: detect when the user is asking for implementation/architecture guidance.
   * This is intentionally lightweight and tool-free.
   */
  private isImplementationAsk(text: string): boolean {
    return /\b(implement|implementation|how do i|first steps?|architecture|data model|state machine|turn loop|combat loop|action economy|engine|pipeline|effect system|status system|schema|structure)\b/i.test(text);
  }

  /**
   * Insert a temporary system directive (right after the initial system messages).
   * Returns the inserted index so callers can remove it afterward.
   */
  private insertTempSystemDirective(content: string): number {
    // Find the insertion point after the leading system messages.
    let insertAt = 0;
    while (insertAt < this.conversationHistory.length && this.conversationHistory[insertAt].role === 'system') {
      insertAt++;
    }
    this.conversationHistory.splice(insertAt, 0, { role: 'system', content });
    return insertAt;
  }

  /**
   * Send a message and get a response (non-streaming).
   */
  async sendMessage(userMessage: string): Promise<AgentResponse> {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const endpoint = this.settings.useBundled ? 'http://127.0.0.1:11435' : this.settings.endpoint;
    const client = getOllamaClient(endpoint);

    // Bootstrap on first message: load training docs, memory, refinements
    if (!this.contextLoaded) {
      await this.bootstrap(userMessage);

      // Query model info (context window size, etc.) and VRAM usage
      if (!this.modelInfo) {
        try {
          this.modelInfo = await client.showModel(this.settings.model);
          const running = await client.getRunningModels();
          if (running) {
            const match = running.find(r => r.modelName === this.settings.model);
            if (match) this.vramInfo = match;
          }
          if (this.modelInfo) {
            const effectiveCtx = this.getEffectiveContextSize();
            console.log(`[Sigil] Model info: ${this.modelInfo.parameterSize}, arch_max=${this.modelInfo.maxContextWindow}, effective_ctx=${effectiveCtx}, quant=${this.modelInfo.quantization}${this.vramInfo ? `, vram=${(this.vramInfo.sizeVramBytes / 1024 / 1024 / 1024).toFixed(1)}GB` : ''}`);
          }
        } catch (e) {
          console.warn('[Sigil] Could not fetch model info:', e);
        }
      }
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });
    this.userMessageCount++;

    // Upgrade from lite → full bootstrap if this message is about RPR
    await this.upgradeBootstrapIfNeeded(userMessage);

    // Update addenda if needed based on user message and active tab
    await this.updateAddendaIfNeeded(userMessage);

    // If the user is asking for implementation guidance, force an implementation-first structure.
    const implMode = this.isImplementationAsk(userMessage);
    const tempDirectiveIndex = implMode
      ? this.insertTempSystemDirective(
          [
            'MODE: IMPLEMENTATION.',
            'Answer with concrete mechanics + system scaffolding.',
            'Do NOT start with theme/tone/setting unless asked.',
            'Use short, sectioned output (no giant blob):',
            '## Assumptions (max 3)',
            '## Core loop/state machine',
            '## Data model (types/fields)',
            '## Resolution rules',
            '## One worked example',
            'End with at most ONE clarifying question.',
          ].join('\n')
        )
      : -1;

    const numCtx = this.getEffectiveContextSize();

    const result = await client.generate({
      model: this.settings.model,
      messages: this.conversationHistory,
      temperature: this.settings.temperature,
      numCtx,
      signal,
    });

    // Remove temporary directive (if inserted)
    if (tempDirectiveIndex !== -1) {
      this.conversationHistory.splice(tempDirectiveIndex, 1);
    }

    // Track token usage
    if (result.promptEvalCount !== undefined) {
      this.lastPromptTokens = result.promptEvalCount;
    }
    if (result.evalCount !== undefined) {
      this.lastCompletionTokens = result.evalCount;
    }

    // Context budgeting: prune old messages if approaching limits
    await this.pruneIfNeeded();

    const message = result.message;
    const finalContent = message.content || '';

    this.conversationHistory.push({ role: 'assistant', content: finalContent });

    // Output gate: reject pipe-delimited / schema dumps
    const rprRejection = detectRawRprOutput(finalContent);
    if (rprRejection) {
      console.warn(`[Sigil] Output rejected: ${rprRejection}`);
      // Replace with corrective message and retry once
      this.conversationHistory.pop();
      this.conversationHistory.push({ role: 'system', content: OUTPUT_REJECTION_MESSAGE });

      const retry = await client.generate({
        model: this.settings.model,
        messages: this.conversationHistory,
        temperature: this.settings.temperature,
        numCtx,
        signal,
      });

      const retryContent = retry.message?.content || finalContent;
      this.conversationHistory.push({ role: 'assistant', content: retryContent });

      if (retry.promptEvalCount !== undefined) this.lastPromptTokens = retry.promptEvalCount;
      if (retry.evalCount !== undefined) this.lastCompletionTokens = retry.evalCount;
    }

    // Content filter
    const filterResult = filterContent(this.conversationHistory[this.conversationHistory.length - 1].content);
    if (!filterResult.allowed) {
      emergencyStop(filterResult.reason || 'Content violation detected');
    }

    // Save conversation (if persistent)
    if (this.conversationId) {
      await this.saveCurrentConversation();
    }

    const contextUsage = this.getContextUsage();
    console.log(`[Ollama] Context: ${this.lastPromptTokens}/${numCtx} tokens (${contextUsage.percentUsed}%)`);

    this.abortController = null;
    return {
      content: this.conversationHistory[this.conversationHistory.length - 1].content,
      contextUsage,
    };
  }

  /**
   * Send a message with streaming — text appears token-by-token.
   * Single round-trip, no tool calls.
   */
  async sendMessageStreaming(
    userMessage: string,
    onChunk: (text: string) => void
  ): Promise<AgentResponse> {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const endpoint = this.settings.useBundled ? 'http://127.0.0.1:11435' : this.settings.endpoint;
    const client = getOllamaClient(endpoint);

    // Bootstrap on first message
    if (!this.contextLoaded) {
      await this.bootstrap(userMessage);

      if (!this.modelInfo) {
        try {
          this.modelInfo = await client.showModel(this.settings.model);
          const running = await client.getRunningModels();
          if (running) {
            const match = running.find(r => r.modelName === this.settings.model);
            if (match) this.vramInfo = match;
          }
          if (this.modelInfo) {
            const effectiveCtx = this.getEffectiveContextSize();
            console.log(`[Sigil] Model info: ${this.modelInfo.parameterSize}, arch_max=${this.modelInfo.maxContextWindow}, effective_ctx=${effectiveCtx}, quant=${this.modelInfo.quantization}${this.vramInfo ? `, vram=${(this.vramInfo.sizeVramBytes / 1024 / 1024 / 1024).toFixed(1)}GB` : ''}`);
          }
        } catch (e) {
          console.warn('[Sigil] Could not fetch model info:', e);
        }
      }
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });
    this.userMessageCount++;

    // Upgrade from lite → full bootstrap if this message is about RPR
    await this.upgradeBootstrapIfNeeded(userMessage);

    // Update addenda if needed based on user message and active tab
    await this.updateAddendaIfNeeded(userMessage);

    // If the user is asking for implementation guidance, force an implementation-first structure.
    const implMode = this.isImplementationAsk(userMessage);
    const tempDirectiveIndex = implMode
      ? this.insertTempSystemDirective(
          [
            'MODE: IMPLEMENTATION.',
            'Answer with concrete mechanics + system scaffolding.',
            'Do NOT start with theme/tone/setting unless asked.',
            'Use short, sectioned output (no giant blob):',
            '## Assumptions (max 3)',
            '## Core loop/state machine',
            '## Data model (types/fields)',
            '## Resolution rules',
            '## One worked example',
            'End with at most ONE clarifying question.',
          ].join('\n')
        )
      : -1;

    const numCtx = this.getEffectiveContextSize();

    console.log(`[Sigil] Streaming, ${this.conversationHistory.length} messages in history`);

    // Stream the response — single round-trip
    let accumulatedContent = '';
    let chunkCount = 0;

    for await (const chunk of client.generateStream({
      model: this.settings.model,
      messages: this.conversationHistory,
      temperature: this.settings.temperature,
      numCtx,
      signal,
    })) {
      chunkCount++;
      // Accumulate text and send delta to UI
      if (chunk.message?.content) {
        accumulatedContent += chunk.message.content;
        onChunk(chunk.message.content);
      }

      // Track token counts from final chunk
      if (chunk.done) {
        if (chunk.promptEvalCount !== undefined) {
          this.lastPromptTokens = chunk.promptEvalCount;
        }
        if (chunk.evalCount !== undefined) {
          this.lastCompletionTokens = chunk.evalCount;
        }
      }
    }

    // Remove temporary directive (if inserted)
    if (tempDirectiveIndex !== -1) {
      this.conversationHistory.splice(tempDirectiveIndex, 1);
    }

    console.log(`[Sigil] Stream complete: ${chunkCount} chunks, ${accumulatedContent.length} chars`);

    // Context budgeting
    await this.pruneIfNeeded();

    // Add assistant message to history
    this.conversationHistory.push({ role: 'assistant', content: accumulatedContent });

    // Output gate: reject pipe-delimited / schema dumps
    const rprRejection = detectRawRprOutput(accumulatedContent);
    if (rprRejection) {
      console.warn(`[Sigil] Output rejected: ${rprRejection} — forcing retry`);
      this.conversationHistory.pop();
      this.conversationHistory.push({ role: 'system', content: OUTPUT_REJECTION_MESSAGE });

      // Retry (non-streaming for the retry — simpler)
      const retry = await client.generate({
        model: this.settings.model,
        messages: this.conversationHistory,
        temperature: this.settings.temperature,
        numCtx,
        signal,
      });

      accumulatedContent = retry.message?.content || accumulatedContent;
      this.conversationHistory.push({ role: 'assistant', content: accumulatedContent });

      if (retry.promptEvalCount !== undefined) this.lastPromptTokens = retry.promptEvalCount;
      if (retry.evalCount !== undefined) this.lastCompletionTokens = retry.evalCount;
    }

    // Content filter
    const filterResult = filterContent(accumulatedContent);
    if (!filterResult.allowed) {
      emergencyStop(filterResult.reason || 'Content violation detected');
    }

    // Save conversation
    if (this.conversationId) {
      await this.saveCurrentConversation();
    }

    const contextUsage = this.getContextUsage();
    console.log(`[Ollama] Stream complete: ${this.lastPromptTokens}/${numCtx} tokens (${contextUsage.percentUsed}%)`);

    this.abortController = null;
    return { content: accumulatedContent, contextUsage };
  }

  // ─── Context Budgeting ─────────────────────────────────────────────

  private static readonly SOFT_LIMIT = 0.85; // 85% — start pruning older messages
  private static readonly HARD_LIMIT = 0.95; // 95% — aggressive prune, keep fewer messages

  /**
   * Prune conversation history when context usage exceeds thresholds
   * OR every 10 user messages (incremental summarization).
   * Keeps: system messages (indices 0–1), last N user/assistant pairs.
   * Replaces pruned middle section with a model-generated summary (or heuristic fallback).
   */
  private async pruneIfNeeded(): Promise<void> {
    const contextWindow = this.getEffectiveContextSize();
    const hasTokenData = contextWindow > 0 && this.lastPromptTokens > 0;
    const usage = hasTokenData ? this.lastPromptTokens / contextWindow : 0;

    // Trigger on: context threshold exceeded OR every 10 user messages
    const contextTrigger = hasTokenData && usage >= OllamaAgent.SOFT_LIMIT;
    const incrementalTrigger = this.userMessageCount > 0 && this.userMessageCount % 10 === 0;

    if (!contextTrigger && !incrementalTrigger) return;

    const isHard = hasTokenData && usage >= OllamaAgent.HARD_LIMIT;
    // At soft/incremental keep last 8 messages, at hard limit keep last 6
    const keepRecent = isHard ? 6 : 8;

    // Find where system messages end (bootstrap injects at index 1)
    let systemEnd = 0;
    for (let i = 0; i < this.conversationHistory.length; i++) {
      if (this.conversationHistory[i].role === 'system') {
        systemEnd = i + 1;
      } else {
        break; // System messages are always at the start
      }
    }

    const totalMessages = this.conversationHistory.length;
    const prunableCount = totalMessages - systemEnd - keepRecent;

    if (prunableCount <= 2) return; // Not enough to prune

    const prunableMessages = this.conversationHistory.slice(systemEnd, systemEnd + prunableCount);

    // Try model-driven summarization first, fall back to heuristic
    let summaryContent = await this.generateModelSummary(prunableMessages, prunableCount);
    if (!summaryContent) {
      summaryContent = this.buildHeuristicSummary(prunableMessages, prunableCount);
    }

    // Replace prunable section with single summary message
    const systemMessages = this.conversationHistory.slice(0, systemEnd);
    const recentMessages = this.conversationHistory.slice(systemEnd + prunableCount);

    this.conversationHistory = [
      ...systemMessages,
      { role: 'system', content: summaryContent },
      ...recentMessages,
    ];

    console.log(`[Sigil] Context budget: pruned ${prunableCount} messages (${Math.round(usage * 100)}% used, ${isHard ? 'hard' : 'soft'} limit). ${this.conversationHistory.length} messages remain.`);
  }

  /**
   * Ask the model to summarize pruned messages into a concise recap.
   * Returns null if the model call fails (caller falls back to heuristic).
   */
  private async generateModelSummary(
    messages: OllamaMessage[],
    count: number
  ): Promise<string | null> {
    try {
      const endpoint = this.settings.useBundled ? 'http://127.0.0.1:11435' : this.settings.endpoint;
      const client = getOllamaClient(endpoint);

      // Build a condensed transcript for the model to summarize
      const transcript = messages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map(m => {
          const prefix = m.role === 'user' ? 'User' : 'Sigil';
          const text = m.content.length > 300 ? m.content.slice(0, 300) + '...' : m.content;
          return `${prefix}: ${text}`;
        })
        .join('\n');

      // If the transcript is tiny, don't bother with a model call
      if (transcript.length < 100) return null;

      const result = await client.generate({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a conversation summarizer. Produce a concise summary (3-6 sentences) of the following conversation excerpt. Focus on: what the user wanted, key decisions made, and any stated preferences. Output ONLY the summary, no preamble.',
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        temperature: 0.3,
        numCtx: 2048, // Small context — summary task is lightweight
      });

      const summary = result.message?.content?.trim();
      if (summary && summary.length > 20) {
        console.log(`[Sigil] Model-driven summary generated (${summary.length} chars for ${count} messages)`);
        return `[Context budget: ${count} older messages summarized by model]\n\n${summary}`;
      }
      return null;
    } catch (error) {
      console.warn('[Sigil] Model summary failed, using heuristic:', error);
      return null;
    }
  }

  /**
   * Fast heuristic summary — truncated one-liners from pruned messages.
   * Used as fallback when model summarization is unavailable.
   */
  private buildHeuristicSummary(messages: OllamaMessage[], count: number): string {
    const summaryLines: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'user') {
        const text = msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content;
        summaryLines.push(`User asked: ${text}`);
      } else if (msg.role === 'assistant' && msg.content) {
        const text = msg.content.length > 120 ? msg.content.slice(0, 120) + '...' : msg.content;
        summaryLines.push(`You replied: ${text}`);
      }
    }
    return `[Context budget: ${count} older messages compressed]\n\nEarlier in this conversation:\n${summaryLines.join('\n')}`;
  }

  /**
   * Determine effective num_ctx to send to Ollama.
   *
   * The architecture max (e.g. 32768 for Qwen 2.5 14B, 131072 for llama3.1)
   * is what the model *supports*, not what fits in VRAM. The KV cache scales
   * with both num_ctx and model hidden size — larger models need more VRAM per
   * context token. Using the raw arch max on a consumer GPU causes VRAM overflow,
   * pushing the KV cache to shared (PCIe) memory and killing inference speed.
   *
   * We cap num_ctx based on model parameter count as a proxy for VRAM budget.
   * Chat-only (no tool calls) means single round-trips — we can be generous:
   *   ≤3B  → 32768  (tiny KV cache, small models fit easily)
   *   ≤8B  → 16384  (7B Q4 + 16K KV ≈ 8-10 GB — fits 12GB GPUs)
   *   ≤14B → 12288  (14B Q4 + 12K KV ≈ 12 GB — fits 16GB GPUs)
   *   ≤32B → 8192   (32B Q4 + 8K KV ≈ 22 GB — fits 24GB GPUs)
   *   >32B → 4096   (huge models, minimal context to fit at all)
   *
   * User's settings.contextSize can override this if they explicitly set it.
   * The arch max is treated as an upper bound, never exceeded.
   */
  private getEffectiveContextSize(): number {
    const archMax = this.modelInfo?.maxContextWindow || 0;
    const userSetting = this.settings.contextSize || 0;

    // If user explicitly set a context size in settings, respect it (but don't exceed arch max)
    if (userSetting > 0) {
      return archMax > 0 ? Math.min(userSetting, archMax) : userSetting;
    }

    // VRAM-aware auto-sizing: use actual GPU data from /api/ps when available
    if (this.vramInfo && this.modelInfo && archMax > 0) {
      const cap = this.calcVramAwareContextCap();
      if (cap > 0) {
        const effective = Math.min(archMax, cap);
        console.log(`[Sigil] VRAM-aware context: cap ${cap}, arch_max ${archMax}, effective ${effective}`);
        return effective;
      }
    }

    // Fallback: cap based on model parameter count (no VRAM data available)
    if (this.modelInfo && archMax > 0) {
      const paramBillions = this.parseParamSize(this.modelInfo.parameterSize);
      let cap: number;
      if (paramBillions <= 3)       cap = 32768;
      else if (paramBillions <= 8)  cap = 16384;
      else if (paramBillions <= 14) cap = 12288;
      else if (paramBillions <= 32) cap = 8192;
      else                          cap = 4096;

      const effective = Math.min(archMax, cap);
      console.log(`[Sigil] Param-based context cap: ${paramBillions.toFixed(1)}B → cap ${cap}, arch_max ${archMax}, effective ${effective}`);
      return effective;
    }

    // No model info available — safe default
    return 8192;
  }

  /**
   * Calculate optimal num_ctx based on actual VRAM usage from /api/ps.
   */
  private calcVramAwareContextCap(): number {
    if (!this.vramInfo || !this.modelInfo) return 0;

    const { sizeBytes, sizeVramBytes } = this.vramInfo;
    const paramBillions = this.parseParamSize(this.modelInfo.parameterSize);

    // If model is partially offloaded (less than 90% in VRAM), VRAM is already full
    if (sizeBytes > 0 && sizeVramBytes < sizeBytes * 0.9) {
      console.log(`[Sigil] Model partially offloaded (${(sizeVramBytes / 1024 / 1024 / 1024).toFixed(1)}GB of ${(sizeBytes / 1024 / 1024 / 1024).toFixed(1)}GB in VRAM) → minimal context`);
      return 4096;
    }

    // Model is fully in VRAM. Estimate how much VRAM is free.
    const modelGB = sizeVramBytes / (1024 * 1024 * 1024);
    const vramTiers = [6, 8, 12, 16, 24, 48];
    const estimatedTotalGB = vramTiers.find(t => t >= modelGB + 0.5) || (modelGB + 2);

    // Reserve ~1GB for OS/display, rest is headroom for KV cache
    const headroomGB = Math.max(0.5, estimatedTotalGB - modelGB - 1.0);

    // KV cache cost per 1K context tokens (GB), scales with param count
    const kvCostPer1K = (paramBillions / 7) * 0.07;

    // Max tokens we can fit in the headroom
    const maxTokens = Math.floor((headroomGB / kvCostPer1K) * 1024);

    // Round down to nearest 1024, clamp between 4096 and 65536
    const capped = Math.max(4096, Math.min(65536, Math.floor(maxTokens / 1024) * 1024));

    console.log(`[Sigil] VRAM calc: model=${modelGB.toFixed(1)}GB, est_total=${estimatedTotalGB}GB, headroom=${headroomGB.toFixed(1)}GB, kv_cost=${kvCostPer1K.toFixed(3)}GB/1K, max_tokens=${maxTokens}, capped=${capped}`);
    return capped;
  }

  /**
   * Parse parameter size string (e.g. "14.8B", "7B", "3.2B") to a number in billions.
   */
  private parseParamSize(paramSize: string): number {
    if (!paramSize || paramSize === 'unknown') return 7; // Assume 7B if unknown
    const match = paramSize.match(/([\d.]+)\s*[Bb]/);
    return match ? parseFloat(match[1]) : 7;
  }

  /**
   * Get current context usage info
   */
  getContextUsage(): ContextUsage {
    const contextWindow = this.getEffectiveContextSize();
    const totalTokens = this.lastPromptTokens + this.lastCompletionTokens;
    return {
      promptTokens: this.lastPromptTokens,
      completionTokens: this.lastCompletionTokens,
      totalTokens,
      contextWindow,
      percentUsed: contextWindow > 0 ? Math.round((this.lastPromptTokens / contextWindow) * 100) : 0,
    };
  }

  /**
   * Get model info (context window, params, etc.)
   */
  getModelInfo(): OllamaModelInfo | null {
    return this.modelInfo;
  }

  /**
   * Abort the current generation
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      console.log('[Sigil] Generation aborted by user');
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): OllamaMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Update the agent's context with fresh editor state.
   * Call this before each message to ensure selected record,
   * activeCategory, and data are current.
   */
  updateContext(context: OllamaContext): void {
    this.context = context;
  }

  /**
   * Check if in wizard mode
   */
  isWizardMode(): boolean {
    return this.wizardMode;
  }

  /**
   * Exit wizard mode and switch to normal assistant mode
   */
  exitWizardMode(): void {
    if (this.wizardMode) {
      console.log('[Sigil] Exiting wizard mode, switching to normal assistant');
      this.wizardMode = false;
      this.systemPrompt = this.getMinimalSystemPrompt();
      // Full prompt will be rebuilt on next message via updateAddendaIfNeeded
      this.fullContextLoaded = false; // Force re-bootstrap to load full context
      this.contextLoaded = false;
      // Replace system prompt in history
      this.conversationHistory[0] = {
        role: 'system',
        content: this.systemPrompt,
      };
    }
  }

  /**
   * Clear conversation history (keeps system prompt)
   */
  clearHistory(): void {
    const newSystemPrompt = this.wizardMode ? SYSTEM_WIZARD_PROMPT : this.getMinimalSystemPrompt();
    this.systemPrompt = newSystemPrompt;
    this.conversationHistory = [
      {
        role: 'system',
        content: newSystemPrompt,
      },
    ];
    this.contextLoaded = false;
    this.fullContextLoaded = false;
    this.currentAddenda = [];
  }

  /**
   * Short summary for each known doc file (used in bootstrap doc index)
   */
  private getDocSummary(name: string): string {
    const summaries: Record<string, string> = {
      'rpr-system-architecture.md': 'Complete RPR table structure, column definitions, PerkAction/SpellEffect function types, formula syntax, condition indexing',
      'ability-design.md': 'How to design abilities (SpellDef + SpellEffect), targeting, damage formulas, buff/debuff patterns',
      'stat-systems.md': 'Stat table design, formula syntax ({c.StatName}), derived stats, resource pools',
      'perk-design.md': 'Perk table design, all 19 PerkAction functions, perk categories, prerequisite chains',
      'combat-mechanics.md': 'Combat flow, initiative, turn order, action economy, dice rolling mechanics',
      'balance-principles.md': 'Point budgets, scaling curves, power progression, testing methodology',
      'examples/spell-templates.json': 'Pre-built ability templates (attacks, heals, buffs, debuffs)',
      'examples/class-archetypes.json': 'Example class/race builds with stat distributions',
    };
    return summaries[name] || 'Reference document';
  }

  /**
   * Minimal synchronous fallback — used in constructor before async bootstrap runs.
   * Contains only identity + safety rule. Full prompt is built in buildSystemPrompt().
   */
  private getMinimalSystemPrompt(): string {
    return `⚠️ CRITICAL IMMUTABLE RULE ⚠️
ABSOLUTELY NO depictions, descriptions, implications, or suggestions of minors (children, teenagers, underage individuals) in ANY explicit, sexual, or adult-oriented context. This is NON-NEGOTIABLE.

You are **Sigil**, the creative RPR design advisor for Project Omen — a Conan Exiles roleplay system editor.
Full context is loading...`;
  }

  /**
   * Build the full system prompt from files + live context.
   * Async — called during bootstrap and when addenda change.
   */
  private async buildSystemPrompt(editorSummary?: string): Promise<string> {
    const effectiveCtx = this.getEffectiveContextSize();
    const maxSystemTokens = Math.floor(effectiveCtx * 0.4);

    const selectedRecord = this.context.editorState?.selected ?? null;
    const activeCategory = this.context.editorState?.activeCategory ?? '';
    const data = this.context.editorState?.data;

    let selectedRecordContext = '';
    if (selectedRecord && data) {
      selectedRecordContext = buildSelectedRecordContext(data, activeCategory, selectedRecord);
    }

    return this.promptBuilder.buildSystemPrompt({
      maxSystemTokens,
      editorSummary,
      addenda: this.currentAddenda,
      selectedRecordContext,
    });
  }

  /**
   * Save current conversation to disk
   */
  private async saveCurrentConversation(): Promise<void> {
    if (!this.conversationId) return;

    try {
      const conversation: Conversation = {
        metadata: {
          id: this.conversationId,
          title: 'Untitled Conversation', // Will be set externally
          createdAt: this.conversationCreatedAt, // Stable — set once at construction
          updatedAt: new Date().toISOString(),
          messageCount: this.conversationHistory.length,
        },
        messages: this.conversationHistory,
        systemPrompt: this.systemPrompt,
      };

      await saveConversation(conversation);
    } catch (error) {
      console.error('[Sigil] Failed to save conversation:', error);
    }
  }

  /**
   * Load conversation history from saved conversation
   */
  loadConversationHistory(conversation: Conversation): void {
    this.conversationHistory = [...conversation.messages];
    this.systemPrompt = conversation.systemPrompt;
    // Preserve original creation time
    if (conversation.metadata.createdAt) {
      this.conversationCreatedAt = conversation.metadata.createdAt;
    }
    console.log(`[Ollama] Loaded ${conversation.messages.length} messages from conversation`);
  }

  /**
   * Get conversation ID
   */
  getConversationId(): string | undefined {
    return this.conversationId;
  }
}
