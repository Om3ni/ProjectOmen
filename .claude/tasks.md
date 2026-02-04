# Project Omen - Feature Development Checklist

## Overview
This document tracks the development of new features for Project Omen. Each section contains detailed tasks that can be checked off as completed.

---

## 1. Dev Tools Menu Item
**Status: COMPLETE**
**Priority: High (Quick Win)**

- [x] Add "Toggle DevTools" to View menu in `electron/main.cjs`
  - [x] Already present via `{ role: 'toggleDevTools' }` with Ctrl+Shift+I

---

## 2. Settings Panel
**Status: COMPLETE**
**Priority: High (Foundation for Chat)**

### 2.1 Settings Storage
- [x] Create settings service `src/services/SettingsService.ts`
  - [x] Define settings schema/types
  - [x] localStorage persistence for browser
  - [x] Deep merge support for partial updates
  - [x] Webhook and LLM connection test methods

### 2.2 Settings Data Structure
```typescript
type Settings = {
  // Discord Integration
  discord: {
    enabled: boolean;
    webhookUrl: string;
    username?: string;        // Bot display name
    avatarUrl?: string;       // Bot avatar
  };

  // Slack Integration
  slack: {
    enabled: boolean;
    webhookUrl: string;
  };

  // LLM Integration
  llm: {
    enabled: boolean;
    provider: 'anthropic' | 'openai' | 'ollama' | 'custom';
    apiKey?: string;          // Encrypted or use system keychain
    endpoint?: string;        // For custom/ollama
    model?: string;           // e.g., 'claude-3-opus', 'gpt-4', 'llama2'
    maxTokens?: number;
    temperature?: number;
  };

  // General
  theme: ThemeName;           // Already exists in useTheme
  autoSave: boolean;
  autoSaveInterval: number;   // ms
};
```

### 2.3 Settings UI
- [x] Create `src/components/SettingsModal.tsx`
  - [x] Modal container with tabs: General, Discord, Slack, LLM
  - [x] Form validation
  - [x] Save/Cancel buttons
  - [x] Test connection buttons for webhooks
- [x] Add "Settings" to File menu (Ctrl+,)
- [x] Hook up settings to existing theme system

### 2.4 Settings Tabs Content
- [x] **General Tab**
  - [x] Theme selector
  - [x] Auto-save toggle
- [x] **Discord Tab**
  - [x] Enable/disable toggle
  - [x] Webhook URL input (password field)
  - [x] Username override input
  - [x] Avatar URL input
  - [x] Test button (sends test message)
- [x] **Slack Tab**
  - [x] Enable/disable toggle
  - [x] Webhook URL input (password field)
  - [x] Test button
- [x] **LLM Tab**
  - [x] Enable/disable toggle
  - [x] Provider dropdown (Anthropic, OpenAI, Ollama, Custom)
  - [x] API Key input (secure, masked)
  - [x] Custom endpoint input (shown for Ollama/Custom)
  - [x] Model text input
  - [x] Temperature slider (0.0 - 2.0)
  - [x] Max tokens input
  - [x] Test button

---

## 3. Chat Panel Foundation
**Status: COMPLETE**
**Priority: High**

### 3.1 Chat Data Types
- [x] Create `src/types/chat.ts`
  ```typescript
  type ChatTab = 'local' | 'discord' | 'slack' | 'llm';

  type ChatMessage = {
    id: string;
    tab: ChatTab;
    timestamp: number;
    sender: 'user' | 'system' | 'bot' | 'webhook';
    senderName?: string;
    content: string;
    type: 'text' | 'roll' | 'ability' | 'error' | 'llm-response';
    metadata?: {
      // For rolls
      formula?: string;
      rollResult?: RollResult;
      // For abilities
      abilityId?: number;
      abilityName?: string;
      // For LLM
      model?: string;
      tokensUsed?: number;
    };
  };

  type RollResult = {
    formula: string;
    rolls: number[];        // Individual die results
    modifier: number;
    total: number;
    criticalHit?: boolean;
    criticalFail?: boolean;
  };
  ```

### 3.2 Chat State Management
- [x] Create `src/hooks/useChatState.ts`
  - [x] Messages array per tab
  - [x] Active tab state
  - [x] Unread counts per tab
  - [x] Message sending function
  - [x] Message receiving function
  - [x] Clear history function
  - [x] localStorage persistence (last 100 messages per tab)

### 3.3 Chat UI Components
- [x] Create `src/components/chat/ChatPanel.tsx`
  - [x] Tab bar (Local, Discord, Slack, LLM)
  - [x] Unread badges on tabs
  - [x] Active tab indicator (themed)
  - [x] Tabs disabled when integration not configured
- [x] Create `src/components/chat/ChatMessageList.tsx`
  - [x] Auto-scroll to bottom on new messages
  - [x] Timestamp display
  - [x] Empty state placeholder
- [x] Create `src/components/chat/ChatMessage.tsx`
  - [x] Text message rendering
  - [x] Roll result rendering (formula, dice values, total, crit indicators)
  - [x] Error message styling
  - [x] LLM response rendering with model info
  - [x] System message styling
- [x] Create `src/components/chat/ChatInput.tsx`
  - [x] Text input with send button
  - [x] Slash command support (`/roll 2d6+3`)
  - [x] Enter to send, Shift+Enter for newline
  - [x] Command history (up/down arrows)
  - [x] Auto-resize textarea

### 3.4 Chat Panel Placement
- [x] Docked sidebar (collapsible)
- [x] For main editor: Add chat toggle button in header
- [x] Keyboard shortcut to toggle chat (Ctrl+Shift+C)
- [x] Menu item in Tools menu

---

## 4. Local Chat Tab
**Status: COMPLETE**
**Priority: High (First Tab)**

### 4.1 Core Features
- [x] Message display (text only initially)
- [x] User can type and send messages
- [x] System messages for app events
- [x] Session persistence (survives refresh)
- [x] Clear history button

### 4.2 Dice Rolling
- [x] Create `src/utils/diceRoller.ts`
  - [x] Parse dice notation: `XdY`, `XdY+Z`, `XdY-Z`
  - [x] Support multiple dice groups: `2d6+1d4+3`
  - [x] Support advantage/disadvantage: `2d20kh1` (keep highest 1)
  - [x] Support exploding dice: `4d6!` (reroll and add on max)
  - [x] Critical hit/fail detection for d20
- [x] `/roll` command handler
- [x] Roll result message formatting with visual indicators

### 4.3 Character Stat Integration
- [ ] Allow rolls referencing stats: `/roll 1d20 + Strength` (future enhancement)
- [ ] Resolve stat names to current character sheet values (future enhancement)
- [ ] Show formula expansion in result

---

## 5. Discord Webhook Integration
**Status: COMPLETE (Basic)**
**Priority: Medium**

### 5.1 Discord Service
- [x] Webhook POST function (inline in ChatPanel)
- [x] Connection test function (in SettingsService)
- [ ] Rich message formatting (Discord embeds) - future enhancement
- [ ] Rate limiting handling - future enhancement

### 5.2 Message Formatting
- [x] Basic text messages
- [ ] Rich embed for dice rolls - future enhancement
- [ ] Rich embed for ability usage - future enhancement

### 5.3 Discord Tab Features
- [x] Show sent messages in tab
- [x] Show delivery status (system messages)
- [x] Note: Discord webhooks are one-way (can't receive)

---

## 6. Slack Webhook Integration
**Status: COMPLETE (Basic)**
**Priority: Medium**

### 6.1 Slack Service
- [x] Webhook POST function (inline in ChatPanel)
- [x] Connection test function (in SettingsService)
- [ ] Block Kit formatting - future enhancement

### 6.2 Message Formatting
- [x] Basic text messages
- [ ] Block Kit format for rolls - future enhancement
- [ ] Block Kit format for abilities - future enhancement

### 6.3 Slack Tab Features
- [x] Show sent messages in tab
- [x] Show delivery status (system messages)
- [x] Note: Also one-way via webhooks

---

## 7. LLM Integration
**Status: Not Started**
**Priority: Low (Most Complex)**

### 7.1 LLM Service
- [ ] Create `src/services/LLMService.ts`
  - [ ] Provider abstraction interface
  - [ ] Anthropic provider implementation
  - [ ] OpenAI provider implementation
  - [ ] Ollama provider implementation
  - [ ] Custom endpoint provider
  - [ ] Streaming response support
  - [ ] Token counting/estimation
  - [ ] Error handling (rate limits, auth failures)

### 7.2 Context Building
- [ ] Create `src/services/LLMContextBuilder.ts`
  - [ ] System prompt with RPR schema knowledge
  - [ ] Include relevant schema-structure.json sections
  - [ ] Include current data being edited (summarized)
  - [ ] Include HELP.md content
  - [ ] Context window management (truncate old messages)

### 7.3 System Prompt
```
You are an RPR system design assistant for Project Omen. You help users design:
- Attributes and Skills with proper bonus functions
- Perks with balanced effects and requirements
- Stats with appropriate formulas
- Runes with conditions and effects
- Statuses with actions and durations
- Mutators with conditions and actions
- Abilities (Spells) with targeting, requirements, and effects

You have access to the full schema structure and can suggest properly formatted data.
When suggesting new content, output it in a format that can be directly imported.
```

### 7.4 LLM Tab Features
- [ ] Chat interface with LLM
- [ ] Streaming response display
- [ ] Stop generation button
- [ ] Copy response button
- [ ] "Apply to editor" button for suggestions
- [ ] Token usage display
- [ ] Model indicator
- [ ] Clear conversation button
- [ ] Conversation export

### 7.5 LLM Output Parsing
- [ ] Detect RPR data blocks in responses
- [ ] Parse and validate against schema
- [ ] Preview before applying
- [ ] Apply to specific category/table
- [ ] Merge vs replace options

---

## 8. Ability Loader (Character Sheet)
**Status: Not Started**
**Priority: Medium**

### 8.1 Ability List Panel
- [ ] Create `src/components/sheet/AbilityPanel.tsx`
  - [ ] List all abilities from SpellDef
  - [ ] Filter by category/type
  - [ ] Search by name
  - [ ] Show cooldown status
  - [ ] Show resource costs

### 8.2 Ability Details
- [ ] Show full ability description
- [ ] Show requirements (SpellReqDef)
- [ ] Show targeting conditions (SpellTargetCond)
- [ ] Show effects (SpellEffect)
- [ ] Requirements check against current character

### 8.3 Ability Execution
- [ ] "Use Ability" button
- [ ] Check requirements first
- [ ] Evaluate any formulas
- [ ] Roll any dice
- [ ] Apply effects (show preview)
- [ ] Send result to active chat tab

### 8.4 Integration with Chat
- [ ] Ability results appear in Local tab
- [ ] If Discord/Slack enabled, also post there
- [ ] Rich formatting of ability usage

---

## 9. Future Considerations
**Status: Backlog**

### 9.1 Potential Enhancements
- [ ] Discord Bot (two-way, requires bot token)
- [ ] WebSocket for real-time multi-user
- [ ] Campaign/session logging
- [ ] Character sheet saving/loading
- [ ] Export chat logs
- [ ] Macro system (saved command sequences)
- [ ] Sound effects for rolls
- [ ] Animated dice rolling

### 9.2 Technical Debt
- [ ] Update remaining ~30 files with hardcoded slate- colors for full theme support
- [ ] Add unit tests for dice roller
- [ ] Add unit tests for formula parser
- [ ] Add integration tests for chat services

---

## Progress Log

| Date | Task | Status |
|------|------|--------|
| 2026-02-02 | Created task checklist | Done |
| 2026-02-02 | Dev Tools menu item | Already present |
| 2026-02-02 | Settings Panel (SettingsService, SettingsModal, all tabs) | Done |
| 2026-02-02 | Chat Panel UI (ChatPanel, ChatInput, ChatMessage, ChatMessageList) | Done |
| 2026-02-02 | Local Chat with dice rolling (diceRoller.ts, useChatState.ts) | Done |
| 2026-02-02 | Discord webhook integration (basic) | Done |
| 2026-02-02 | Slack webhook integration (basic) | Done |
| | | |

---

## Notes

- Settings should be encrypted for API keys (consider using Electron's safeStorage)
- Discord webhooks have rate limits: 30 requests per minute
- Slack webhooks have rate limits: 1 request per second
- LLM context window varies by provider/model - need to manage carefully
- All chat backends should use a common interface for easy swapping
