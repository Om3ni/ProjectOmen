/**
 * CRITICAL SAFETY: Content filtering for Ollama responses
 * This filter checks for prohibited content involving minors
 */

type ElectronBridge = {
  fs?: {
    writeTextFile?: (filePath: string, content: string, append?: boolean) => Promise<boolean>;
  };
  app?: {
    getSaveFolder?: () => Promise<string>;
  };
};

function getElectron(): ElectronBridge | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = typeof window !== 'undefined' ? ((window as any).electron as ElectronBridge | undefined) : undefined;
    return el ?? null;
  } catch {
    return null;
  }
}

const PROHIBITED_PATTERNS = [
  // Age indicators combined with explicit contexts
  /\b(child|children|kid|kids|minor|minors|underage|young|youth|juvenile|teen|teenager|boy|girl)\b/i,
];

const EXPLICIT_CONTEXTS = [
  /\b(sex|sexual|nude|naked|explicit|erotic|intimate|penetrat|orgasm|arousal)\b/i,
];

export interface FilterResult {
  allowed: boolean;
  reason?: string;
  severity: 'none' | 'warning' | 'critical';
}

/**
 * Check if content contains prohibited material
 * CRITICAL: This checks for any depiction of minors in explicit contexts
 */
export function filterContent(text: string): FilterResult {
  const lowerText = text.toLowerCase();
  
  // Check if text contains age indicators
  const hasAgeIndicator = PROHIBITED_PATTERNS.some(pattern => pattern.test(lowerText));
  
  if (!hasAgeIndicator) {
    return { allowed: true, severity: 'none' };
  }
  
  // If age indicator found, check for explicit context
  const hasExplicitContext = EXPLICIT_CONTEXTS.some(pattern => pattern.test(lowerText));
  
  if (hasAgeIndicator && hasExplicitContext) {
    return {
      allowed: false,
      reason: 'CRITICAL VIOLATION: Content suggesting minors in explicit contexts is absolutely prohibited.',
      severity: 'critical',
    };
  }
  
  // Age indicators alone are fine (e.g., "child safety system", "teenage character backstory")
  return { allowed: true, severity: 'none' };
}

/**
 * Emergency stop - logs critical violation and throws error
 */
export function emergencyStop(reason: string): never {
  console.error('🚨 CRITICAL CONTENT VIOLATION 🚨');
  console.error(reason);
  console.error('Application stopping to prevent prohibited content generation.');
  
  // Log to file if possible
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `\n\n[${timestamp}] CRITICAL VIOLATION\n${reason}\n`;
    
    const el = getElectron();
    if (el?.fs?.writeTextFile && el?.app?.getSaveFolder) {
      el.app.getSaveFolder().then(saveFolder => {
        const separator = saveFolder.includes('\\') ? '\\' : '/';
        const logPath = `${saveFolder}${separator}VIOLATION_LOG.txt`;
        return el.fs!.writeTextFile!(logPath, logEntry, true); // append
      }).catch(e => {
        console.error('Failed to write violation log:', e);
      });
    }
  } catch (e) {
    console.error('Failed to write violation log:', e);
  }
  
  throw new Error('CRITICAL_CONTENT_VIOLATION: Application stopped due to prohibited content detection.');
}
