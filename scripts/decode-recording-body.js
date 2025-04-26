#!/usr/bin/env node

// scripts/decode-recording-body.js
const fs = require('fs/promises');
const path = require('path');

/**
 * Decodes a Base64 string, attempting to parse and pretty-print if it's JSON.
 * @param {string} base64String The Base64 encoded string.
 * @returns {string} The decoded string (pretty-printed if JSON).
 */
function decodeAndFormatBody(base64String) {
  try {
    const decodedBody = Buffer.from(base64String, 'base64').toString('utf8');
    // Attempt to parse as JSON for pretty printing
    try {
      const parsedJson = JSON.parse(decodedBody);
      return JSON.stringify(parsedJson, null, 2); // Pretty print JSON
    } catch (jsonParseError) {
      // Not valid JSON, return as plain text
      return decodedBody;
    }
  } catch (decodeError) {
    console.error('\nError decoding Base64 string:', decodeError);
    return `[Decoding Error: ${decodeError.message}]`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: node scripts/decode-recording-body.js <path_to_recording.json>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  console.log(`Attempting to decode Base64 request bodies from: ${filePath}`);

  let fileContent;
  try {
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: File not found at ${filePath}`);
    } else {
      console.error(`Error reading file ${filePath}:`, error);
    }
    process.exit(1);
  }

  let recordings;
  try {
    recordings = JSON.parse(fileContent);
    if (!Array.isArray(recordings)) {
      throw new Error('JSON content is not an array.');
    }
  } catch (error) {
    console.error(`Error parsing JSON from ${filePath}:`, error);
    process.exit(1);
  }

  console.log(`Found ${recordings.length} recording(s) in the file.`);

  recordings.forEach((record, index) => {
    console.log(`\n--- Record ${index + 1} ---`);
    if (record.request && typeof record.request.body === 'string') {
      console.log('Request Method:', record.request.method);
      console.log('Request Path:', record.request.path);
      console.log('Decoded Request Body:');
      console.log(decodeAndFormatBody(record.request.body));
    } else {
      console.log('No Base64 request body found in this record\'s request object.');
    }
    // Optionally decode response body too if needed
    // if (record.response && typeof record.response.body === 'string') {
    //   console.log('\nDecoded Response Body:');
    //   console.log(decodeAndFormatBody(record.response.body));
    // }
    console.log('--- End Record ---');
  });
}

main().catch(err => {
  console.error('Script failed unexpectedly:', err);
  process.exit(1);
}); 