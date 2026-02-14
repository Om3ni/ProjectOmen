import type {
  OllamaFunction,
  FunctionHandler,
  FunctionResult,
  RegisteredFunction,
  FunctionCategory,
  OllamaContext,
} from './types';

/**
 * Central registry for Ollama functions.
 * Manages function definitions, handlers, and execution.
 */
export class OllamaFunctionRegistry {
  private functions: Map<string, RegisteredFunction> = new Map();

  /**
   * Register a function for Ollama to call
   */
  register(
    definition: OllamaFunction,
    handler: FunctionHandler,
    category: FunctionCategory,
    requiresApproval: boolean = false
  ): void {
    this.functions.set(definition.name, {
      definition,
      handler,
      category,
      requiresApproval,
    });
  }

  /**
   * Execute a function by name
   */
  async execute(
    name: string,
    args: Record<string, any>,
    context: OllamaContext
  ): Promise<FunctionResult> {
    const func = this.functions.get(name);
    
    if (!func) {
      return {
        success: false,
        error: `Function "${name}" not found`,
      };
    }

    try {
      // Validate required parameters
      const required = func.definition.parameters.required || [];
      for (const param of required) {
        if (args[param] === undefined || args[param] === null) {
          return {
            success: false,
            error: `Missing required parameter: ${param}`,
          };
        }
      }

      // Execute handler
      return await func.handler(args, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get function definition for providing to Ollama
   */
  getDefinition(name: string): OllamaFunction | undefined {
    return this.functions.get(name)?.definition;
  }

  /**
   * Get all function definitions
   */
  getAllDefinitions(): OllamaFunction[] {
    return Array.from(this.functions.values()).map(f => f.definition);
  }

  /**
   * Get function definitions filtered by categories
   */
  getDefinitionsByCategories(categories: FunctionCategory[]): OllamaFunction[] {
    return Array.from(this.functions.values())
      .filter(f => categories.includes(f.category))
      .map(f => f.definition);
  }

  /**
   * Get function definitions filtered by categories, with optional name filter.
   * Used to send only relevant schema tools (e.g. parent CRUD without child CRUD)
   * to avoid overwhelming smaller models with 50+ tool definitions.
   */
  getDefinitionsFiltered(categories: FunctionCategory[], nameFilter?: (name: string) => boolean): OllamaFunction[] {
    return Array.from(this.functions.values())
      .filter(f => categories.includes(f.category) && (!nameFilter || nameFilter(f.definition.name)))
      .map(f => f.definition);
  }

  /**
   * Get function by name
   */
  getFunction(name: string): RegisteredFunction | undefined {
    return this.functions.get(name);
  }

  /**
   * Check if function requires approval based on category and freedom level
   */
  requiresApproval(name: string, freedomLevel: 'conservative' | 'balanced' | 'autonomous'): boolean {
    const func = this.functions.get(name);
    if (!func) return true; // Unknown functions require approval

    // Conservative: all non-query functions need approval
    if (freedomLevel === 'conservative') {
      return func.category !== 'query';
    }

    // Autonomous: no approvals needed
    if (freedomLevel === 'autonomous') {
      return false;
    }

    // Balanced: selective approvals
    if (func.category === 'query') {
      return false; // Read-only never needs approval
    }

    return func.requiresApproval;
  }

  /**
   * Clear all registered functions (useful for testing)
   */
  clear(): void {
    this.functions.clear();
  }
}

// Singleton instance
export const functionRegistry = new OllamaFunctionRegistry();
