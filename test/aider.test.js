const test = require('ava')
const path = require('path')
const fs = require('fs/promises')
const os = require('os')
const { execSync } = require('child_process') // <-- Need execSync for git commands
const fsExtra = require('fs-extra')
const { createProxy } = require('echoproxia')
const { runAider } = require('../src/aider')
const debugLog = require('debug')('aider-js:test:log')
const debugError = require('debug')('aider-js:test:error');

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
  debugLog(`Echoproxia setup: recordMode=${recordMode}, recordingsDir=${recordingsDir}`)

  if (recordMode) {
    if (!apiKeyToUse) {
      // Fail fast in record mode if the key is missing, as we need it.
      throw new Error('RECORD_MODE is true, but OPENROUTER_API_KEY is not set in the environment. Cannot record.')
    }
    // Clear recordings directory before recording
    debugLog(`Clearing recordings directory: ${recordingsDir}`)
    try {
      await fsExtra.emptyDir(recordingsDir)
      debugLog('Recordings directory cleared.')
    } catch (err) {
      debugError(`Failed to clear recordings directory: ${err}`)
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
    debugLog(`Echoproxia running in ${recordMode ? 'record' : 'replay'} mode on ${proxy.url}, targeting ${OPENROUTER_TARGET}`)

    // No need to set process.env.OPENAI_API_BASE or process.env.OPENAI_API_KEY here anymore.
    // We will pass them explicitly via runAider options.

  } catch (error) {
    debugError('Failed to start Echoproxia:', error)
    throw error // Fail fast if proxy doesn't start
  }
})

test.after.always(async t => {
  // Stop the proxy server
  if (t.context.proxy && t.context.proxy.stop) {
    await t.context.proxy.stop()
    debugLog('Echoproxia stopped')
  }
  // No environment variables were set in test.before, so none to clean up here.
})

// --- Per-Test Setup and Teardown ---

test.beforeEach(async t => {
  // Create a unique temporary directory for the Git repo
  t.context.tempRepoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-js-repo-test-'))
  debugLog(`Created temp repo directory: ${t.context.tempRepoDir}`)

  // Initialize Git repository
  try {
    execSync('git init', { cwd: t.context.tempRepoDir, stdio: 'pipe' });
    // Configure dummy user for commits
    execSync('git config user.email "test@example.com"', { cwd: t.context.tempRepoDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: t.context.tempRepoDir, stdio: 'pipe' });
    debugLog(`Initialized Git repository in ${t.context.tempRepoDir}`);
  } catch (gitError) {
    debugError('Error initializing git repository:', gitError)
    throw new Error(`Failed to initialize git: ${gitError.message}`)
  }

  // Create an initial file and commit it
  t.context.testFileName = 'test-edit.txt'
  t.context.initialContent = 'hello world'
  const tempFilePath = path.join(t.context.tempRepoDir, t.context.testFileName)
  await fs.writeFile(tempFilePath, t.context.initialContent)
  debugLog(`Created initial file: ${tempFilePath} with content.`);
  try {
    execSync(`git add ${t.context.testFileName}`, { cwd: t.context.tempRepoDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: t.context.tempRepoDir, stdio: 'pipe' });
    debugLog('Committed initial file.');
  } catch (gitError) {
    debugError('Error committing initial file:', gitError)
    throw new Error(`Failed to commit initial file: ${gitError.message}`)
  }

});

test.afterEach.always(async t => {
  // Clean up the temporary repository directory
  if (t.context.tempRepoDir) {
    try {
      await fs.rm(t.context.tempRepoDir, { recursive: true, force: true })
      debugLog(`Cleaned up temp directory: ${t.context.tempRepoDir}`)
    } catch (cleanupError) {
      debugError(`Error cleaning up temp directory ${t.context.tempRepoDir}:`, cleanupError)
      // Don't fail the test for cleanup error, but log it
    }
  }
});

// --- Test Cases Start Here ---

test('Aider should edit a file within the specified repoPath', async t => {
  t.context.proxy.setSequence('file-edit-openrouter') // Sequence name

  const expectedContent = 'goodbye world\n'
  const testFileNameRelative = t.context.testFileName // Already relative to tempRepoDir

  try {
    const result = await runAider({
      prompt: `Change 'hello' to 'goodbye' in the file ${testFileNameRelative}`,
      modelName: modelNameToUse, // e.g., 'openai/gpt-4o-mini'
      repoPath: t.context.tempRepoDir, // <-- Pass the temporary repo path
      editableFiles: [testFileNameRelative], // Pass the relative path
      apiBase: t.context.proxy.url,
      apiKey: apiKeyToUse, // Use the key fetched in test.before (only needed for recording)
      verbose: true
    })

    t.assert(result, 'runAider should return a result object')
    t.assert(typeof result.stdout === 'string', 'Result should have stdout string')
    debugLog('Aider Output (stdout):', result.stdout)
    debugLog('Aider Output (stderr):', result.stderr)

    // Verify file content after aider runs
    const finalContentPath = path.join(t.context.tempRepoDir, testFileNameRelative)
    const finalContent = await fs.readFile(finalContentPath, 'utf-8')
    debugLog(`Final content of ${finalContentPath}: "${finalContent}"`)
    t.is(finalContent, expectedContent, `File content should be '${expectedContent}' after edit`)

    // Optional: Verify git status shows changes (if auto-commits are off)
    const gitStatus = execSync('git status --porcelain', { cwd: t.context.tempRepoDir }).toString().trim();
    debugLog(`Git status in ${t.context.tempRepoDir}: ${gitStatus}`);
    // Expecting 'M test-edit.txt' or similar, indicating modification
    t.true(gitStatus.includes(`M ${testFileNameRelative}`), 'Git status should show the file as modified');

  } catch (error) {
     // Log the error details before failing
     debugError('Error running aider:', error);
     if (error.stderr) {
       debugError('Aider stderr on error:', error.stderr);
     }
     if (error.stdout) {
       debugError('Aider stdout on error:', error.stdout);
     }
     t.fail(`runAider threw an unexpected error: ${error.message}`)
  }
  // No finally needed here, cleanup is handled by test.afterEach.always
})

// Add more test cases here for different scenarios
// - Using files (editable/read-only)
// - Different prompts
// - Error conditions? (e.g., invalid model) - requires recording errors 