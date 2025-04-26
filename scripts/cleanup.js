const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define paths relative to the script's location (inside aider-js/scripts)
const baseDir = path.join(__dirname, '..'); // aider-js directory
const venvPath = path.join(baseDir, '.venv');
const pythonVenvPath = path.join(baseDir, 'python', '.venv'); // Erroneous one
const pythonBuildPath = path.join(baseDir, 'python', 'build');
const pythonEggInfoPattern = path.join(baseDir, 'python', '*.egg-info'); // Pattern for egg-info
const binPath = path.join(baseDir, 'bin');
const markerPath = path.join(venvPath, 'aider_js_setup_complete.marker');

function cleanup() {
    console.log('Starting aider-js cleanup...');

    // Find egg-info directories matching the pattern
    const eggInfoDirs = glob.sync(pythonEggInfoPattern);

    const pathsToRemove = [
        { path: markerPath, type: 'file', label: 'Marker file' },
        { path: venvPath, type: 'dir', label: 'Main .venv directory' },
        { path: pythonVenvPath, type: 'dir', label: 'Python .venv directory' },
        { path: pythonBuildPath, type: 'dir', label: 'Python build directory' },
        ...eggInfoDirs.map(p => ({ path: p, type: 'dir', label: 'Python egg-info directory' })), // Add found egg-info dirs
        { path: binPath, type: 'dir', label: 'bin directory (uv)' },
    ];

    for (const item of pathsToRemove) {
        try {
            if (fs.existsSync(item.path)) {
                if (item.type === 'dir') {
                    fs.rmSync(item.path, { recursive: true, force: true });
                    console.log(`Removed directory: ${item.path} (${item.label})`);
                } else {
                    fs.unlinkSync(item.path);
                    console.log(`Removed file: ${item.path} (${item.label})`);
                }
            } else {
                console.log(`Skipped (not found): ${item.path} (${item.label})`);
            }
        } catch (error) {
            console.error(`Error removing ${item.path} (${item.label}):`, error.message);
        }
    }

    console.log('Cleanup finished.');
}

cleanup(); 