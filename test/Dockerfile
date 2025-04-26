# Use official Node.js 22 image
FROM node:22

# Set working directory
WORKDIR /usr/src/app

# Copy the entire project context
COPY . .

# Install all dependencies (including dev) and run postinstall
# This installs Node deps, downloads uv, creates venv, and installs Python deps
RUN npm install

# Debug: Check if Python executable was created
RUN ls -la .venv/bin/python

# Run the internal tests
CMD ["npm", "test"] 