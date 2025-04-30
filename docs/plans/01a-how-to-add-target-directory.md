# Plan 01: Specifying the Target Directory

**Goal:** Allow users of `aider-js` (both the Node.js wrapper and the underlying Python script) to specify the target directory (Git repository) where Aider should operate.

**Status:** *Not Started*

**Context:**

Aider, by design, operates within a specific Git repository. It uses this context for file discovery, git operations (like diffing and committing), and understanding the project structure. The `aider-js` wrapper needs a way to pass this target directory information down to the underlying Python Aider instance.

---

## Implementation Steps

### 1. Python (`aider_entrypoint.py` via `Coder.create`)

*   **Leverage `git_dname`:** The `aider` Python library's `Coder.create` method already accepts a `git_dname` parameter. This parameter explicitly tells Aider which directory is the root of the Git repository it should work within.
*   **Documentation:** The `docs/aider-api.md` confirms this:
    ```
    *   `git_dname` (str): Path to git repository root.
    ```
*   **Integration:** The `aider_entrypoint.py` script (which is called by the Node.js wrapper) needs to read the target directory path provided by the Node.js side and pass it to `Coder.create(..., git_dname=target_directory, ...)`.

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
    repo_path = config.get("repoPath") # NEW: Get repo path from config
    model_name = config.get("modelName", "gpt-4o")
    # ... other config extraction ...
    fnames = config.get("editFiles", [])
    read_only_fnames = config.get("readOnlyFiles", [])
    # ... etc ...

    if not repo_path or not os.path.isdir(repo_path):
        print(f"Error: Invalid or missing 'repoPath': {repo_path}", file=sys.stderr)
        sys.exit(1)
    # Basic check if it's potentially a git repo (can be enhanced)
    if not os.path.isdir(os.path.join(repo_path, ".git")):
         print(f"Warning: Target directory '{repo_path}' does not appear to be a git repository.", file=sys.stderr)
         # Decide if this should be a hard error or just a warning

    main_model = Model.create(model_name)
    io = InputOutput() # Customize as needed

    try:
        coder = Coder.create(
            main_model=main_model,
            io=io,
            fnames=fnames,
            read_only_fnames=read_only_fnames,
            git_dname=repo_path, # <--- PASS THE TARGET DIRECTORY HERE
            # ... other options like auto_commits, test_cmd etc.
            # Ensure these are also configurable via the Node wrapper if needed
        )
        # ... rest of the script ...
        # coder.run(config.get("prompt"))
    except Exception as e:
        print(f"Error initializing Coder: {e}", file=sys.stderr)
        sys.exit(1)

    ```

### 2. Node.js (`src/aider.js` - `runAider` function)

*   **New Option:** Add a new option to the `runAider` function, perhaps named `repoPath` or `targetDirectory`.
*   **Validation:** Validate that the provided path exists and is a directory. Potentially add a check if it contains a `.git` subdirectory, though Aider itself might handle the "not a git repo" case.
*   **Pass to Python:** Include this `repoPath` in the JSON configuration object that is passed as a command-line argument to `aider_entrypoint.py`.

    ```javascript
    // Example snippet in src/aider.js
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs'); // Needed for validation
    const debug = require('debug')('aider-js');

    async function runAider(options) {
      const {
        prompt,
        modelName,
        editFiles = [],
        readOnlyFiles = [],
        apiBase,
        apiKey,
        verbose = false,
        repoPath // <-- NEW OPTION
      } = options;

      // --- Validation ---
      if (!prompt) {
        throw new Error('Prompt is required.');
      }
      if (!repoPath) { // <-- VALIDATE NEW OPTION
          throw new Error('repoPath (target directory) is required.');
      }
      try {
          const stats = await fs.promises.stat(repoPath);
          if (!stats.isDirectory()) {
              throw new Error(`repoPath '${repoPath}' is not a directory.`);
          }
          // Optional: Check for .git
          // const gitDir = path.join(repoPath, '.git');
          // try {
          //     await fs.promises.access(gitDir);
          // } catch (err) {
          //     console.warn(`Warning: Target directory '${repoPath}' does not appear to contain a .git directory.`);
          // }
      } catch (err) {
          if (err.code === 'ENOENT') {
              throw new Error(`repoPath '${repoPath}' does not exist.`);
          }
          throw err; // Re-throw other errors (like permission errors or the explicit 'not a directory' error)
      }


      const pythonEnvPath = path.resolve(__dirname, '..', '.venv');
      const pythonExecutable = path.join(pythonEnvPath, 'bin', 'python');
      const entrypointScript = path.resolve(__dirname, '..', 'python', 'aider_entrypoint.py');

      const config = {
        prompt,
        modelName,
        editFiles,
        readOnlyFiles,
        apiBase,
        verbose,
        repoPath // <-- INCLUDE IN CONFIG
      };

      // ... rest of the function (API key handling, spawning process) ...

      const configJson = JSON.stringify(config);
      debug('Spawning Python process with config:', configJson);

      // Ensure environment variables are passed correctly
      const env = { ...process.env };
      // ... existing API key logic ...

      const pythonProcess = spawn(pythonExecutable, [entrypointScript, configJson], {
          stdio: ['pipe', 'pipe', 'pipe'], // Use pipes for stdin, stdout, stderr
          env: env, // Pass environment variables
          // Important: Run the Python script with the *target directory* as its CWD?
          // NO - Aider uses git_dname, not the CWD of the script itself.
          // cwd: repoPath // Setting cwd might not be necessary if git_dname is used correctly. Let's rely on git_dname.
      });

      // ... existing process handling logic ...
    }

    module.exports = { runAider };
    ```

### 3. Documentation & Examples

*   Update `README.md` to document the new `repoPath` option for `runAider`.
*   Update `example.js` to demonstrate using the `repoPath` option.
*   Consider adding a specific example showing how to run `aider-js` against a *different* project directory than the one `aider-js` is installed in.

---

## Testing Considerations

*   Modify `test/aider.test.js` to:
    *   Pass a `repoPath` option pointing to a temporary test git repository.
    *   Ensure the test repository is properly initialized (`git init`) before the test runs.
    *   Verify that Aider operates correctly within that specified directory (e.g., file edits occur in the test repo, not the `aider-js` repo).
    *   Clean up the temporary test repository after the test.

---

## Open Questions

*   Should the Node.js wrapper strictly enforce that `repoPath` contains a `.git` directory, or rely on Aider's own checks/error handling? (Current plan: rely on Aider, maybe add a warning).
*   How should relative paths for `editFiles` and `readOnlyFiles` be handled? They should likely be relative to the `repoPath`, not the CWD where the Node script is invoked. The current Python snippet assumes they are passed correctly relative to `git_dname`. The Node wrapper might need to resolve paths relative to `repoPath` before passing them in the config if users are expected to provide paths relative to their script's CWD. (Assumption: Paths passed to `runAider` should already be relative to `repoPath` or absolute paths). 