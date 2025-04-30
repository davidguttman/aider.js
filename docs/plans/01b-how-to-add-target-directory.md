# Plan 01b: Specifying the Target Directory (Alternative: `cwd`)

**Goal:** Allow users of `aider-js` to specify the target directory (Git repository) where Aider should operate, using the `cwd` (current working directory) option when spawning the Python process.

**Status:** *Not Started*

**Context:**

This plan explores an alternative to Plan `01a`. Instead of relying solely on passing the `git_dname` parameter to `Coder.create` in Python, this approach focuses on setting the working directory of the spawned Python process itself.

Aider often uses the current working directory to resolve relative paths and locate the `.git` directory if `git_dname` isn't explicitly provided or if it needs to interact with git commands directly in some scenarios.

---

## Implementation Steps

### 1. Node.js (`src/aider.js` - `runAider` function)

*   **New Option:** Add a new option `repoPath` (same as in Plan `01a`).
*   **Validation:** Validate the `repoPath` exists and is a directory (same as Plan `01a`).
*   **Set `cwd`:** When calling `child_process.spawn`, pass the validated `repoPath` as the `cwd` option. This will make the Python script start executing *inside* the target directory.

    ```javascript
    // Example snippet in src/aider.js
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
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
        repoPath // <-- NEW OPTION (same as 01a)
      } = options;

      // --- Validation (same as 01a) ---
      if (!prompt) {
        throw new Error('Prompt is required.');
      }
      if (!repoPath) {
          throw new Error('repoPath (target directory) is required.');
      }
      // ... fs.promises.stat validation ...

      const pythonEnvPath = path.resolve(__dirname, '..', '.venv');
      const pythonExecutable = path.join(pythonEnvPath, 'bin', 'python');
      // Resolve entrypoint script relative to *this* file's location, not the target cwd
      const entrypointScript = path.resolve(__dirname, '..', 'python', 'aider_entrypoint.py');

      const config = {
        prompt,
        modelName,
        editFiles, // Relative path handling becomes critical here!
        readOnlyFiles,
        apiBase,
        verbose,
        // repoPath is implicitly handled by cwd, might not need to pass it explicitly
        // repoPath: repoPath
      };

      const configJson = JSON.stringify(config);
      debug('Spawning Python process with config:', configJson);

      const env = { ...process.env };
      // ... existing API key logic ...

      const pythonProcess = spawn(pythonExecutable, [entrypointScript, configJson], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: env,
          cwd: repoPath // <--- SET THE PYTHON SCRIPT'S WORKING DIRECTORY
      });

      // ... existing process handling logic ...
    }

    module.exports = { runAider };
    ```

### 2. Python (`aider_entrypoint.py`)

*   **No `git_dname`:** In this approach, we *might* not need to explicitly pass `git_dname` to `Coder.create`. Aider should detect the Git repository based on the current working directory set by Node.js.
*   **Relative Paths:** A major consideration is how `editFiles` and `readOnlyFiles` are handled. Since the Python script is running *in* the `repoPath`, any relative paths in the `config` (passed from Node.js) must be relative *to that `repoPath`*. The Node.js wrapper (`runAider`) needs to ensure the paths provided by the user are correctly resolved or passed through assuming they are already relative to `repoPath`.

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
    # repo_path = config.get("repoPath") # Not strictly needed if cwd is set
    model_name = config.get("modelName", "gpt-4o")
    fnames = config.get("editFiles", []) # Must be relative to cwd (repoPath)
    read_only_fnames = config.get("readOnlyFiles", []) # Must be relative to cwd
    # ... etc ...

    # Aider should detect git repo from os.getcwd() implicitly
    # We might still want validation in Python that os.getcwd() is a git repo
    # current_dir = os.getcwd()
    # if not os.path.isdir(os.path.join(current_dir, ".git")):
    #     print(f"Warning: Current directory '{current_dir}' does not appear to be a git repository.", file=sys.stderr)

    main_model = Model.create(model_name)
    io = InputOutput()

    try:
        coder = Coder.create(
            main_model=main_model,
            io=io,
            fnames=fnames,
            read_only_fnames=read_only_fnames,
            # git_dname=current_dir, # We could still set it explicitly
            # OR rely on aider finding it from cwd:
            git_dname=None,
            # ... other options ...
        )
        # ... rest of the script ...
    except Exception as e:
        print(f"Error initializing Coder: {e}", file=sys.stderr)
        sys.exit(1)
    ```

### 3. Documentation & Examples

*   Update `README.md` and `example.js` similarly to Plan `01a`, explaining the `repoPath` option and demonstrating its usage.

---

## Testing Considerations

*   Similar to Plan `01a`, tests need to:
    *   Create a temporary test git repository.
    *   Call `runAider` with the `repoPath` option pointing to the test repo.
    *   Verify that the `cwd` is correctly set for the spawned process (this might be harder to test directly).
    *   Verify Aider operates correctly within that directory.
    *   Ensure relative file paths passed in `editFiles` work as expected.
    *   Clean up the temporary repo.

---

## Pros and Cons vs. Plan `01a` (`git_dname`)

*   **Pros:**
    *   Potentially simpler Python script (might not need to handle `git_dname` explicitly).
    *   Might align more closely with how command-line tools typically expect to operate (running *within* the target directory).
*   **Cons:**
    *   **Relative Path Complexity:** Handling `editFiles`/`readOnlyFiles` paths becomes more critical. The Node.js wrapper MUST ensure paths are relative to `repoPath`. If the user provides absolute paths, they should still work, but relative paths provided by the user need careful consideration based on where the user's script is running vs. the target `repoPath`.
    *   Less explicit control within Python; relies more on Aider's implicit CWD detection.
    *   Potential for unexpected behavior if other parts of the Python script or Aider itself make assumptions about CWD that conflict with it being the target repo.

---

## Recommendation

Plan `01a` (using `git_dname`) is likely safer and more explicit. It keeps the Python script's execution context separate from the target data directory, reducing potential side effects and making relative path handling slightly more straightforward (paths passed to Python are explicitly relative to `git_dname`). However, Plan `01b` is a valid alternative worth considering if the implicit CWD behavior is preferred. 