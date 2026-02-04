import { getAdapter } from '@/services/PlatformAdapter';

export async function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): Promise<void> {
  const adapter = getAdapter();
  await adapter.writeFile(filename, text, mime);
}
