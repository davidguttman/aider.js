const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const PYTHON_SCRIPT_PATH = path.join(__dirname, '..', 'python', 'aider_entrypoint.py')
const venvBinDir = path.join(__dirname, '..', '.venv', process.platform === 'win32' ? 'Scripts' : 'bin')
const PYTHON_EXECUTABLE = path.join(venvBinDir, 'python' + (process.platform === 'win32' ? '.exe' : ''))

async function runAider (options) {
  // --- Input Validation and Defaults ---
  const { prompt, editableFiles, readOnlyFiles, modelName, apiBase, apiKey, verbose } = options

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

  // --- Prepare Python Options ---
  const aiderModelName = apiBase ? `openai/${modelName}` : modelName

  const pythonOptions = {
    prompt,
    editableFiles: editableFiles || [],
    readOnlyFiles: readOnlyFiles || [],
    modelName: aiderModelName,
    ...(apiBase && { apiBase }),
    verbose: verbose || false
  }

  return new Promise((resolve, reject) => {
    const optionsJson = JSON.stringify(pythonOptions)

    // Check if Python executable exists before spawning
    if (!fs.existsSync(PYTHON_EXECUTABLE)) {
        return reject(new Error(`Python executable not found at ${PYTHON_EXECUTABLE}. The postinstall script might have failed or the .venv directory was not included.`));
    }

    console.log(`Executing: ${PYTHON_EXECUTABLE} ${PYTHON_SCRIPT_PATH} with options:`, JSON.stringify(pythonOptions, null, 2))

    // Prepare environment for the Python script
    const pythonEnv = { ...process.env }
    if (apiBase && apiKey) {
      pythonEnv.OPENAI_API_KEY = apiKey
      console.log('Using provided apiKey option as OPENAI_API_KEY for the Python process because apiBase was also provided.')
    } else if (apiBase) {
      console.log('Using process.env.OPENAI_API_KEY for the Python process because apiBase was provided.')
    }

    const pythonProcess = spawn(
      PYTHON_EXECUTABLE,
      [PYTHON_SCRIPT_PATH, optionsJson],
      {
        stdio: 'pipe',
        env: pythonEnv
      }
    )

    let stdoutData = ''
    let stderrData = ''

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString()
      console.log(`aider_entrypoint.py stdout: ${data}`)
    })

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString()
      console.error(`aider_entrypoint.py stderr: ${data}`)
    })

    pythonProcess.on('close', (code) => {
      console.log(`aider_entrypoint.py process exited with code ${code}`)
      if (code === 0) {
        resolve({ stdout: stdoutData, stderr: stderrData })
      } else {
        const error = new Error(`Python script exited with code ${code}`)
        error.stderr = stderrData
        error.stdout = stdoutData
        reject(error)
      }
    })

    pythonProcess.on('error', (err) => {
      console.error('Failed to start subprocess.', err)
      reject(err)
    })
  })
}

module.exports = { runAider }
