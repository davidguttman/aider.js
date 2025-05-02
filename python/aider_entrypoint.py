import argparse
import json
import os
import sys
from pathlib import Path

# === Removed top-level try/except ImportError block ===
from aider.coders import Coder
from aider.models import Model
from aider.io import InputOutput
# === End removal ===

def main():
    parser = argparse.ArgumentParser(description="Run aider with provided configuration.")
    parser.add_argument('config_json', type=str, help='JSON string containing the configuration.')
    args = parser.parse_args()

    try:
        config = json.loads(args.config_json)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    # --- Configuration ---
    prompt = config.get('prompt')
    editable_files = config.get('editableFiles', [])
    read_only_files = config.get('readOnlyFiles', [])
    model_name = config.get('modelName', 'gpt-4o-mini') # Default model
    verbose = config.get('verbose', False) # Control aider's verbosity
    api_base = config.get('apiBase') # Get apiBase from config
    repo_path = config.get('repoPath') # <-- Added repoPath extraction
    auto_commits = config.get('autoCommits', False) # <-- Add auto_commits extraction

    if not prompt:
        print("Error: 'prompt' is required in the JSON input.", file=sys.stderr)
        sys.exit(1)

    # --- repoPath Validation (Python side) ---
    if not repo_path:
        print("Error: 'repoPath' is required in the JSON input from Node.js.", file=sys.stderr)
        sys.exit(1)
    repo_path_obj = Path(repo_path)
    if not repo_path_obj.exists():
        print(f"Error: repoPath '{repo_path}' provided by Node.js does not exist.", file=sys.stderr)
        sys.exit(1)
    if not repo_path_obj.is_dir():
        print(f"Error: repoPath '{repo_path}' provided by Node.js is not a directory.", file=sys.stderr)
        sys.exit(1)
    # Optional: Check for .git and issue a warning
    git_dir = repo_path_obj / '.git'
    if not git_dir.is_dir():
         print(f"Warning: Target directory '{repo_path}' does not appear to be a git repository (.git directory missing).", file=sys.stderr)
    # --- End repoPath Validation ---

    # --- Environment Setup ---
    # Aider/LiteLLM primarily uses environment variables.
    # Set OPENAI_API_BASE if apiBase was provided in the config.
    # OPENAI_API_KEY is already set by the Node.js wrapper if needed.
    if api_base:
        os.environ['OPENAI_API_BASE'] = api_base
        print(f"Setting OPENAI_API_BASE environment variable to: {api_base}", file=sys.stderr)

    # Validate file paths - REMOVED: Aider will handle this relative to git_dname
    # for fpath in editable_files + read_only_files:
    #     if not Path(fpath).exists():
    #          print(f"Warning: File not found: {fpath}", file=sys.stderr)

    # --- Aider Initialization ---
    try:
        # Instantiate Model directly
        main_model = Model(model_name)

        # Instantiate Coder using Coder.create, matching user-provided structure
        coder = Coder.create(
            main_model=main_model,
            io=InputOutput(yes=True), # Instantiate InputOutput inline
            fnames=editable_files,    # Corresponds to context_editable
            read_only_fnames=read_only_files, # Corresponds to context_read_only
            auto_commits=auto_commits, # <-- Use configured auto_commits
            suggest_shell_commands=False,
            # Removed verbose=verbose based on user snippet
            # Note: If other args like auto_commits need to be configurable, add them to Node.js options
        )
    except Exception as e:
        print(f"Error initializing aider: {e}", file=sys.stderr)
        sys.exit(1)


    # --- Execution ---
    try:
        print(f"Running aider with model: {main_model.name}", file=sys.stderr)
        print(f"Editable files: {editable_files}", file=sys.stderr)
        print(f"Read-only files: {read_only_files}", file=sys.stderr)
        print(f"Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}", file=sys.stderr)

        coder.run(prompt)

        print("Aider execution finished.", file=sys.stderr)
        # Aider's output (diffs, messages) goes to stdout/stderr via InputOutput
        sys.exit(0) # Explicitly exit with success code

    except Exception as e:
        print(f"Error during aider execution: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 