const test = require('ava')
const path = require('path')
const fs = require('fs/promises')
const os = require('os')
const fsExtra = require('fs-extra')
const { createProxy } = require('echoproxia')
const { runAider } = require('../src/aider')

// Determine mode based on environment
const recordMode = process.env.RECORD_MODE === 'true'
const recordingsDir = path.join(__dirname, '__recordings__')

// --- Configuration for API Interaction ---
const OPENROUTER_TARGET = 'https://openrouter.ai/api/v1'
const apiKeyToUse = process.env.OPENROUTER_API_KEY
// Model name *without* provider prefix for input
const modelNameToUse = 'openai/gpt-4o-mini'
// --- End Configuration ---

test.before(async t => {
  console.log(`Echoproxia setup: recordMode=${recordMode}, recordingsDir=${recordingsDir}`)

  if (recordMode) {
    if (!apiKeyToUse) {
      // Fail fast in record mode if the key is missing, as we need it.
      throw new Error('RECORD_MODE is true, but OPENROUTER_API_KEY is not set in the environment. Cannot record.')
    }
    // Clear recordings directory before recording
    console.log(`Clearing recordings directory: ${recordingsDir}`)
    try {
      await fsExtra.emptyDir(recordingsDir)
      console.log('Recordings directory cleared.')
    } catch (err) {
      console.error(`Failed to clear recordings directory: ${err}`)
      throw err // Stop if we can't clear recordings
    }
  }

  try {
    const proxy = await createProxy({
      targetUrl: OPENROUTER_TARGET, // Proxy will target OpenRouter
      recordingsDir: recordingsDir,
      recordMode: recordMode,
      // Redact OpenRouter key header ('HTTP-Authorization') and standard ones
      redactHeaders: ['authorization', 'openai-api-key', 'api-key', 'http-authorization']
    })
    t.context.proxy = proxy
    console.log(`Echoproxia running in ${recordMode ? 'record' : 'replay'} mode on ${proxy.url}, targeting ${OPENROUTER_TARGET}`)

    // No need to set process.env.OPENAI_API_BASE or process.env.OPENAI_API_KEY here anymore.
    // We will pass them explicitly via runAider options.

  } catch (error) {
    console.error('Failed to start Echoproxia:', error)
    throw error // Fail fast if proxy doesn't start
  }
})

test.after.always(async t => {
  // Stop the proxy server
  if (t.context.proxy && t.context.proxy.stop) {
    await t.context.proxy.stop()
    console.log('Echoproxia stopped')
  }
  // No environment variables were set in test.before, so none to clean up here.
})

// --- Test Cases Start Here ---

test('Aider should edit a file via proxy using apiBase/apiKey options', async t => {
  t.context.proxy.setSequence('file-edit-openrouter') // New sequence name

  // Create a temporary file for editing
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-js-test-'))
  const tempFilePath = path.join(tempDir, 'test-edit.txt')
  const initialContent = 'hello world'
  const expectedContent = 'goodbye world\n'
  await fs.writeFile(tempFilePath, initialContent)
  console.log(`Created temp file: ${tempFilePath} with initial content.`)

  try {
    const result = await runAider({
      prompt: `Change 'hello' to 'goodbye' in the file ${path.basename(tempFilePath)}`,
      modelName: modelNameToUse, // e.g., 'openai/gpt-4o-mini'
      editableFiles: [tempFilePath], // Pass the full path
      apiBase: t.context.proxy.url,
      apiKey: apiKeyToUse,
      verbose: true
    })

    t.assert(result, 'runAider should return a result object')
    t.assert(typeof result.stdout === 'string', 'Result should have stdout string')
    console.log('Aider Output (stdout):', result.stdout)
    console.log('Aider Output (stderr):', result.stderr)

    // Verify file content after aider runs
    const finalContent = await fs.readFile(tempFilePath, 'utf-8')
    console.log(`Final content of ${tempFilePath}: "${finalContent}"`)
    t.is(finalContent, expectedContent, `File content should be '${expectedContent}' after edit`)

  } catch (error) {
     // Log the error details before failing
     console.error('Error running aider:', error);
     if (error.stderr) {
       console.error('Aider stderr on error:', error.stderr);
     }
     if (error.stdout) {
       console.error('Aider stdout on error:', error.stdout);
     }
     t.fail(`runAider threw an unexpected error: ${error.message}`)
  } finally {
    // Clean up the temporary directory and file
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
      console.log(`Cleaned up temp directory: ${tempDir}`)
    } catch (cleanupError) {
      console.error(`Error cleaning up temp directory ${tempDir}:`, cleanupError)
      // Don't fail the test for cleanup error, but log it
    }
  }
})

// Add more test cases here

// Add more test cases here for different scenarios
// - Using files (editable/read-only)
// - Different prompts
// - Error conditions? (e.g., invalid model) - requires recording errors 