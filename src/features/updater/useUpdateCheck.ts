import { useEffect, useState } from 'react';
import { platformKind } from '../../lib/platform';
import { useSettings } from '../settings/store';
import { checkForUpdate, type UpdateInfo } from './check';

/**
 * Android-only auto update check (docs/03 §5). Runs once, after first paint + a
 * short idle, at most once per 24h (ETag-cached). Surfaces a prompt only when a
 * newer, non-dismissed version exists; up-to-date / error outcomes are silent for
 * the automatic check (the E_UPDATE_* dialog copy is reserved for a future manual
 * "check now" button). Desktop is skipped this round, so there is no desktop path.
 */
const IDLE_MS = 5_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface UpdatePrompt {
  info: UpdateInfo;
  openReleasePage: () => Promise<void>;
  later: () => void;
  skip: () => void;
}

export function useUpdateCheck(): UpdatePrompt | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (platformKind() !== 'android') return;
    const timer = setTimeout(() => {
      void runCheck(setInfo);
    }, IDLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (!info) return null;
  return {
    info,
    openReleasePage: async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(info.url);
    },
    later: () => {
      setInfo(null);
    },
    skip: () => {
      useSettings.getState().setUpdater({ dismissedVersion: info.version });
      setInfo(null);
    },
  };
}

async function runCheck(setInfo: (info: UpdateInfo) => void): Promise<void> {
  const store = useSettings.getState();
  const { etag, lastCheckAt, dismissedVersion, autoCheck } = store.updater;
  if (!autoCheck) return;
  if (Date.now() - lastCheckAt < DAY_MS) return;

  const result = await checkForUpdate(__APP_VERSION__, etag);
  store.setUpdater({ lastCheckAt: Date.now() });
  if (result.kind === 'available') {
    store.setUpdater({ etag: result.info.etag });
    if (result.info.version !== dismissedVersion) setInfo(result.info);
  }
}
