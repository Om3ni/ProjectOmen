import type { OllamaMessage, OllamaResponse, OllamaFunction } from '../types';

/**
 * Ollama API client with function calling (tool) support.
 * Uses Ollama's tool calling feature for structured function invocation.
 */

export interface OllamaGenerateOptions {
  model: string;
  messages: OllamaMessage[];
  tools?: OllamaFunction[];
  temperature?: number;
  stream?: boolean;
  numCtx?: number;
  numPredict?: number;
  signal?: AbortSignal;
}

export interface OllamaGenerateResult {
  message: OllamaMessage;
  done: boolean;
  promptEvalCount?: number;
  evalCount?: number;
}

export interface OllamaStreamChunk {
  message: OllamaMessage;
  done: boolean;
  promptEvalCount?: number;
  evalCount?: number;
}

export interface OllamaModelInfo {
  name: string;
  contextWindow: number;     // Reported default (from general.context_length or num_ctx param)
  maxContextWindow: number;  // Architecture max (from e.g. llama.context_length) — use this for num_ctx
  parameterSize: string;
  quantization: string;
  family: string;
}

export interface OllamaVramInfo {
  modelName: string;
  sizeBytes: number;      // Total model size on disk
  sizeVramBytes: number;  // VRAM currently consumed by the model
  contextLength: number;  // Context length the model was loaded with
}

export class OllamaClient {
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:11434') {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Generate a response with optional tool calling
   */
  async generate(options: OllamaGenerateOptions): Promise<OllamaGenerateResult> {
    const url = `${this.endpoint}/api/chat`;
    
    const requestBody: any = {
      model: options.model,
      messages: options.messages,
      stream: options.stream ?? false,
    };

    if (options.tools && options.tools.length > 0) {
      // Wrap in { type: "function", function: {...} } format per Ollama /api/chat spec
      requestBody.tools = options.tools.map((fn) => ({ type: 'function', function: fn }));
    }

    requestBody.options = {
      temperature: options.temperature ?? 0.7,
      num_ctx: options.numCtx || 8192,
      num_predict: options.numPredict ?? 2048,
    };
    requestBody.keep_alive = '15m';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`);
      }

      const data: OllamaResponse = await response.json();
      
      // Check for error in response
      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }
      
      // Ensure message has content (even if empty)
      if (!data.message) {
        throw new Error('Ollama returned empty response');
      }
      
      return {
        message: {
          ...data.message,
          content: data.message.content || '',
        },
        done: data.done,
        promptEvalCount: (data as any).prompt_eval_count,
        evalCount: (data as any).eval_count,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to connect to Ollama: ${String(error)}`);
    }
  }

  /**
   * Generate a streaming response. Yields chunks as they arrive.
   * Final chunk has done=true and may contain tool_calls + token counts.
   */
  async *generateStream(options: OllamaGenerateOptions): AsyncGenerator<OllamaStreamChunk> {
    const url = `${this.endpoint}/api/chat`;

    const requestBody: any = {
      model: options.model,
      messages: options.messages,
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools.map((fn) => ({ type: 'function', function: fn }));
    }

    requestBody.options = {
      temperature: options.temperature ?? 0.7,
      num_ctx: options.numCtx || 8192,
      num_predict: options.numPredict ?? 2048,
    };
    requestBody.keep_alive = '15m';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Ollama sends newline-delimited JSON
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);
            if (data.error) throw new Error(`Ollama error: ${data.error}`);

            const chunk: OllamaStreamChunk = {
              message: {
                ...data.message,
                content: data.message?.content || '',
              },
              done: data.done,
              promptEvalCount: data.prompt_eval_count,
              evalCount: data.eval_count,
            };

            yield chunk;
          } catch (e) {
            if (e instanceof Error && e.message.startsWith('Ollama error:')) throw e;
            // Skip malformed JSON lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          if (data.error) throw new Error(`Ollama error: ${data.error}`);
          yield {
            message: { ...data.message, content: data.message?.content || '' },
            done: data.done,
            promptEvalCount: data.prompt_eval_count,
            evalCount: data.eval_count,
          };
        } catch { /* ignore trailing partial JSON */ }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/api/version`, {
        method: 'GET',
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server returned ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        version: data.version,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<{ success: boolean; models?: string[]; error?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server returned ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const models = (data.models || []).map((m: any) => m.name);
      
      return {
        success: true,
        models,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get model info including context window size
   */
  async showModel(modelName: string): Promise<OllamaModelInfo | null> {
    try {
      const response = await fetch(`${this.endpoint}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) return null;

      const data = await response.json();

      // Parse context window from Ollama's response.
      // Two values matter:
      //   1. "reported default" — what Ollama configured (often 2048)
      //   2. "architecture max" — what the model actually supports (e.g. 128K for llama3.1)
      //
      // The architecture max lives in model_info under a family-specific key
      // like "llama.context_length" or "gemma3.context_length".
      // general.context_length is the configured default (often much lower).

      let contextWindow = 2048; // fallback reported default
      const params = data.parameters || '';
      const ctxMatch = params.match(/num_ctx\s+(\d+)/);
      if (ctxMatch) {
        contextWindow = parseInt(ctxMatch[1], 10);
      } else if (data.model_info?.['general.context_length']) {
        contextWindow = data.model_info['general.context_length'];
      }

      // Scan model_info for architecture-specific context_length (the true max)
      let maxContextWindow = contextWindow;
      const modelInfo = data.model_info || {};
      for (const key of Object.keys(modelInfo)) {
        if (key.endsWith('.context_length') && key !== 'general.context_length') {
          const val = modelInfo[key];
          if (typeof val === 'number' && val > maxContextWindow) {
            maxContextWindow = val;
          }
        }
      }

      return {
        name: modelName,
        contextWindow,
        maxContextWindow,
        parameterSize: data.details?.parameter_size || 'unknown',
        quantization: data.details?.quantization_level || 'unknown',
        family: data.details?.family || 'unknown',
      };
    } catch {
      return null;
    }
  }

  /**
   * Get VRAM usage for currently loaded models via /api/ps.
   * Returns null if the endpoint is unavailable or no models are loaded.
   */
  async getRunningModels(): Promise<OllamaVramInfo[] | null> {
    try {
      const response = await fetch(`${this.endpoint}/api/ps`, { method: 'GET' });
      if (!response.ok) return null;

      const data = await response.json();
      const models = data.models || [];
      if (models.length === 0) return null;

      return models.map((m: any) => ({
        modelName: m.model || m.name || '',
        sizeBytes: m.size || 0,
        sizeVramBytes: m.size_vram || 0,
        contextLength: m.details?.context_length || 0,
      }));
    } catch {
      return null;
    }
  }

  /**
   * Update endpoint
   */
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.replace(/\/$/, '');
  }
}

// Singleton instance
let clientInstance: OllamaClient | null = null;

export function getOllamaClient(endpoint?: string): OllamaClient {
  if (!clientInstance || (endpoint && clientInstance['endpoint'] !== endpoint)) {
    clientInstance = new OllamaClient(endpoint);
  }
  return clientInstance;
}

/**
 * Pre-warm an Ollama model into VRAM at app startup.
 *
 * IMPORTANT: We prewarm with the real num_ctx the chat will use, not a tiny
 * placeholder. Ollama allocates the KV cache based on num_ctx — if the prewarm
 * uses numCtx: 64 and the first real request uses numCtx: 16384, Ollama has to
 * unload/reload the model to resize the KV cache, causing a massive delay on
 * first message. By prewarming at the target context size, the KV cache is
 * ready and the first real chat message gets immediate inference.
 *
 * Fire-and-forget — all errors are silently ignored.
 */
export function prewarmOllamaModel(endpoint: string, model: string, numCtx?: number): void {
  const maxRetries = 3;
  const retryDelayMs = 5_000; // 5s between retries

  const attempt = async (n: number) => {
    try {
      const client = getOllamaClient(endpoint);

      // Determine the real num_ctx to use for KV cache pre-allocation
      let targetCtx = numCtx || 0;
      if (!targetCtx) {
        // Query model info to size context like OllamaAgent does
        const info = await client.showModel(model);
        if (info) {
          const archMax = info.maxContextWindow || 0;
          const paramBillions = parseParamBillions(info.parameterSize);
          let cap: number;
          if (paramBillions <= 3)       cap = 32768;
          else if (paramBillions <= 8)  cap = 16384;
          else if (paramBillions <= 14) cap = 12288;
          else if (paramBillions <= 32) cap = 8192;
          else                          cap = 4096;
          targetCtx = archMax > 0 ? Math.min(archMax, cap) : cap;
          console.log(`[Sigil] Pre-warm: ${paramBillions.toFixed(1)}B model, target ctx ${targetCtx}`);
        }
      }
      if (!targetCtx) targetCtx = 8192; // Safe fallback

      await client.generate({
        model,
        messages: [
          { role: 'system', content: 'respond with ok' },
          { role: 'user', content: '.' },
        ],
        temperature: 0,
        numCtx: targetCtx,
        numPredict: 1,
      });
      console.log(`[Sigil] App-level pre-warm complete — model loaded with ${targetCtx} ctx`);
    } catch {
      if (n < maxRetries) {
        setTimeout(() => attempt(n + 1), retryDelayMs);
      }
      // Silently give up after max retries — model will load on first real request
    }
  };

  // Wait a few seconds for the bundled Ollama server to finish starting
  setTimeout(() => attempt(1), 3_000);
}

/** Parse "14.8B" → 14.8, "7B" → 7, etc. */
function parseParamBillions(paramSize: string): number {
  if (!paramSize || paramSize === 'unknown') return 7;
  const match = paramSize.match(/([\d.]+)\s*[Bb]/);
  return match ? parseFloat(match[1]) : 7;
}
