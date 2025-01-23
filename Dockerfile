# Use Node.js 22-alpine image
FROM node:22-alpine

# Set the working directory
WORKDIR /usr/src/app

# Install system dependencies
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# Set environment variables for PNPM
ENV PNPM_HOME=/usr/local/share/.pnpm
ENV PATH=$PNPM_HOME/bin:$PATH
ENV SHELL=/bin/sh

# Install pnpm globally and create global bin directory
RUN npm install -g pnpm && mkdir -p $PNPM_HOME && chmod -R 775 $PNPM_HOME

# Ensure PATH is available for global installations
RUN export PATH=$PNPM_HOME/bin:$PATH && pnpm add -g ts-node typescript

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install project dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy application code
COPY . .

# Expose the port the app listens on
EXPOSE 3000

# Start the application
CMD ["pnpm", "start", "--filter", "@ai16z/agent", "--character=characters/gai.character.json"]
