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
    api_key = config.get('apiKey')
    api_base = config.get('apiBase')
    verbose = config.get('verbose', False) # Control aider's verbosity

    if not prompt:
        print("Error: 'prompt' is required in the JSON input.", file=sys.stderr)
        sys.exit(1)

    # --- Environment Setup ---
    # Set API key and base URL if provided
    # Note: Aider might have its own ways of picking these up,
    # but setting env vars is a common approach.
    if api_key:
        os.environ['OPENAI_API_KEY'] = api_key
    if api_base:
        os.environ['OPENAI_API_BASE'] = api_base

    # Validate file paths
    for fpath in editable_files + read_only_files:
        if not Path(fpath).exists():
             # Aider itself might handle this, but early validation is good
             print(f"Warning: File not found: {fpath}", file=sys.stderr)
             # Depending on strictness, you might want to sys.exit(1) here

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
            auto_commits=False,
            suggest_shell_commands=False,
            # Removed verbose=verbose based on user snippet
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