export type PanelId = 'chat' | 'combat-log' | 'training-dummies';

export type PanelMode = 'hidden' | 'docked' | 'popout';

export type PanelState = {
  mode: PanelMode;
};

export type PanelManagerState = Record<PanelId, PanelState>;

export function defaultPanelState(overrides?: Partial<PanelState>): PanelState {
  return {
    mode: 'hidden',
    ...overrides,
  };
}
