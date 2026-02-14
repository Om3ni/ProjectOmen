/**
 * Conversation Selector - Manage and switch between conversations
 */

import { useState, useEffect } from 'react';
import type { ConversationMetadata } from '@/ollama/utils/conversationManager';
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
} from '@/ollama/utils/conversationManager';

interface Props {
  currentConversationId?: string;
  onConversationSelect: (conversationId: string, title: string) => void;
  onNewConversation: () => void;
  systemPrompt: string;
  isWizardMode?: boolean;
}

export function ConversationSelector({
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  systemPrompt,
  isWizardMode = false,
}: Props) {
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const convos = await listConversations();
    setConversations(convos);
  };

  const handleCreateNew = async () => {
    if (!newTitle.trim()) return;

    const conversation = await createConversation(newTitle.trim(), systemPrompt);
    await loadConversations();
    onConversationSelect(conversation.metadata.id, conversation.metadata.title);
    setIsCreating(false);
    setNewTitle('');
    setIsOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;

    await deleteConversation(id);
    await loadConversations();

    // If we deleted the current conversation, start a new one
    if (id === currentConversationId) {
      onNewConversation();
    }
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;

    await renameConversation(id, renameValue.trim());
    await loadConversations();

    setRenamingId(null);
    setRenameValue('');
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <div className="relative">
      {/* Current conversation button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded theme-bg-secondary border theme-border hover:bg-opacity-80 transition-colors text-sm"
      >
        <span className="text-base">{isWizardMode ? '🧙' : '💬'}</span>
        <div className="flex flex-col items-start min-w-0">
          <span className="theme-text truncate max-w-[180px]">
            {currentConversation?.title || 'New Conversation'}
          </span>
          {isWizardMode && (
            <span className="text-xs theme-text-muted">Wizard Mode</span>
          )}
        </div>
        <span className="text-xs theme-text-muted ml-auto">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[320px] max-h-[400px] overflow-y-auto theme-bg-elevated border theme-border rounded-lg shadow-xl z-50">
          {/* New conversation button */}
          <div className="p-2 border-b theme-border">
            {!isCreating ? (
              <button
                onClick={() => {
                  setIsCreating(true);
                  onNewConversation();
                }}
                className="w-full px-3 py-2 rounded border theme-border hover:theme-bg-secondary transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span>➕</span>
                <span>New Conversation</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNew();
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewTitle('');
                    }
                  }}
                  placeholder="Conversation title..."
                  className="flex-1 px-2 py-1 text-sm rounded theme-bg-secondary border theme-border theme-text"
                  autoFocus
                />
                <button
                  onClick={handleCreateNew}
                  className="px-2 py-1 rounded theme-bg-accent hover:opacity-80 text-xs"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle('');
                  }}
                  className="px-2 py-1 rounded theme-bg-secondary hover:opacity-80 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Conversations list */}
          <div className="p-1">
            {conversations.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm theme-text-muted">
                No saved conversations yet
              </div>
            ) : (
              conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded hover:theme-bg-secondary transition-colors group ${
                    convo.id === currentConversationId ? 'theme-bg-accent/10' : ''
                  }`}
                >
                  {renamingId === convo.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(convo.id);
                          if (e.key === 'Escape') {
                            setRenamingId(null);
                            setRenameValue('');
                          }
                        }}
                        className="flex-1 px-2 py-1 text-xs rounded theme-bg-secondary border theme-border theme-text"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(convo.id)}
                        className="px-1.5 text-xs theme-text hover:text-green-400"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setRenamingId(null);
                          setRenameValue('');
                        }}
                        className="px-1.5 text-xs theme-text hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          onConversationSelect(convo.id, convo.title);
                          setIsOpen(false);
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm theme-text truncate">{convo.title}</div>
                        <div className="text-xs theme-text-muted">
                          {convo.messageCount} messages · {new Date(convo.updatedAt).toLocaleDateString()}
                        </div>
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setRenamingId(convo.id);
                            setRenameValue(convo.title);
                          }}
                          className="px-2 py-1 text-xs theme-text hover:text-blue-400"
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(convo.id)}
                          className="px-2 py-1 text-xs theme-text hover:text-red-400"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close menu */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40"
        />
      )}
    </div>
  );
}
