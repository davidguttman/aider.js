const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { downloadUv } = require('./get-uv');
const debugLog = require('debug')('aider-js:scripts:postinstall:log');
const debugError = require('debug')('aider-js:scripts:postinstall:error');

async function setup() {
  debugLog('Starting aider-js postinstall setup...');
  try {
    const uvBinPath = await downloadUv();
    // downloadUv should handle logging about making it executable

    const venvPath = path.join(__dirname, '..', '.venv');
    const pythonProjectPath = path.join(__dirname, '..', 'python'); // Path to python project dir
    const pythonVersion = '3.11'; // TODO: Consider making this configurable via package.json

    // Check if venv already seems correctly set up
    const venvMarkerPath = path.join(venvPath, 'aider_js_setup_complete.marker');
    if (fs.existsSync(venvMarkerPath)) {
        debugLog(`Virtual environment at ${venvPath} already appears set up. Skipping creation and installation.`);
        debugLog('aider-js postinstall setup finished successfully (cached).');
        return; // Exit early if setup seems complete
    }

    // Ensure the target directory for venv exists if we proceed
    fs.mkdirSync(path.dirname(venvPath), { recursive: true });

    debugLog(`Creating Python ${pythonVersion} venv at ${venvPath}...`);
    // Use quotes around paths to handle potential spaces
    execSync(`"${uvBinPath}" venv "${venvPath}" --python ${pythonVersion}`, { stdio: 'inherit' });

    // Determine Python executable path within venv
    const venvPythonPath = path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin', 'python' + (process.platform === 'win32' ? '.exe' : ''));

    // Verify python executable exists before proceeding
    if (!fs.existsSync(venvPythonPath)) {
        throw new Error(`Failed to find Python executable after venv creation at ${venvPythonPath}`);
    }

    debugLog(`Syncing Python environment from ${pythonProjectPath}/uv.lock using ${venvPythonPath}...`);
    // Change directory into the python project path and run uv sync.
    // Set VIRTUAL_ENV to make uv sync target the correct environment.
    execSync(`cd "${pythonProjectPath}" && "${uvBinPath}" sync`, {
        stdio: 'inherit',
        env: { ...process.env, VIRTUAL_ENV: venvPath } // Pass VIRTUAL_ENV
    });

    // Explicitly install dependencies from the python project directory into the venv
    debugLog(`Explicitly installing dependencies from ${pythonProjectPath} into ${venvPath}...`);
    execSync(`"${uvBinPath}" pip install --python "${venvPythonPath}" "${pythonProjectPath}"`, {
        stdio: 'inherit'
    });

    // Create a marker file to indicate successful setup
    fs.writeFileSync(venvMarkerPath, 'Setup completed on ' + new Date().toISOString());
    debugLog(`Created setup marker file: ${venvMarkerPath}`);

    debugLog('aider-js postinstall setup finished successfully.');
  } catch (error) {
    debugError('Error during aider-js postinstall setup:', error);
    // Attempt to clean up potentially corrupted venv directory
    const venvPathCleanup = path.join(__dirname, '..', '.venv'); // Use different var name to avoid scope issues
    if (fs.existsSync(venvPathCleanup)) {
        debugLog(`Attempting to clean up potentially incomplete venv at ${venvPathCleanup}...`);
        try {
            fs.rmSync(venvPathCleanup, { recursive: true, force: true });
            debugLog(`Cleaned up ${venvPathCleanup}.`);
        } catch (cleanupError) {
            debugError(`Failed to clean up ${venvPathCleanup}: ${cleanupError.message}`);
        }
    }
    process.exitCode = 1; // Signal failure
  }
}

setup(); 