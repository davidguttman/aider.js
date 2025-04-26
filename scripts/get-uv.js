// scripts/get-uv.js
const fetch = require('cross-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');
const tar = require('tar');          // For .tar.gz extraction
const unzipper = require('unzipper'); // For .zip extraction
const debugLog = require('debug')('aider-js:scripts:get-uv:log');
const debugError = require('debug')('aider-js:scripts:get-uv:error');

// Function to determine the correct uv target suffix based on platform and arch
function getUvTargetSuffixAndExt() {
  const platform = os.platform(); // 'darwin', 'linux', 'win32'
  const arch = os.arch(); // 'x64', 'arm64'

  let suffix = '';
  let ext = '';

  if (platform === 'darwin') {
    suffix = arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
    ext = '.tar.gz';
  } else if (platform === 'linux') {
    // Assuming glibc for simplicity, might need adjustment for musl
    suffix = arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
    ext = '.tar.gz';
  } else if (platform === 'win32') {
    suffix = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
    ext = '.zip';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  debugLog(`Determined uv target suffix: ${suffix}, extension: ${ext}`);
  return { suffix, ext };
}

async function downloadUv() {
  const releaseUrl = 'https://github.com/astral-sh/uv/releases/latest/download';
  const { suffix: targetSuffix, ext: archiveExt } = getUvTargetSuffixAndExt();
  const archiveFilename = `uv-${targetSuffix}${archiveExt}`;
  const downloadUrl = `${releaseUrl}/${archiveFilename}`;

  const binDir = path.join(__dirname, '..', 'bin');
  const uvExecutableName = process.platform === 'win32' ? 'uv.exe' : 'uv';
  const uvPath = path.join(binDir, uvExecutableName);
  const tempArchivePath = path.join(binDir, archiveFilename); // Store archive temporarily

  if (fs.existsSync(uvPath)) {
    debugLog(`uv binary already exists at ${uvPath}. Skipping download and extraction.`);
    return uvPath;
  }

  debugLog(`Downloading uv archive from ${downloadUrl} to ${tempArchivePath}...`);
  fs.mkdirSync(binDir, { recursive: true });

  let downloadedSuccessfully = false;
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download uv archive (${response.status} ${response.statusText}) from ${downloadUrl}`);
    }

    const fileStream = fs.createWriteStream(tempArchivePath);
    await pipeline(response.body, fileStream);
    downloadedSuccessfully = true;
    debugLog('uv archive downloaded successfully.');

    debugLog(`Extracting ${uvExecutableName} from ${tempArchivePath} to ${binDir}...`);

    if (archiveExt === '.tar.gz') {
      await tar.x({
        file: tempArchivePath,
        cwd: binDir, // Extract directly into binDir
        strip: 1,    // Assumes archive contains a top-level dir like 'uv-aarch64-apple-darwin/'
                     // If it extracts directly, remove strip or set to 0
        filter: (filePath) => filePath.endsWith(uvExecutableName) // Only extract the binary
      });
    } else if (archiveExt === '.zip') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(tempArchivePath)
          .pipe(unzipper.Parse())
          .on('entry', async (entry) => {
            // Inside zip, the path might be like 'uv-x86_64-pc-windows-msvc/uv.exe'
            // Or just 'uv.exe'
            if (entry.path.endsWith(uvExecutableName)) {
              debugLog(`Found ${entry.path}, extracting to ${uvPath}`);
              const writeStream = fs.createWriteStream(uvPath);
              entry.pipe(writeStream)
                 .on('finish', resolve)
                 .on('error', reject);
            } else {
              entry.autodrain(); // Skip other files
            }
          })
          .on('error', reject)
          .on('close', () => {
            // If the binary wasn't found and extracted, we need to signal an error
            if (!fs.existsSync(uvPath)) {
                reject(new Error(`Failed to find ${uvExecutableName} within ${tempArchivePath}`));
            }
          });
      });
    }

    debugLog(`${uvExecutableName} extracted successfully to ${uvPath}.`);

    // Make executable on non-Windows platforms
    if (process.platform !== 'win32') {
      fs.chmodSync(uvPath, 0o755);
      debugLog(`${uvPath} made executable.`);
    }
    return uvPath;

  } catch (error) {
    debugError(`Error during uv download/extraction: ${error.message}`);
    // Attempt cleanup
    if (fs.existsSync(uvPath)) {
      try { fs.unlinkSync(uvPath); } catch (e) { debugError(`Cleanup error (uv): ${e.message}`); }
    }
    throw error; // Re-throw the error
  } finally {
    // Clean up the downloaded archive regardless of success/failure
    if (downloadedSuccessfully && fs.existsSync(tempArchivePath)) {
      try {
        fs.unlinkSync(tempArchivePath);
        debugLog(`Cleaned up temporary archive ${tempArchivePath}.`);
      } catch (cleanupError) {
        debugError(`Error cleaning up archive file: ${cleanupError.message}`);
      }
    }
  }
}

module.exports = { downloadUv }; 