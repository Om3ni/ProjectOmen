import type { PlatformAdapter, PickedFile } from './PlatformAdapter';

/**
 * Browser implementation of PlatformAdapter.
 * Uses fetch for reading and download links for writing.
 */
export class BrowserAdapter implements PlatformAdapter {
  async readFile(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  async writeFile(filename: string, content: string, mimeType = 'application/octet-stream'): Promise<void> {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  async pickFile(accept = '*/*'): Promise<PickedFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            content: String(reader.result ?? ''),
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      
      // Handle cancel (no file selected)
      input.oncancel = () => resolve(null);
      
      document.body.appendChild(input);
      input.click();
      
      // Cleanup after a delay (input stays in DOM briefly for the dialog)
      setTimeout(() => {
        document.body.removeChild(input);
      }, 60000); // 1 minute timeout for slow file reads
    });
  }
}
