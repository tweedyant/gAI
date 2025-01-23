# Use a compatible Node.js version (22.x)
FROM node:22-alpine

# Set the working directory
WORKDIR /usr/src/app

# Install build tools and dependencies
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm globally and project dependencies
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Install ts-node globally (if required)
RUN pnpm add -g ts-node typescript

# Copy the application code
COPY . .

# Specify the port the app will listen on
EXPOSE 3000

# Start the application
CMD ["pnpm", "start", "--character=characters/gai.character.json"]
