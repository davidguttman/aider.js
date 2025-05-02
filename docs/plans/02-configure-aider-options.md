# Plan 02: Add Aider Configuration Options

**Goal:** Allow users of `aider-js` to configure additional Aider behaviors by exposing more options from the underlying Python `Coder` object. Specifically, add support for:

*   `show_diffs`: Display diffs of proposed changes. (Default: `false`)
*   `stream`: Stream responses from the LLM. (Default: `false`)
*   `chat_language`: Specify the language for the chat interaction. (Default: `'english'`)
*   `verbose`: Enable verbose logging from Aider. (Default: `false`)

**Status:** *Not Started*

**Context:**

Currently, `aider-js` only exposes a limited set of Aider's capabilities. This plan aims to increase flexibility by allowing users to control more aspects of Aider's operation, such as output formatting, streaming, language, and verbosity, mirroring options available in the Aider CLI and Python API.

---

## Implementation Steps

### 1. Node.js (`src/aider.js` - `runAider` function)

*   **New Options:** Add `showDiffs`, `stream`, `chatLanguage`, and `verbose` to the `options` object parameter of the `runAider` function. Use camelCase for Node.js conventions.
*   **Defaults:** Assign the specified default values if the options are not provided by the user.
*   **Pass to Python:** Include these new options (using their original snake_case names expected by the Python script) in the `config` object that is JSON-serialized and passed as an argument to the Python script.

    ```javascript
    // Example snippet in src/aider.js
    // ... imports ...
    const debug = require('debug')('aider-js');

    async function runAider(options) {
      const {
        prompt,
        modelName,
        editFiles = [],
        readOnlyFiles = [],
        apiBase,
        apiKey,
        repoPath, // Assumes Plan 01a or 01b is implemented
        // --- NEW OPTIONS ---
        showDiffs = false,
        stream = false,
        chatLanguage = 'english',
        verbose = false,
        // --- END NEW OPTIONS ---
      } = options;

      // ... existing validation ...

      const pythonEnvPath = path.resolve(__dirname, '..', '.venv');
      const pythonExecutable = path.join(pythonEnvPath, 'bin', 'python');
      const entrypointScript = path.resolve(__dirname, '..', 'python', 'aider_entrypoint.py');

      const config = {
        prompt,
        modelName,
        editFiles,
        readOnlyFiles,
        apiBase,
        repoPath, // Pass repoPath if using Plan 01a approach
        // --- Pass new options with snake_case ---
        show_diffs: showDiffs,
        stream: stream,
        chat_language: chatLanguage,
        verbose: verbose,
        // --- End new options ---
      };

      const configJson = JSON.stringify(config);
      debug('Spawning Python process with config:', configJson);

      // ... existing spawn logic, potentially setting cwd if using Plan 01b ...
      const pythonProcess = spawn(pythonExecutable, [entrypointScript, configJson], {
          stdio: ['pipe', 'pipe', 'pipe'], // Consider 'inherit' for stdout/stderr if stream=true? Needs investigation.
          env: { ...process.env /* existing API key logic */ },
          cwd: repoPath // If using Plan 01b
      });

      // ... existing process handling logic ...
      // Note: Handling `stream: true` will require changes here.
      // Instead of buffering all stdout, we'd need to pipe pythonProcess.stdout
      // directly or emit events as data arrives. This adds complexity.
    }

    module.exports = { runAider };
    ```

### 2. Python (`python/aider_entrypoint.py`)

*   **Extract Options:** Retrieve `show_diffs`, `stream`, `chat_language`, and `verbose` from the `config` dictionary passed via JSON. Use `.get()` with appropriate defaults matching the Node.js side, although the defaults should ideally be handled primarily in Node.
*   **Pass to `Coder.create`:** Pass these values to the corresponding arguments (`show_diffs`, `stream`, `chat_language`, `verbose`) when calling `Coder.create`.

    ```python
    # Example snippet in aider_entrypoint.py
    import json
    import sys
    from aider.coders import Coder
    from aider.models import Model
    from aider.io import InputOutput
    import os

    config_json = sys.argv[1]
    config = json.loads(config_json)

    # --- Extract configuration ---
    prompt = config.get("prompt")
    model_name = config.get("modelName", "gpt-4o")
    fnames = config.get("editFiles", [])
    read_only_fnames = config.get("readOnlyFiles", [])
    # Assuming Plan 01a (git_dname) or Plan 01b (cwd implicitly handles repo)
    repo_path = config.get("repoPath") # Used for git_dname if Plan 01a
    api_base = config.get("apiBase") # Need to handle passing this to model/Coder
    # --- NEW OPTIONS ---
    show_diffs = config.get("show_diffs", False)
    stream = config.get("stream", False) # Crucial for Coder.create
    chat_language = config.get("chat_language", "english")
    verbose = config.get("verbose", False)
    # --- END NEW OPTIONS ---


    # --- Setup ---
    # Handle API Base/Key for the model (Needs refinement based on actual Coder/Model init)
    # os.environ["OPENAI_API_BASE"] = api_base if api_base else os.environ.get("OPENAI_API_BASE")
    # os.environ["OPENAI_API_KEY"] = ... # Already handled via env passing? Check security.

    main_model = Model.create(model_name) # May need api_base/key here
    io = InputOutput(
        # Potentially configure io based on stream/verbose?
        # stream=stream, # Check if InputOutput takes stream
    )

    try:
        coder = Coder.create(
            main_model=main_model,
            io=io,
            fnames=fnames,
            read_only_fnames=read_only_fnames,
            # Use repo_path if Plan 01a, otherwise rely on cwd (None) if Plan 01b
            git_dname=repo_path, # Set appropriately based on Plan 01a/01b implementation
            # --- Pass extracted options ---
            show_diffs=show_diffs,
            stream=stream, # This directly affects how Coder yields responses
            chat_language=chat_language,
            verbose=verbose,
            # --- End passed options ---
            # Add other existing/default options as needed
            # auto_commits=True, # Example existing option
        )

        # --- Interaction ---
        if prompt:
            result = coder.run(prompt)
            # If stream=False, print the final result.
            # If stream=True, coder.run might behave differently (e.g., yield chunks).
            # The current Node.js code buffers stdout, so streaming won't work
            # without changes on the Node side to handle the streamed output.
            if not stream:
                 print(result) # Print final result for non-streaming

        # For streaming, the Python script might implicitly print chunks
        # if io is configured correctly and coder.run yields them.
        # The Node.js side would need to read stdout line-by-line or chunk-by-chunk.

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)
    ```

### 3. Documentation & Examples

*   Update `README.md` to document the new `showDiffs`, `stream`, `chatLanguage`, and `verbose` options for the `runAider` function.
*   Update `example.js` to demonstrate how to use these new options.
*   Review `docs/aider-api.md` to ensure it accurately reflects the available options passed from the Node.js wrapper, even if the core Python API details are already there. Note the specific challenges/requirements for `stream`.

---

## Testing Considerations

*   **Unit Tests (Node.js):** Verify that `runAider` correctly assigns defaults and includes the options (with correct snake_case names) in the JSON passed to the Python script.
*   **Integration Tests:**
    *   Test `verbose=true`: Run a simple prompt and assert that the `stderr` or `stdout` (depending on how Aider logs verbosely) contains expected verbose output markers.
    *   Test `show_diffs=true`: Run a prompt that causes a code change and assert that diff output is present in the `stdout`.
    *   Test `chat_language`: This is hard to test automatically. Manual verification or checking logs might be needed.
    *   Test `stream=true`: This requires significant changes to the Node.js output handling. Tests would need to verify that output is received incrementally rather than as a single block upon completion. Mocking the Python process might be necessary to simulate streamed output effectively.

---

## Challenges

*   **Streaming (`stream=true`):** This is the most complex option. It requires changing the Node.js `spawn` setup and output handling to process stdout/stderr incrementally instead of buffering the entire output. This might involve piping the streams or using event listeners (`pythonProcess.stdout.on('data', ...)`). The return value of `runAider` would likely need to change (e.g., return the process object, an async iterator, or use callbacks/event emitters).
*   **API Keys/Base:** Ensure robust handling of API credentials, especially if passing `apiBase`. Passing via environment variables (as currently done) is generally safer than putting them directly in the JSON config.

---

## Recommendation

Implement `show_diffs`, `chat_language`, and `verbose` first, as they primarily involve passing configuration values through. Tackle `stream` separately due to the required changes in Node.js I/O handling. 