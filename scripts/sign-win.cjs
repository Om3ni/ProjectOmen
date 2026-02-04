const { execFileSync, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

function findSigntool() {
  function canExecute(cmd) {
    try {
      const res = spawnSync(cmd, ['/?'], { stdio: 'ignore' });
      // signtool frequently returns non-zero for help output; any status without ENOENT is fine.
      return !res.error;
    } catch {
      return false;
    }
  }

  const candidates = [];

  // Common Windows SDK location (not always on PATH)
  const kitsRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (existsSync(kitsRoot)) {
    // Prefer newest-ish known version folder names; fall back to a wildcard-ish list.
    // We can't glob without extra deps, so try a few typical versions.
    const versions = [
      '10.0.26100.0',
      '10.0.22621.0',
      '10.0.22000.0',
      '10.0.19041.0',
    ];
    for (const v of versions) {
      candidates.push(path.join(kitsRoot, v, 'x64', 'signtool.exe'));
      candidates.push(path.join(kitsRoot, v, 'x86', 'signtool.exe'));
    }
    // Also try App Certification Kit path (sometimes present)
    candidates.push('C:\\Program Files (x86)\\Windows Kits\\10\\App Certification Kit\\signtool.exe');
  }

  // Finally, try PATH
  candidates.push('signtool.exe');

  for (const c of candidates) {
    if (existsSync(c) || c.toLowerCase() === 'signtool.exe') {
      if (canExecute(c)) return c;
    }
  }

  return null;
}

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

function resolvePfx() {
  const pfx = getEnv('WIN_CSC_LINK') || getEnv('CSC_LINK');
  if (!pfx) return null;

  // electron-builder supports CSC_LINK being a URL; we only support file path here.
  const resolved = path.isAbsolute(pfx) ? pfx : path.resolve(process.cwd(), pfx);
  return resolved;
}

function main() {
  const signtool = findSigntool();
  if (!signtool) {
    console.error('signtool.exe not found. Install Windows 10/11 SDK (Signing Tools) or add signtool.exe to PATH.');
    process.exit(2);
  }

  const pfxPath = resolvePfx();
  const pfxPassword = getEnv('WIN_CSC_KEY_PASSWORD') || getEnv('CSC_KEY_PASSWORD');

  if (!pfxPath || !existsSync(pfxPath)) {
    console.error(`PFX not found. Set WIN_CSC_LINK (or CSC_LINK) to an existing .pfx file. Got: ${pfxPath ?? '(unset)'}`);
    process.exit(2);
  }
  if (!pfxPassword) {
    console.error('PFX password missing. Set WIN_CSC_KEY_PASSWORD (or CSC_KEY_PASSWORD).');
    process.exit(2);
  }

  const releaseDir = path.resolve(process.cwd(), 'release');
  if (!existsSync(releaseDir)) {
    console.error(`Release folder not found: ${releaseDir}. Run npm run dist first.`);
    process.exit(2);
  }

  const targets = [];

  // Sign the main exe in win-unpacked
  const unpackedExe = path.join(releaseDir, 'win-unpacked', 'Project Omen.exe');
  if (existsSync(unpackedExe)) targets.push(unpackedExe);

  // Sign any top-level installer exe(s)
  // electron-builder typically outputs: "Project Omen Setup <version>.exe"
  // We’ll just sign all .exe in release root.
  const { readdirSync } = require('node:fs');
  for (const name of readdirSync(releaseDir)) {
    if (name.toLowerCase().endsWith('.exe')) targets.push(path.join(releaseDir, name));
  }

  if (targets.length === 0) {
    console.error('No .exe targets found to sign under release/.');
    process.exit(2);
  }

  // Timestamp server improves trust. If offline, signing still works but without timestamp.
  const timestampUrl = getEnv('CSC_TIMESTAMP_SERVER') || 'http://timestamp.digicert.com';
  const strictVerify = (() => {
    const v = getEnv('SIGN_VERIFY_STRICT');
    return v === '1' || v === 'true' || v === 'yes';
  })();

  for (const file of targets) {
    console.log(`Signing: ${file}`);
    const args = [
      'sign',
      '/fd',
      'sha256',
      '/f',
      pfxPath,
      '/p',
      pfxPassword,
      '/tr',
      timestampUrl,
      '/td',
      'sha256',
      // append signature if already signed
      '/as',
      file,
    ];

    execFileSync(signtool, args, { stdio: 'inherit' });
  }

  // Verify signatures
  for (const file of targets) {
    console.log(`Verifying: ${file}`);
    try {
      execFileSync(signtool, ['verify', '/pa', '/v', file], { stdio: 'inherit' });
    } catch (e) {
      if (strictVerify) throw e;

      console.warn(
        'Verification did not pass Windows trust checks. This is expected for self-signed/dev certificates; the file is still signed.'
      );
    }
  }

  console.log('Signing complete.');
}

main();
