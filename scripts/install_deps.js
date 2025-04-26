const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { downloadUv } = require('./get-uv');

async function setup() {
  console.log('Starting aider-js postinstall setup...');
  try {
    const uvBinPath = await downloadUv();
    // downloadUv should handle making it executable now
    // console.log(`Making ${uvBinPath} executable...`);
    // fs.chmodSync(uvBinPath, 0o755);

    const venvPath = path.join(__dirname, '..', '.venv');
    const pythonProjectPath = path.join(__dirname, '..', 'python'); // Path to python project dir
    const pythonVersion = '3.11'; // TODO: Consider making this configurable via package.json

    // Check if venv already seems correctly set up
    const venvMarkerPath = path.join(venvPath, 'aider_js_setup_complete.marker');
    if (fs.existsSync(venvMarkerPath)) {
        console.log(`Virtual environment at ${venvPath} already appears set up. Skipping creation and installation.`);
        console.log('aider-js postinstall setup finished successfully (cached).');
        return; // Exit early if setup seems complete
    }

    // Ensure the target directory for venv exists if we proceed
    fs.mkdirSync(path.dirname(venvPath), { recursive: true });

    console.log(`Creating Python ${pythonVersion} venv at ${venvPath}...`);
    // Use quotes around paths to handle potential spaces
    execSync(`"${uvBinPath}" venv "${venvPath}" --python ${pythonVersion}`, { stdio: 'inherit' });

    // Determine Python executable path within venv
    const venvPythonPath = path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin', 'python' + (process.platform === 'win32' ? '.exe' : ''));

    // Verify python executable exists before proceeding
    if (!fs.existsSync(venvPythonPath)) {
        throw new Error(`Failed to find Python executable after venv creation at ${venvPythonPath}`);
    }

    console.log(`Syncing Python dependencies from ${pythonProjectPath} into ${venvPath}...`);
    // Sync dependencies defined in pyproject.toml into the specific virtual environment
    // Use quotes around paths
    execSync(`"${uvBinPath}" sync --python "${venvPythonPath}"`, {
        cwd: pythonProjectPath, // Run command inside the python directory
        stdio: 'inherit'
    });

    // Create a marker file to indicate successful setup
    fs.writeFileSync(venvMarkerPath, 'Setup completed on ' + new Date().toISOString());

    console.log('aider-js postinstall setup finished successfully.');
  } catch (error) {
    console.error('Error during aider-js postinstall setup:', error);
    // Attempt to clean up potentially corrupted venv directory
    const venvPath = path.join(__dirname, '..', '.venv');
    if (fs.existsSync(venvPath)) {
        console.log(`Attempting to clean up potentially incomplete venv at ${venvPath}...`);
        try {
            fs.rmSync(venvPath, { recursive: true, force: true });
            console.log(`Cleaned up ${venvPath}.`);
        } catch (cleanupError) {
            console.error(`Failed to clean up ${venvPath}: ${cleanupError.message}`);
        }
    }
    process.exitCode = 1; // Signal failure
  }
}

setup(); 