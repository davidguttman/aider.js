## Aider Python API Documentation (Unofficial - Updated)

This document outlines how to interact with the core `aider` functionality from a Python script. The primary mechanism involves creating and interacting with a `Coder` object.

**Disclaimer:** This documentation describes using `aider`'s internal components. As `aider` evolves, these internal details (class names, method signatures, command handling) may change without notice, potentially breaking your integration. Use with caution and be prepared for maintenance.

### 1. Core Interaction: `Coder` Object

The central class for interacting with `aider` is `aider.coders.Coder`.

**Initialization:**

Use the `Coder.create` factory method.

```python
from aider.coders import Coder
from aider.models import Model
from aider.io import InputOutput
import os

# --- Configuration ---
MODEL_NAME = "gpt-4o" # Or your preferred model (e.g., 'claude-3-5-sonnet-20240620')
REPO_PATH = "/path/to/your/git/project" # Must be a git repo
EDIT_FILES = ["src/main.py"]
READ_ONLY_FILES = ["docs/api_spec.md", "config/settings.yaml"]
TEST_COMMAND = "pytest tests/" # Your project's test command
AUTO_COMMIT = True # Or False to manage commits manually
# Ensure API keys are set in the environment

# --- Setup ---
main_model = Model.create(MODEL_NAME)
io = InputOutput() # Can customize further if needed

# Combine file lists for initialization if desired
# all_initial_files = EDIT_FILES + READ_ONLY_FILES

try:
    coder = Coder.create(
          main_model=main_model,
        io=io,
        fnames=EDIT_FILES,                 # Files aider can edit
        read_only_fnames=READ_ONLY_FILES, # Files aider can only read
        git_dname=REPO_PATH,
        auto_commits=AUTO_COMMIT,
        test_cmd=TEST_COMMAND,
        # --- Other useful options ---
        # edit_format="diff",
        # lint_cmd="flake8 src/",
        # cache_prompts=True, # Enable LLM prompt caching (if model supports it)
        # cache_keepalive_pings=12, # Keep cache warm for 60 mins (12 * 5 mins)
        # dry_run=False, # Set True to simulate without file changes/commits
        # verbose=False,
        # stream=False, # Disable streaming for easier capture of full response
        # yes=True, # Auto-approve actions like file creation, running commands (Use with caution!)
    )
    print("Coder initialized successfully.")
except Exception as e:
    print(f"Error initializing Coder: {e}")
    exit(1)

# --- Interaction ---
# result = coder.run("Your instruction or command")
# print(f"Aider response: {result}")
```

**Key `Coder.create` Parameters (Updated):**
```python
        coder = Coder.create(
            main_model=main_model,
            edit_format=args.edit_format,
            io=io,
            repo=repo,
            fnames=fnames,
            read_only_fnames=read_only_fnames,
            show_diffs=args.show_diffs,
            auto_commits=args.auto_commits,
            dirty_commits=args.dirty_commits,
            dry_run=args.dry_run,
            map_tokens=map_tokens,
            verbose=args.verbose,
            stream=args.stream,
            use_git=args.git,
            restore_chat_history=args.restore_chat_history,
            auto_lint=args.auto_lint,
            auto_test=args.auto_test,
            lint_cmds=lint_cmds,
            test_cmd=args.test_cmd,
            commands=commands,
            summarizer=summarizer,
            analytics=analytics,
            map_refresh=args.map_refresh,
            cache_prompts=args.cache_prompts,
            map_mul_no_files=args.map_multiplier_no_files,
            num_cache_warming_pings=args.cache_keepalive_pings,
            suggest_shell_commands=args.suggest_shell_commands,
            chat_language=args.chat_language,
            detect_urls=args.detect_urls,
            auto_copy_context=args.copy_paste,
            auto_accept_architect=args.auto_accept_architect,
        )
        ```

**Interaction Method:**

*   **`coder.run(instruction: str) -> str`**: (Same as before) Sends instructions or slash commands. Returns the response string.

### 2. Common Slash Commands (Updated & Expanded)

Execute via `coder.run("/command args")`.

*   **File Management:**
    *   `/add <file_path> [...]`: Adds file(s) as **editable** to the chat context.
        *   `coder.run("/add src/new_module.py tests/test_new_module.py")`
    *   `/read-only <file_path> [...]`: Adds file(s) as **read-only** to the chat context. The LLM can see them but won't suggest edits for them.
        *   `coder.run("/read-only requirements.txt config.yaml")`
    *   `/drop <file_path> [...]`: Removes file(s) (both editable and read-only) from the chat context.
        *   `coder.run("/drop config.yaml")`
    *   `/ls`: Lists all files currently in the chat context (both editable and read-only).
        *   `coder.run("/ls")`

*   **Execution & Testing:**
    *   `/run <shell_command>`: Executes a shell command, output added to chat.
        *   `coder.run("/run black src/")`
    *   `/test`: Runs the test command configured via `Coder.create(test_cmd=...)` or the `test-cmd` config setting. Output is added to chat.
        *   `coder.run("/test")`
    *   `/lint`: Runs the linter command configured via `Coder.create(lint_cmd=...)` or the `lint-cmd` config setting. Output is added to chat.
        *   `coder.run("/lint")`

*   **Git Interaction:**
    *   `/git <git_subcommand_and_args>`: Executes git commands (diff, commit, checkout, status, etc.).
        *   `coder.run("/git status")`
        *   `coder.run("/git commit -m 'Manual commit via aider'")` (Only if `auto_commits=False`)

*   **Chat & Context Management:**
    *   `/undo`: Reverts the last aider-applied commit.
    *   `/clear`: Clears the chat history (keeps added files).
    *   `/tokens`: Reports estimated token counts.
    *   `/ask <question>`: Sends the `<question>` to the LLM but instructs it to only answer the question, not propose code changes. Switches the internal coder to `AskCoder` mode for this interaction.
        *   `coder.run("/ask Explain the purpose of the Decorator pattern.")`
    *   `/web <url>`: Scrapes the text content of the URL and adds it to the chat context.
        *   `coder.run("/web https://docs.python.org/3/library/contextlib.html")`

*   **Environment:**
    *   `/pwd`: Shows the current working directory aider is using (should match `git_dname`).
    *   `/cd <path>`: Changes aider's current working directory. Use with caution, usually better to set `git_dname` correctly on init.

### 3. Using Prompts for Code Changes

(Same as before) Pass natural language instructions to `coder.run()`. Ensure relevant files (`/add` or `/read-only`) are in context. Iterate as needed, potentially using `/run`, `/test`, `/lint` between steps.
