# @dguttman/aider-js

[![NPM version](https://img.shields.io/npm/v/@dguttman/aider-js.svg)](https://www.npmjs.com/package/@dguttman/aider-js) 
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
npm install @dguttman/aider-js
```

The `postinstall` script will automatically download the necessary `uv` binary for your platform and set up the Python environment with `aider-chat`.

## Usage

**API Keys:**

*   **Default Behavior:** By default, `runAider` expects API keys (e.g., `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`) to be set as **environment variables** in the Node.js process. These are automatically passed down to the underlying Aider Python process.
*   **Using `apiBase`:** If you provide the optional `apiBase` option (for proxies or custom endpoints like OpenRouter), you have two choices for the API key:
    1.  **Set `OPENAI_API_KEY` Environment Variable:** If `apiBase` is provided and the `apiKey` option (see below) is *not* used, the `OPENAI_API_KEY` environment variable **must** be set. Aider uses this specific environment variable when `apiBase` is involved, even for non-OpenAI models.
    2.  **Use `apiKey` Option:** Alternatively, if `apiBase` is provided, you can *also* provide the optional `apiKey` string directly in the `runAider` options. If you do this, the value of the `apiKey` option will be used as the `OPENAI_API_KEY` for the Python process *for that specific call*, overriding any `OPENAI_API_KEY` environment variable that might also be set.

**In summary:** Use environment variables for keys by default. Only use the `apiKey` option *if* you are also using `apiBase` *and* you want to specify the key directly for that call instead of relying on the `OPENAI_API_KEY` environment variable.

**Example Environment Setup:**
```bash
# Set API key(s) as environment variables
export OPENAI_API_KEY=sk-...
export OPENROUTER_API_KEY=sk-or-...

# Run your Node.js script
node your_script.js
```

**Example `runAider` Call:**
```javascript
const { runAider } = require('@dguttman/aider-js');
const path = require('path'); // For constructing paths

async function main() {
  try {
    // Required: prompt, modelName, repoPath
    // Optional: editableFiles, readOnlyFiles, apiBase, apiKey, verbose
    const result = await runAider({
      // --- Required --- 
      prompt: 'Refactor the main function in app.js based on the architecture doc.',
      modelName: 'openai/gpt-4o-mini', // e.g., 'openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-opus-20240229'
      repoPath: path.resolve('../path/to/your/git/repository'), // <-- NEW: Path to the Git repository Aider should work in.

      // --- Files (Relative to repoPath) ---
      // Files Aider can modify. Paths should be relative to repoPath or absolute.
      editableFiles: ['src/app.js', 'src/utils.js'], 
      // Files Aider can read but not modify. Paths should be relative to repoPath or absolute.
      readOnlyFiles: ['docs/architecture.md'], 
      
      // --- Optional: Custom Endpoint --- 
      // Use apiBase for proxies or specific endpoints (like OpenRouter)
      // If used, modelName is prefixed with 'openai/' internally.
      apiBase: 'https://openrouter.ai/api/v1', 
      // Use apiKey HERE only if you provide apiBase AND want to override the 
      // OPENAI_API_KEY environment variable for this specific call.
      apiKey: 'sk-or-xxxxxx', // If omitted, OPENAI_API_KEY env var MUST be set when apiBase is used.
      
      // --- Optional: Verbosity ---
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

The `runAider` function accepts an options object. See the example and API Key explanation above for details. It returns a Promise that resolves with an object containing `stdout` and `stderr` from the Aider process, or rejects with an error if the process fails.

## How it Works

1.  **Postinstall:** Installs `uv` and Python dependencies (`aider-chat`) into `.venv/`.
2.  **Execution (`runAider`):**
    *   Gathers options (`prompt`, `modelName`, `repoPath`, `editableFiles`, `readOnlyFiles`, `apiBase`, `apiKey`, `verbose`).
    *   **Validation:** 
        *   Checks `repoPath` exists and is a directory.
        *   If `apiBase` is provided, ensures either `apiKey` option or `OPENAI_API_KEY` env var is present.
    *   **Model Prefixing:** Prepends `openai/` to `modelName` if `apiBase` is provided.
    *   **Environment Setup:** Prepares environment variables for the child process:
        *   Inherits all `process.env`.
        *   If `apiBase` and `apiKey` are both provided, sets `OPENAI_API_KEY` in the child environment to the value of the `apiKey` option.
    *   **JSON Payload:** Bundles options (including `repoPath`, excluding `apiKey` itself) into a JSON string.
    *   **Spawn:** Executes `python/aider_entrypoint.py` using the Python in `.venv/`, passing the JSON payload as an argument and the prepared environment variables. Crucially, it also sets the **`cwd` (current working directory)** of the Python process to the provided `repoPath`.
3.  **Python Script (`aider_entrypoint.py`):**
    *   Parses the JSON configuration (it still receives `repoPath` in the JSON, though it's primarily used by Node for setting `cwd`).
    *   Initializes Aider `Coder` with model, files, etc. (does *not* explicitly pass `git_dname`).
    *   Aider implicitly detects the Git repository context from the process's current working directory, which was set to `repoPath` by Node.js.
    *   Aider reads API keys from the environment variables provided by Node.js (using `OPENAI_API_KEY` if `apiBase` was involved).
    *   Runs `coder.run(prompt)`.
    *   Captures stdout/stderr back to Node.js.

## Development & Testing

*   **Cleanup:** `npm run cleanup` (removes downloaded `uv` and the `.venv` directory)
*   **Running Tests:** `npm test`
*   **Test Recording:**
    *   Tests use `echoproxia` to record and replay HTTP interactions with the LLM API (e.g., OpenRouter). This allows tests to run without live API calls after the initial recording.
    *   To create or update recordings, run the tests with the `RECORD_MODE` environment variable set to `true` and ensure your API key (e.g., `OPENROUTER_API_KEY`) is also set in the environment:
        ```bash
        export RECORD_MODE=true
        export OPENROUTER_API_KEY=sk-or-... # Replace with your actual key
        npm test
        ```
    *   **Important:** When `RECORD_MODE` is `true`, the existing contents of the `test/__recordings__` directory will be **deleted** before new recordings are made for the current test run.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[MIT](LICENSE) © [David Guttman](http://davidguttman.com/) 