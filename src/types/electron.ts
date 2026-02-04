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
  close?: () => Promise<void>;
  getData?: () => Promise<unknown>;
  onInit?: (callback: (data: unknown) => void) => () => void;
}

export interface ElectronMenuApi {
  onCommand?: (callback: (payload: unknown) => void) => () => void;
}

export interface ElectronApi {
  debug?: ElectronDebugApi;
  rawWindow?: ElectronRawWindowApi;
  sheetWindow?: ElectronSheetWindowApi;
  characterSheet?: ElectronSheetWindowApi;
  menu?: ElectronMenuApi;
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
