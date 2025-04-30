const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const debugLog = require('debug')('aider-js:src:log')
const debugError = require('debug')('aider-js:src:error')

const PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'python', 'aider_entrypoint.py')
const venvBinDir = path.join(__dirname, '..', '.venv', process.platform === 'win32' ? 'Scripts' : 'bin')
const PYTHON_EXECUTABLE = path.join(venvBinDir, 'python' + (process.platform === 'win32' ? '.exe' : ''))

async function runAider (options) {
  // --- Input Validation and Defaults ---
  const { prompt, editableFiles, readOnlyFiles, modelName, apiBase, apiKey, verbose, repoPath } = options

  if (!prompt) {
    return Promise.reject(new Error("'prompt' is a required option"))
  }
  if (!modelName) {
    return Promise.reject(new Error("'modelName' is a required option"))
  }
  if (apiBase && !apiKey && !process.env.OPENAI_API_KEY) {
    return Promise.reject(new Error(
      "When 'apiBase' is provided, you must also provide either the 'apiKey' option or set the 'OPENAI_API_KEY' environment variable."
    ))
  }
  // --- repoPath Validation ---
  if (!repoPath) {
    return Promise.reject(new Error("'repoPath' (target directory) is a required option."))
  }
  try {
    // Use asynchronous stat for validation
    const stats = await fs.promises.stat(repoPath);
    if (!stats.isDirectory()) {
      return Promise.reject(new Error(`repoPath '${repoPath}' is not a directory.`));
    }
    // Optional: Check for .git (consider adding a warning if desired, as per Plan 01a)
    // const gitDir = path.join(repoPath, '.git');
    // try {
    //   await fs.promises.access(gitDir);
    // } catch (err) {
    //   debugLog(`Warning: Target directory '${repoPath}' does not appear to contain a .git directory.`);
    // }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return Promise.reject(new Error(`repoPath '${repoPath}' does not exist.`));
    }
    // Re-throw other errors (like permission errors)
    return Promise.reject(err);
  }
  // --- End repoPath Validation ---

  // --- Prepare Python Options ---
  const aiderModelName = apiBase ? `openai/${modelName}` : modelName

  const pythonOptions = {
    prompt,
    editableFiles: editableFiles || [],
    readOnlyFiles: readOnlyFiles || [],
    modelName: aiderModelName,
    repoPath,
    ...(apiBase && { apiBase }),
    verbose: verbose || false
  }

  return new Promise((resolve, reject) => {
    const optionsJson = JSON.stringify(pythonOptions)

    // Check if Python executable exists before spawning
    if (!fs.existsSync(PYTHON_EXECUTABLE)) {
      const errorMsg = `Python executable not found at ${PYTHON_EXECUTABLE}. The postinstall script might have failed or the .venv directory was not included.`
      debugError(errorMsg) // Log error using debug
      return reject(new Error(errorMsg))
    }

    debugLog(`Executing: ${PYTHON_EXECUTABLE} ${PYTHON_SCRIPT_PATH} with options: %O`, pythonOptions)

    // Prepare environment for the Python script
    const pythonEnv = { ...process.env }
    if (apiBase && apiKey) {
      pythonEnv.OPENAI_API_KEY = apiKey
      debugLog('Using provided apiKey option as OPENAI_API_KEY for the Python process because apiBase was also provided.')
    } else if (apiBase) {
      // Note: OPENAI_API_KEY should be present in process.env due to validation above
      debugLog('Using process.env.OPENAI_API_KEY for the Python process because apiBase was provided.')
    }

    const pythonProcess = spawn(
      PYTHON_EXECUTABLE,
      [PYTHON_SCRIPT_PATH, optionsJson],
      {
        stdio: 'pipe',
        env: pythonEnv,
        cwd: repoPath
      }
    )

    let stdoutData = ''
    let stderrData = ''

    pythonProcess.stdout.on('data', (data) => {
      const stdoutChunk = data.toString()
      stdoutData += stdoutChunk
      // Log each chunk as it arrives
      debugLog(`aider_entrypoint.py stdout: ${stdoutChunk.trim()}`)
    })

    pythonProcess.stderr.on('data', (data) => {
      const stderrChunk = data.toString()
      stderrData += stderrChunk
      // Log each chunk as it arrives
      debugError(`aider_entrypoint.py stderr: ${stderrChunk.trim()}`)
    })

    pythonProcess.on('close', (code) => {
      debugLog(`aider_entrypoint.py process exited with code ${code}`)
      if (code === 0) {
        resolve({ stdout: stdoutData, stderr: stderrData })
      } else {
        const error = new Error(`Python script exited with code ${code}`)
        error.stderr = stderrData
        error.stdout = stdoutData
        // Log the combined stderr before rejecting
        if (stderrData.trim()) {
          debugError(`Combined aider_entrypoint.py stderr on exit(${code}):\n${stderrData.trim()}`)
        }
        reject(error)
      }
    })

    pythonProcess.on('error', (err) => {
      debugError('Failed to start subprocess.', err)
      reject(err)
    })
  })
}

module.exports = { runAider }
