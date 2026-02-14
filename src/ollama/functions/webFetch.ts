import type { FunctionHandler, OllamaFunction } from '../types';

/**
 * Web fetch function - allows Ollama to fetch public web content
 * Requires approval to prevent unexpected external requests
 */

export const webFetch: FunctionHandler = async (args, _context) => {
  try {
    const { url, description } = args;

    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL is required and must be a string' };
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }

    // Only allow http/https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { success: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Fetch the URL
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RPR-Parser-Editor-Ollama/1.0',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Get content type
    const contentType = response.headers.get('content-type') || '';

    // Only process text content
    if (!contentType.includes('text/') && !contentType.includes('application/json')) {
      return {
        success: false,
        error: `Content type ${contentType} is not supported. Only text and JSON are allowed.`,
      };
    }

    // Read response text
    const text = await response.text();

    // Limit response size to prevent memory issues
    const maxSize = 500000; // 500KB
    if (text.length > maxSize) {
      return {
        success: true,
        data: {
          url,
          description: description || url,
          content: text.slice(0, maxSize),
          truncated: true,
          originalSize: text.length,
          message: `Content truncated to ${maxSize} characters (original: ${text.length} characters)`,
        },
      };
    }

    return {
      success: true,
      data: {
        url,
        description: description || url,
        content: text,
        contentType,
        size: text.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

// Function definition for Ollama
export const webFetchDefinition: OllamaFunction = {
  name: 'webFetch',
  description:
    'Fetch content from a public web URL. Use this to look up game design concepts, RPG mechanics, or reference material not available locally. Only text and JSON content is supported.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The HTTP/HTTPS URL to fetch',
      },
      description: {
        type: 'string',
        description: 'Brief description of why you need this URL (helps user understand the request)',
      },
    },
    required: ['url'],
  },
};
