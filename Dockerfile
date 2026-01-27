# Build clawdbot from source to avoid npm packaging gaps (some dist files are not shipped).
FROM node:22-bookworm AS clawdbot-build

# Dependencies needed for clawdbot build
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
    golang \
 && rm -rf /var/lib/apt/lists/*

# Build gog (gogcli) from source
RUN git clone --depth 1 https://github.com/steipete/gogcli.git /tmp/gogcli \
 && cd /tmp/gogcli \
 && make \
 && install -m 0755 ./bin/gog /usr/local/bin/gog \
 && rm -rf /tmp/gogcli


# Install Bun (clawdbot build uses it)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /clawdbot

# Pin to a known ref (tag/branch). If it doesn't exist, fall back to main.
ARG CLAWDBOT_GIT_REF=main
RUN git clone --depth 1 --branch "${CLAWDBOT_GIT_REF}" https://github.com/clawdbot/clawdbot.git .

# Patch: relax version requirements for packages that may reference unpublished versions.
# Apply to all extension package.json files to handle workspace protocol (workspace:*).
RUN set -eux; \
  find ./extensions -name 'package.json' -type f | while read -r f; do \
    sed -i -E 's/"clawdbot"[[:space:]]*:[[:space:]]*">=[^"]+"/"clawdbot": "*"/g' "$f"; \
    sed -i -E 's/"clawdbot"[[:space:]]*:[[:space:]]*"workspace:[^"]+"/"clawdbot": "*"/g' "$f"; \
  done

RUN pnpm install --no-frozen-lockfile
RUN pnpm build
ENV CLAWDBOT_PREFER_PNPM=1
RUN pnpm ui:install && pnpm ui:build


# Runtime image
FROM node:22-bookworm
ENV NODE_ENV=production
COPY --from=clawdbot-build /usr/local/bin/gog /usr/local/bin/gog
ENV XDG_CONFIG_HOME=/data/.config
ENV XDG_DATA_HOME=/data/.local/share
ENV HOME=/data
RUN mkdir -p /data/.config /data/.local/share


RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Wrapper deps
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built clawdbot
COPY --from=clawdbot-build /clawdbot /clawdbot

# Provide a clawdbot executable
RUN printf '%s\n' '#!/usr/bin/env bash' 'exec node /clawdbot/dist/entry.js "$@"' > /usr/local/bin/clawdbot \
  && chmod +x /usr/local/bin/clawdbot

COPY src ./src

# The wrapper listens on this port.
ENV CLAWDBOT_PUBLIC_PORT=8080
ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.js"]
