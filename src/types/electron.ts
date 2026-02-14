/**
 * Shared type definitions for Electron window interface
 */

export interface ElectronDebugApi {
  log?: (data: unknown) => Promise<void>;
  openDevTools?: () => Promise<void>;
  openLogFolder?: () => Promise<void>;
}

export interface ElectronRawWindowApi {
  open?: (data: { mode: string; category: string; initialText: string }) => Promise<void>;
  onApplied?: (callback: (payload: unknown) => void) => () => void;
}

export interface ElectronSheetWindowApi {
  open?: (data: unknown) => Promise<void>;
  update?: (data: unknown) => Promise<void> | void;
  close?: () => Promise<void>;
  getData?: () => Promise<unknown>;
  onInit?: (callback: (data: unknown) => void) => () => void;
}

export interface ElectronMenuApi {
  onCommand?: (callback: (payload: unknown) => void) => () => void;
}

export interface OllamaLocalStatus {
  available: boolean;
  running: boolean;
  endpoint: string;
  port: number;
}

export interface OllamaLocalModel {
  name: string;
  size: number;
  modified: string;
}

export interface OllamaPullProgress {
  model: string;
  status: string;
  total: number;
  completed: number;
  done: boolean;
}

export interface ElectronOllamaLocalApi {
  getStatus: () => Promise<OllamaLocalStatus>;
  start: () => Promise<{ running: boolean; endpoint: string }>;
  stop: () => Promise<{ running: boolean }>;
  listModels: () => Promise<{ success: boolean; models: OllamaLocalModel[]; error?: string }>;
  pullModel: (modelName: string) => Promise<{ success: boolean; status?: string; error?: string }>;
  deleteModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
  getModelsDir: () => Promise<{ path: string }>;
  setModelsDir: (newPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  browseModelsDir: () => Promise<{ canceled: boolean; path?: string; error?: string }>;
  onPullProgress: (listener: (progress: OllamaPullProgress) => void) => () => void;
}

export interface ElectronApi {
  debug?: ElectronDebugApi;
  rawWindow?: ElectronRawWindowApi;
  sheetWindow?: ElectronSheetWindowApi;
  characterSheet?: ElectronSheetWindowApi;
  menu?: ElectronMenuApi;
  ollamaLocal?: ElectronOllamaLocalApi;
  send?: (channel: string, data?: unknown) => Promise<void>;
}

export interface ElectronWindow extends Window {
  electron?: ElectronApi;
}

export function getElectron(): ElectronApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as ElectronWindow).electron;
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as ElectronWindow).electron !== 'undefined';
}
