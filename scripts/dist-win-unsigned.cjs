const { spawnSync } = require('node:child_process');

function main() {
  const cleanedEnv = { ...process.env };

  // Ensure electron-builder won't attempt to sign during packaging.
  // (If these are set, electron-builder can trigger signing flows that download winCodeSign.)
  for (const key of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'CSC_NAME',
    'CSC_IDENTITY_AUTO_DISCOVERY',
    'WIN_CSC_LINK',
    'WIN_CSC_KEY_PASSWORD',
    'WIN_CSC_SUBJECT_NAME',
  ]) {
    delete cleanedEnv[key];
  }

  // Also explicitly disable identity auto-discovery for this run.
  cleanedEnv.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

  const res = spawnSync('npm', ['run', 'dist'], {
    stdio: 'inherit',
    env: cleanedEnv,
    shell: true,
  });

  process.exit(res.status ?? 1);
}

main();
