/**
 * Conversation Manager - Persistent long-term conversations
 * Handles creating, loading, saving, and managing multiple conversation threads
 */

import type { OllamaMessage } from '../types';

export interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  summary?: string; // AI-generated summary of conversation so far
}

export interface Conversation {
  metadata: ConversationMetadata;
  messages: OllamaMessage[];
  systemPrompt: string;
}

type ElectronBridge = {
  fs?: {
    readTextFile?: (filePath: string) => Promise<string>;
    writeTextFile?: (filePath: string, content: string) => Promise<boolean>;
    listFiles?: (dirPath: string) => Promise<string[]>;
    deleteFile?: (filePath: string) => Promise<boolean>;
  };
  app?: {
    getSaveFolder?: () => Promise<string>;
  };
};

function getElectron(): ElectronBridge | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = typeof window !== 'undefined' ? ((window as any).electron as ElectronBridge | undefined) : undefined;
    return el ?? null;
  } catch {
    return null;
  }
}

const CONVERSATIONS_FOLDER = 'conversations';

/**
 * Get the conversations folder path
 */
async function getConversationsPath(): Promise<string> {
  const el = getElectron();
  
  if (el?.app?.getSaveFolder) {
    const appFolder = await el.app.getSaveFolder();
    const separator = appFolder.includes('\\') ? '\\' : '/';
    return `${appFolder}${separator}${CONVERSATIONS_FOLDER}`;
  }
  
  throw new Error('Cannot access file system');
}

/**
 * Generate a new conversation ID
 */
function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new conversation
 */
export async function createConversation(
  title: string,
  systemPrompt: string
): Promise<Conversation> {
  const metadata: ConversationMetadata = {
    id: generateConversationId(),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 1, // System prompt
  };

  const conversation: Conversation = {
    metadata,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
    systemPrompt,
  };

  await saveConversation(conversation);
  return conversation;
}

/**
 * Save a conversation to disk
 */
export async function saveConversation(conversation: Conversation): Promise<boolean> {
  const el = getElectron();
  
  if (!el?.fs?.writeTextFile) {
    console.warn('[ConversationManager] File system not available');
    return false;
  }

  try {
    const conversationsPath = await getConversationsPath();
    const separator = conversationsPath.includes('\\') ? '\\' : '/';
    const filePath = `${conversationsPath}${separator}${conversation.metadata.id}.json`;
    
    // Update metadata
    conversation.metadata.updatedAt = new Date().toISOString();
    conversation.metadata.messageCount = conversation.messages.length;
    
    const json = JSON.stringify(conversation, null, 2);
    await el.fs.writeTextFile(filePath, json);
    
    console.log(`[ConversationManager] Saved conversation: ${conversation.metadata.title}`);
    return true;
  } catch (error) {
    console.error('[ConversationManager] Failed to save conversation:', error);
    return false;
  }
}

/**
 * Load a conversation from disk
 */
export async function loadConversation(conversationId: string): Promise<Conversation | null> {
  const el = getElectron();
  
  if (!el?.fs?.readTextFile) {
    console.warn('[ConversationManager] File system not available');
    return null;
  }

  try {
    const conversationsPath = await getConversationsPath();
    const separator = conversationsPath.includes('\\') ? '\\' : '/';
    const filePath = `${conversationsPath}${separator}${conversationId}.json`;
    
    const json = await el.fs.readTextFile(filePath);
    const conversation = JSON.parse(json) as Conversation;
    
    console.log(`[ConversationManager] Loaded conversation: ${conversation.metadata.title}`);
    return conversation;
  } catch (error) {
    console.error('[ConversationManager] Failed to load conversation:', error);
    return null;
  }
}

/**
 * List all conversations
 */
export async function listConversations(): Promise<ConversationMetadata[]> {
  const el = getElectron();
  
  if (!el?.fs?.listFiles || !el?.fs?.readTextFile) {
    console.warn('[ConversationManager] File system not available');
    return [];
  }

  try {
    const conversationsPath = await getConversationsPath();
    const files = await el.fs.listFiles(conversationsPath);
    
    const conversations: ConversationMetadata[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const separator = conversationsPath.includes('\\') ? '\\' : '/';
          const filePath = `${conversationsPath}${separator}${file}`;
          const json = await el.fs.readTextFile(filePath);
          const conversation = JSON.parse(json) as Conversation;
          conversations.push(conversation.metadata);
        } catch {
          // Skip invalid files
        }
      }
    }
    
    // Sort by most recently updated
    conversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    return conversations;
  } catch (error) {
    console.error('[ConversationManager] Failed to list conversations:', error);
    return [];
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const el = getElectron();
  
  if (!el?.fs?.deleteFile) {
    console.warn('[ConversationManager] File system not available');
    return false;
  }

  try {
    const conversationsPath = await getConversationsPath();
    const separator = conversationsPath.includes('\\') ? '\\' : '/';
    const filePath = `${conversationsPath}${separator}${conversationId}.json`;
    
    await el.fs.deleteFile(filePath);
    console.log(`[ConversationManager] Deleted conversation: ${conversationId}`);
    return true;
  } catch (error) {
    console.error('[ConversationManager] Failed to delete conversation:', error);
    return false;
  }
}

/**
 * Update conversation title
 */
export async function renameConversation(
  conversationId: string,
  newTitle: string
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) return false;
  
  conversation.metadata.title = newTitle;
  return await saveConversation(conversation);
}

/**
 * Check if conversation needs summarization (too many messages)
 */
export function needsSummarization(conversation: Conversation): boolean {
  // Summarize if more than 30 messages (excluding system prompt)
  const messageCount = conversation.messages.filter(m => m.role !== 'system').length;
  return messageCount > 30 && !conversation.metadata.summary;
}

/**
 * Generate a summary request for Ollama
 */
export function generateSummaryRequest(conversation: Conversation): string {
  const messages = conversation.messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');
  
  return `Please provide a concise summary (2-3 paragraphs) of this conversation, focusing on:
1. Key topics discussed
2. Important decisions or preferences stated
3. Context about the project/system being worked on

Conversation:
${messages}

Summary:`;
}

/**
 * Update conversation with AI-generated summary
 */
export async function updateConversationSummary(
  conversationId: string,
  summary: string
): Promise<boolean> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) return false;
  
  conversation.metadata.summary = summary;
  return await saveConversation(conversation);
}
