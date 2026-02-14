/**
 * Downloads the standalone Ollama Windows binary (ollama-windows-amd64.zip)
 * from GitHub releases and extracts it to resources/ollama-win/.
 *
 * Usage: node scripts/download-ollama.cjs [version]
 * Example: node scripts/download-ollama.cjs v0.15.5
 *
 * If no version is specified, downloads the latest release.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEST_DIR = path.join(__dirname, '..', 'resources', 'ollama-win');
const ZIP_NAME = 'ollama-windows-amd64.zip';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'project-omen' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers: { 'User-Agent': 'project-omen' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastPct = -1;

      const file = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalBytes > 0) {
          const pct = Math.floor((downloaded / totalBytes) * 100);
          if (pct !== lastPct && pct % 5 === 0) {
            lastPct = pct;
            const mb = (downloaded / 1024 / 1024).toFixed(1);
            const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
            process.stdout.write(`\r  ${pct}% (${mb} / ${totalMb} MB)`);
          }
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('\n  Download complete.');
        resolve();
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function getLatestVersion() {
  console.log('Fetching latest Ollama release version...');
  const res = await fetch('https://api.github.com/repos/ollama/ollama/releases/latest');
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  const data = JSON.parse(Buffer.concat(chunks).toString());
  console.log(`Latest version: ${data.tag_name}`);
  return data.tag_name;
}

async function main() {
  // Skip download if ollama.exe already exists (use --force to re-download)
  const exeCheck = path.join(DEST_DIR, 'ollama.exe');
  if (fs.existsSync(exeCheck) && !process.argv.includes('--force')) {
    console.log('Ollama binary already present, skipping download. Use --force to re-download.');
    return;
  }

  const version = process.argv.find(a => a.startsWith('v')) || await getLatestVersion();
  const downloadUrl = `https://github.com/ollama/ollama/releases/download/${version}/${ZIP_NAME}`;
  const zipPath = path.join(__dirname, '..', ZIP_NAME);

  // Clean destination
  if (fs.existsSync(DEST_DIR)) {
    console.log(`Cleaning existing ${DEST_DIR}...`);
    fs.rmSync(DEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });

  // Download
  await downloadFile(downloadUrl, zipPath);

  // Extract using PowerShell (available on all modern Windows)
  console.log(`Extracting to ${DEST_DIR}...`);
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${DEST_DIR}' -Force"`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    console.error('Failed to extract. Make sure PowerShell is available.');
    throw err;
  }

  // Clean up zip
  fs.unlinkSync(zipPath);

  // Verify ollama.exe exists
  const exePath = path.join(DEST_DIR, 'ollama.exe');
  if (fs.existsSync(exePath)) {
    console.log(`\nSuccess! Ollama binary ready at: ${exePath}`);
  } else {
    // Check if extracted into a subdirectory
    const entries = fs.readdirSync(DEST_DIR);
    console.log(`\nExtracted contents: ${entries.join(', ')}`);
    console.log('Note: ollama.exe may be in a subdirectory. Check the structure.');
  }

  console.log('\nOllama binary ready for packaging.');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
