import { useEffect, useState } from 'react';

import { SettingsService, type Settings } from '@/services/SettingsService';

const SETTINGS_CHANGED_EVENT = 'project-omen:settings-changed';

export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(() => SettingsService.load());

  useEffect(() => {
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<Settings | undefined>).detail;
      if (detail) {
        setSettings(detail);
      } else {
        setSettings(SettingsService.load());
      }
    };

    const onStorage = () => {
      setSettings(SettingsService.load());
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, onCustom as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onCustom as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return settings;
}
