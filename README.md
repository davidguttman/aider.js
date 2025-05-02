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
    // --- Options --- 
    // See descriptions below the example
    const result = await runAider({
      // --- Required --- 
      prompt: 'Refactor the main function in app.js based on the architecture doc.',
      modelName: 'openai/gpt-4o-mini', 
      repoPath: path.resolve('../path/to/your/git/repository'),

      // --- Files (Relative to repoPath) --- 
      editableFiles: ['src/app.js', 'src/utils.js'], 
      readOnlyFiles: ['docs/architecture.md'], 
      
      // --- Optional: Custom Endpoint --- 
      apiBase: 'https://openrouter.ai/api/v1', 
      apiKey: 'sk-or-xxxxxx', // Only needed if using apiBase AND overriding OPENAI_API_KEY env var.
      
      // --- Optional: Behavior --- 
      autoCommits: false, // Default: false
      showDiffs: false, // Default: false
      stream: false, // Default: false (Note: Streaming currently not fully supported by Node wrapper)
      chatLanguage: 'english', // Default: 'english'
      verbose: false // Default: false
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

The `runAider` function accepts an options object with the following properties:

*   **`prompt`** (string, **required**): The natural language instruction for Aider.
*   **`modelName`** (string, **required**): The identifier for the LLM model Aider should use (e.g., `'openai/gpt-4o'`, `'anthropic/claude-3-5-sonnet-20240620'`).
*   **`repoPath`** (string, **required**): An absolute or relative path to the root of the Git repository Aider should operate within.
*   **`editableFiles`** (array of strings, optional): A list of file paths (relative to `repoPath` or absolute) that Aider is allowed to modify. Defaults to `[]`.
*   **`readOnlyFiles`** (array of strings, optional): A list of file paths (relative to `repoPath` or absolute) that Aider can read for context but *cannot* modify. Defaults to `[]`.
*   **`apiBase`** (string, optional): The base URL for a custom LLM API endpoint (e.g., for using proxies, local LLMs, or services like OpenRouter). See API Key section above for crucial details.
*   **`apiKey`** (string, optional): The API key. This is primarily used when `apiBase` is also provided, allowing you to specify the key directly for the call, overriding the `OPENAI_API_KEY` environment variable. See API Key section above.
*   **`autoCommits`** (boolean, optional): If `true`, Aider will automatically commit changes it makes. Defaults to `false`.
*   **`showDiffs`** (boolean, optional): If `true`, Aider will include diffs of proposed changes in its output. Defaults to `false`.
*   **`stream`** (boolean, optional): If `true`, instructs Aider to attempt streaming responses. **Note:** While the option is passed to Aider, the current Node.js wrapper implementation buffers the output, so you won't see true streaming behavior yet. Defaults to `false`.
*   **`chatLanguage`** (string, optional): Specifies the language for Aider's chat interactions (e.g., `'spanish'`, `'french'`). Defaults to `'english'`.
*   **`verbose`** (boolean, optional): If `true`, enables more detailed logging output from the underlying Aider process (sent to stderr). Defaults to `false`.

The function returns a Promise that resolves with an object containing `stdout` and `stderr` from the Aider process, or rejects with an error if the process fails.

## How it Works

1.  **Postinstall:** Installs `uv` and Python dependencies (`aider-chat`) into `.venv/`.
2.  **Execution (`runAider`):**
    *   Gathers options (`prompt`, `modelName`, `repoPath`, `editableFiles`, `readOnlyFiles`, `apiBase`, `apiKey`, `autoCommits`, `showDiffs`, `stream`, `chatLanguage`, `verbose`).
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