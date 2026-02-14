import type { AiCharacter } from '../types';

/**
 * AI Character Storage
 * Persists AI-generated character sheets to localStorage
 */

const STORAGE_KEY = 'project-omen:ai-characters:v1';

/**
 * Load all AI characters from storage
 */
export function loadAiCharacters(): AiCharacter[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed as AiCharacter[];
  } catch (error) {
    console.error('Failed to load AI characters:', error);
    return [];
  }
}

/**
 * Save all AI characters to storage
 */
export function saveAiCharacters(characters: AiCharacter[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
  } catch (error) {
    console.error('Failed to save AI characters:', error);
  }
}

/**
 * Add a new AI character
 */
export function addAiCharacter(character: AiCharacter): void {
  const characters = loadAiCharacters();
  characters.push(character);
  saveAiCharacters(characters);
}

/**
 * Get a specific AI character by ID
 */
export function getAiCharacter(id: string): AiCharacter | null {
  const characters = loadAiCharacters();
  return characters.find((c) => c.id === id) || null;
}

/**
 * Update an existing AI character
 */
export function updateAiCharacter(id: string, updates: Partial<AiCharacter>): void {
  const characters = loadAiCharacters();
  const index = characters.findIndex((c) => c.id === id);

  if (index >= 0) {
    characters[index] = { ...characters[index], ...updates };
    saveAiCharacters(characters);
  }
}

/**
 * Delete an AI character
 */
export function deleteAiCharacter(id: string): void {
  const characters = loadAiCharacters();
  const filtered = characters.filter((c) => c.id !== id);
  saveAiCharacters(filtered);
}

/**
 * Update last used timestamp
 */
export function touchAiCharacter(id: string): void {
  updateAiCharacter(id, { lastUsed: Date.now() });
}

/**
 * Create a unique ID for an AI character
 */
export function generateAiCharacterId(): string {
  return 'ai-char-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}
