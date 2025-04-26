# aider-js

[![NPM version](https://img.shields.io/npm/v/aider-js.svg)](https://www.npmjs.com/package/aider-js) 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js wrapper for the [Aider](https://github.com/Aider-AI/aider) tool using a self-contained Python environment via [uv](https://github.com/astral-sh/uv).

This package allows you to easily integrate Aider's AI coding capabilities into your Node.js projects without needing to manage Python environments or dependencies manually.

## Features

*   Provides a simple `runAider(options)` function.
*   Automatically downloads the `uv` binary during installation.
*   Creates an isolated Python virtual environment using `uv`.
*   Installs `aider-chat` within the isolated environment.
*   Handles communication with the Aider process.

## Installation

```bash
npm install aider-js
```

The `postinstall` script will automatically download the necessary `uv` binary for your platform and set up the Python environment with `aider-chat`.

## Usage

```javascript
const { runAider } = require('aider-js');

async function main() {
  try {
    // Required options: prompt, apiKey, apiBase, modelName
    // Optional: editableFiles (array), readOnlyFiles (array), verbose (boolean)
    const result = await runAider({
      // Files that Aider can modify
      editableFiles: ['src/app.js', 'src/utils.js'], 
      // Files Aider can read but not modify
      readOnlyFiles: ['docs/architecture.md'], 
      // The instruction/prompt for Aider
      prompt: 'Refactor the main function in app.js based on the architecture doc.',
      // The name of the model to use (e.g., 'gpt-4o', 'claude-3-opus-20240229')
      // This will be automatically prefixed with 'openai/' internally 
      // to ensure compatibility with aider-chat's handling of custom API bases.
      modelName: 'gpt-4o-mini', 
      // Your API key (e.g., OpenRouter key)
      apiKey: process.env.OPENROUTER_API_KEY, 
      // The API base URL (e.g., OpenRouter endpoint)
      apiBase: 'https://openrouter.ai/api/v1', 
      // (Optional) Set to true for more verbose logging from the Python script
      verbose: false 
    });
    
    // Output from the aider process
    console.log('Aider completed successfully.');
    // Aider's stdout (contains diffs, chat messages, etc.)
    console.log('Stdout:\n', result.stdout); 
    // Aider's stderr (contains informational logs, warnings, errors from Python)
    console.log('Stderr:\n', result.stderr); 
  } catch (error) {
    console.error('Error running Aider:', error);
    // error.stderr and error.stdout might contain additional context
    if (error.stderr) {
      console.error('Stderr from failed run:\n', error.stderr);
    }
  }
}

main();
```

The `runAider` function accepts an options object. See the example above for required and optional parameters. It returns a Promise that resolves with an object containing `stdout` and `stderr` from the Aider process, or rejects with an error if the process fails.

## How it Works

1.  **Postinstall:** When you install `aider-js`, the `postinstall` script in `scripts/postinstall.js` runs.
2.  **Download uv:** The script calls `scripts/get-uv.js` to download the appropriate `uv` binary for your operating system and architecture from the [uv releases](https://github.com/astral-sh/uv/releases) into the package's `bin/` directory.
3.  **Create venv:** It uses the downloaded `uv` binary to create a Python virtual environment (venv) in the package's `.venv/` directory, specifying a compatible Python version (defined in `python/pyproject.toml`).
4.  **Install Aider:** It uses `uv pip install` to install `aider-chat` (and its dependencies) into the created venv, based on the configuration in `python/pyproject.toml`.
5.  **Execution (`runAider`):** 
    *   The `runAider` function in `src/aider.js` gathers the provided options (`prompt`, `editableFiles`, `readOnlyFiles`, `modelName`, `apiKey`, `apiBase`, `verbose`).
    *   It **prepends `openai/`** to the `modelName`. This is crucial for telling `aider-chat` to use the provided `apiBase` and `apiKey`, even for non-OpenAI models hosted elsewhere (like OpenRouter).
    *   It bundles these options into a **JSON string**.
    *   It locates the Python executable within the package's `.venv/` directory and the `aider_entrypoint.py` script in `python/`.
    *   It spawns `aider_entrypoint.py` as a child process, passing the **JSON string as a single command-line argument**.
6.  **Python Script (`aider_entrypoint.py`):**
    *   The Python script parses the incoming JSON configuration.
    *   It sets the `OPENAI_API_KEY` and `OPENAI_API_BASE` environment variables using the values from the JSON.
    *   It initializes the Aider `Coder` with the specified model, files (`editableFiles`, `readOnlyFiles`), and other settings.
    *   It calls `coder.run()` with the provided `prompt`.
    *   Aider's output (diffs, chat) is captured from the process's stdout/stderr back in Node.js.

## Development & Testing

*   **Cleanup:** `npm run cleanup` (removes downloaded `uv` and the `.venv` directory)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[MIT](LICENSE) © [David Guttman](http://davidguttman.com/) 