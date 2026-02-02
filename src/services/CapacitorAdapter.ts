import type { PlatformAdapter, PickedFile } from './PlatformAdapter';

/**
 * Capacitor implementation of PlatformAdapter.
 * Uses @capacitor/filesystem plugin.
 * 
 * TODO: Implement when adding Capacitor support
 * 
 * Setup:
 * 1. npm install @capacitor/core @capacitor/cli @capacitor/filesystem
 * 2. npx cap init
 * 3. In main.tsx: import { CapacitorAdapter } and setAdapter(new CapacitorAdapter())
 */
export class CapacitorAdapter implements PlatformAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async readFile(_path: string): Promise<string> {
    // import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
    // 
    // For bundled assets (like schema files), use fetch:
    // if (path.startsWith('/')) {
    //   const response = await fetch(path);
    //   return response.text();
    // }
    // 
    // For user files:
    // const result = await Filesystem.readFile({
    //   path,
    //   directory: Directory.Documents,
    //   encoding: Encoding.UTF8,
    // });
    // return result.data as string;
    
    throw new Error('CapacitorAdapter not implemented. Install @capacitor/filesystem.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async writeFile(_filename: string, _content: string, _mimeType?: string): Promise<void> {
    // import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
    // 
    // await Filesystem.writeFile({
    //   path: filename,
    //   data: content,
    //   directory: Directory.Documents,
    //   encoding: Encoding.UTF8,
    // });
    
    throw new Error('CapacitorAdapter not implemented. Install @capacitor/filesystem.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async pickFile(_accept?: string): Promise<PickedFile | null> {
    // For file picking on mobile, you may need @capawesome/capacitor-file-picker
    // or use native share sheet / document picker
    //
    // import { FilePicker } from '@capawesome/capacitor-file-picker';
    // const result = await FilePicker.pickFiles({ types: ['application/json'] });
    // if (!result.files.length) return null;
    // const file = result.files[0];
    // return { name: file.name, content: file.data ?? '' };
    
    throw new Error('CapacitorAdapter not implemented. Install file picker plugin.');
  }
}
