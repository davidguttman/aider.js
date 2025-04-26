#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "--- Running cleanup script ---"
node scripts/cleanup.js

echo "--- Building Docker test image ---"
docker build -t aider-js-test -f test/Dockerfile .

echo "--- Running tests in Docker container ---"
# Pass a dummy API key as an environment variable for the tests
docker run --rm -e OPENAI_API_KEY=DUMMY_KEY aider-js-test

echo "--- Docker test completed ---" 