# Project Configuration (aider-js)

*This file contains the stable, long-term context for the project.*
*It should be updated infrequently, primarily when core goals, tech, or patterns change.*

---

## Core Goal

To provide a robust Node.js wrapper for the [Aider](https://github.com/Aider-AI/aider) Python tool. This package allows Node.js projects to leverage Aider's capabilities by automatically managing a self-contained Python environment and dependencies using [uv](https://github.com/astral-sh/uv).

---

## Tech Stack

*   **Core Logic:** Node.js (wrapper), Python (`aider-chat` library via `aider_entrypoint.py`)
*   **Python Environment:** `uv` for creating virtual environments and installing dependencies.
*   **Node.js Dependencies (Runtime):** `debug`
*   **Node.js Dependencies (Scripts/Setup):** `cross-fetch`, `tar`, `unzipper`, `glob`, `debug`
*   **Testing:** `ava` (Node.js test runner), `fs-extra` (file system utilities for tests), `echoproxia` (HTTP proxy for recording/replaying API calls), Docker (`test/Dockerfile`, `docker-test.sh`)
*   **Linting/Formatting:** (Not explicitly defined, assume standard Node.js/Python tools if used)

---

## Critical Patterns & Conventions

*   **Self-Contained Python Environment:**
    *   The `scripts/postinstall.js` script runs automatically after `npm install`.
    *   It uses `scripts/get-uv.js` to download the platform-specific `uv` binary into `bin/`.
    *   `uv` is then used to create a Python virtual environment in `.venv/`.
    *   Python dependencies (specifically `aider-chat` and its requirements, defined in `python/pyproject.toml` and locked in `python/uv.lock`) are installed into `.venv/` using `uv sync` and `uv pip install`.
    *   A marker file (`.venv/aider_js_setup_complete.marker`) is created to potentially skip re-setup.
    *   `scripts/cleanup.js` provides a way to remove the generated `bin/` and `.venv/` directories.
*   **Node.js to Python Bridge:**
    *   The main entry point is `src/aider.js`, exporting the `runAider(options)` function.
    *   `runAider` validates input options (`prompt`, `modelName`, file paths, `apiBase`, `apiKey`, `verbose`).
    *   It prepares a JSON configuration object based on the options.
    *   It uses `child_process.spawn` to execute the Python script `python/aider_entrypoint.py` using the Python interpreter located within the `.venv/` directory.
    *   The JSON configuration is passed as a command-line argument to the Python script.
    *   Environment variables (including API keys) are passed from the Node.js process to the Python child process.
*   **API Key Handling:**
    *   Aider (Python) reads API keys primarily from environment variables (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
    *   The Node.js wrapper (`runAider`) passes the parent process's environment variables down.
    *   **Special Case:** If the `apiBase` option is provided to `runAider` (for using proxies or custom endpoints like OpenRouter), the wrapper handles API keys differently:
        *   It prefixes the `modelName` with `openai/`.
        *   It requires *either* the `apiKey` option to be provided *or* the `OPENAI_API_KEY` environment variable to be set in the Node.js process.
        *   If the `apiKey` option is provided, its value is explicitly set as the `OPENAI_API_KEY` environment variable for the Python child process, overriding any existing `OPENAI_API_KEY` in the parent environment for that specific call.
*   **Testing Strategy:**
    *   Integration tests are in `test/aider.test.js` using `ava`.
    *   `echoproxia` is used to create a proxy server.
        *   In `RECORD_MODE=true`, it intercepts outgoing HTTP requests (to the LLM API, e.g., OpenRouter), records them (redacting sensitive headers like API keys), and forwards them to the target URL.
        *   In replay mode (default), it intercepts requests and serves the previously recorded responses, allowing tests to run without live API calls or keys (except for the initial recording).
    *   Tests verify that `runAider` correctly calls the Python script and that Aider can perform basic tasks (like editing a file) based on the proxied/replayed API interaction.
    *   `test/Dockerfile` and `docker-test.sh` provide a way to run the installation (`npm install`) and tests (`npm test`) within a clean Docker container, ensuring the environment setup works correctly across different systems.
*   **No Mocking Libraries:** The project avoids standard mocking libraries like Sinon or Proxyquire for external dependencies, relying instead on `echoproxia` for API interaction testing.

---

## Project Status

*as of 2025-04-29, SHA: 65f22c4bfe8ff808d865450a3e1ffd31ed79a536*

*   **Core Functionality:** The primary goal of wrapping `aider` via a Node.js function (`runAider`) is implemented.
*   **Dependency Management:** Automated Python environment setup using `uv` during `npm install` is functional.
*   **Testing:**
    *   Integration tests using `ava` and `echoproxia` exist (`test/aider.test.js`) to verify the core `runAider` functionality against recorded API interactions.
    *   Docker-based testing (`docker-test.sh`) ensures the installation process and tests run in an isolated environment.
*   **Documentation:** Basic README, an example usage script (`example.js`), and unofficial Aider Python API docs (`docs/aider-api.md`) are present.
*   **Plans:**
    *   `docs/plans/01a-how-to-add-target-directory.md`: Plan for specifying the target directory via Python's `git_dname`.
    *   `docs/plans/01-choice.md`: Analysis and decision document comparing `git_dname` vs `cwd` approaches (Plan 01a chosen).
*   **Next Steps:**
    *   Implement Plan 01a (Target Directory specification using `git_dname`).
    *   Enhance test coverage with more complex scenarios (e.g., different Aider commands, error handling).
    *   Consider adding linting and formatting standards.
    *   Keep Python dependencies (aider-chat) updated. 