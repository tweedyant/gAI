# Use a Node.js image
FROM node:23.3.0-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install system dependencies required for node-gyp
RUN apk add --no-cache python3 make g++ && \
    ln -sf python3 /usr/bin/python

# Copy package files to the working directory
COPY package.json pnpm-lock.yaml ./

# Install dependencies with pnpm
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Copy the application code
COPY . .

# Specify the port the app will listen on
EXPOSE 3000

# Start the application
CMD ["pnpm", "start", "--character=characters/gai.character.json"]
