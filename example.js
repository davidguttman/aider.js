const path = require('path')
const { runAider } = require('./src/aider')

// Options required by src/aider.js
// Replace placeholder values with actual credentials/config
const options = {
  prompt: 'explain the file example.js', // The user's instruction to Aider
  editableFiles: [], // Optional: List of files Aider can edit
  readOnlyFiles: ['example.js'], // Optional: List of files Aider can read
  modelName: 'openai/gpt-4o-mini', // REQUIRED: e.g., 'gpt-4o' or 'anthropic/claude-3-opus' via OpenRouter
  apiKey: 'sk-or-1234567890', // REQUIRED: Your API key (e.g., OpenRouter sk-or-...)
  apiBase: 'https://openrouter.ai/api/v1', // REQUIRED: API base URL (e.g., https://openrouter.ai/api/v1)
  verbose: true, // Optional: Set to true for more detailed Aider output
  // cwd: path.join(__dirname, 'test') // Example CWD, adjust if needed
  // Add other necessary minimal options based on runAider requirements if any
}

async function main () {
  console.log('Attempting to run aider via runAider...')
  try {
    const result = await runAider(options)
    console.log('runAider completed.')
    console.log('Output:', result.output) // Assuming runAider resolves with an object containing output
    console.log('Exit Code:', result.exitCode)
  } catch (error) {
    console.error('Error running aider:', error)
    process.exitCode = 1
  }
}

main() 