const path = require('path')
const { runAider } = require('./src/aider')

// --- IMPORTANT: API Keys ---
// By default, API keys are read from environment variables:
// export OPENAI_API_KEY=sk-...
// export OPENROUTER_API_KEY=sk-or-...
// export ANTHROPIC_API_KEY=sk-ant-...
// etc.
//
// However, IF you provide the 'apiBase' option (for using a proxy or specific
// endpoint like OpenRouter), you ALSO have the option to provide an 'apiKey'
// directly in the options. If you provide both 'apiBase' and 'apiKey', the
// value of 'apiKey' will be used as the OPENAI_API_KEY for that specific call,
// overriding any OPENAI_API_KEY environment variable.
// If you provide 'apiBase' but NOT 'apiKey', it will fall back to using the
// OPENAI_API_KEY environment variable (which MUST be set in that case).

// Options for runAider
const options = {
  prompt: 'explain the file example.js', // REQUIRED: The user's instruction to Aider
  modelName: 'openai/gpt-4o-mini', // REQUIRED: e.g., 'gpt-4o', 'openai/gpt-4o-mini', 'claude-3-opus-20240229'
  repoPath: path.resolve(__dirname), // REQUIRED: Path to the git repository Aider should operate in. Here, we use the current project directory.
  // For a different repository, use: path.resolve('../path/to/other/repo')
  editableFiles: [], // Optional: List of files Aider can edit, relative to repoPath
  readOnlyFiles: ['example.js'], // Optional: List of files Aider can read, relative to repoPath
  verbose: true, // Optional: Set to true for more detailed Aider output

  // --- Optional: apiBase and apiKey ---
  // Use these together for proxies or custom endpoints like OpenRouter.
  // If apiBase is provided, modelName is prefixed with 'openai/' internally.
  // If apiBase is provided, EITHER apiKey below OR OPENAI_API_KEY env var must exist.
  apiBase: 'https://openrouter.ai/api/v1', // Example for OpenRouter
  // apiKey: 'sk-or-xxxxxx', // Provide key here to override OPENAI_API_KEY env var for this call
                            // If commented out, OPENAI_API_KEY env var MUST be set.

  // cwd: path.join(__dirname, 'test') // Example CWD, adjust if needed
  // Note: cwd is NOT used by runAider; use repoPath instead.
}

async function main () {
  console.log('Attempting to run aider via runAider...')
  // Simplified warning check - the main validation is now in runAider
  if (options.apiBase && !options.apiKey && !process.env.OPENAI_API_KEY) {
    console.error('Error: apiBase is provided, but neither apiKey option nor OPENAI_API_KEY env var is set.')
    process.exitCode = 1
    return
  }
  if (!options.apiBase && !process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.warn('Warning: No apiBase provided and no common API key environment variables detected.')
    console.warn('Please set the appropriate environment variable for your model provider.')
  }

  try {
    const result = await runAider(options)
    console.log('runAider completed.')
    // Access stdout and stderr from the result object
    console.log('--- Stdout ---')
    console.log(result.stdout)
    console.log('--- Stderr ---')
    console.log(result.stderr)
  } catch (error) {
    console.error('Error running aider:', error)
    process.exitCode = 1
  }
}

main() 