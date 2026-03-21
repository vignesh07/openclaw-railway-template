# Build openclaw from source to avoid npm packaging gaps (some dist files are not shipped).
FROM node:22-bookworm AS openclaw-build

# Dependencies needed for openclaw build
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Install Bun (openclaw build uses it)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /openclaw
ENV NODE_OPTIONS=--max-old-space-size=4096

ARG OPENCLAW_GIT_REF=main
RUN git clone --depth 1 --branch "${OPENCLAW_GIT_REF}" https://github.com/AaronPerk/openclaw.git .

# Patch: relax version requirements for packages that may reference unpublished versions.
# Apply to all extension package.json files to handle workspace protocol (workspace:*).
RUN set -eux; \
  find ./extensions -name 'package.json' -type f | while read -r f; do \
    sed -i -E 's/"openclaw"[[:space:]]*:[[:space:]]*">=[^"]+"/"openclaw": "*"/g' "$f"; \
    sed -i -E 's/"openclaw"[[:space:]]*:[[:space:]]*"workspace:[^"]+"/"openclaw": "*"/g' "$f"; \
  done

RUN pnpm config set fetch-retries 5 \
  && pnpm config set fetch-retry-factor 2 \
  && pnpm config set fetch-retry-maxtimeout 120000 \
  && pnpm config set network-timeout 600000 \
  && pnpm install --no-frozen-lockfile
# OpenClaw v2026.3.13-1 expects the generated A2UI bundle to exist before `build:docker`.
# The bundle is gitignored upstream, so Docker builds must generate it explicitly.
RUN pnpm canvas:a2ui:bundle && pnpm build:docker
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm --dir ui run build


# Runtime image
# Use Debian Stable directly for the final image, then copy in the Node.js toolchain
# from the official Node build stage above. This keeps runtime on Debian Stable while
# preserving the existing Node 22 / corepack behavior.
FROM debian:stable-slim

ARG ENABLE_DESKTOP

ENV NODE_ENV=production

COPY --from=openclaw-build /usr/local/ /usr/local/

RUN set -eux; \
  apt-get update; \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    python3 \
    python3-venv \
    tini; \
  if [ -n "${ENABLE_DESKTOP:-}" ]; then \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      at-spi2-core \
      dbus-x11 \
      gir1.2-gtk-3.0 \
      python3-dogtail \
      python3-gi \
      python3-pyatspi \
      wmctrl \
      x11-utils \
      xauth \
      xdotool \
      xvfb \
      xfce4-panel \
      xfce4-session \
      xfce4-settings \
      xfdesktop4 \
      xfwm4; \
  fi; \
  rm -rf /var/lib/apt/lists/*

# `openclaw update` expects pnpm. Provide it in the runtime image.
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Persist user-installed tools by default by targeting the Railway volume.
# - npm global installs -> /data/npm
# - pnpm global installs -> /data/pnpm (binaries) + /data/pnpm-store (store)
ENV NPM_CONFIG_PREFIX=/data/npm
ENV NPM_CONFIG_CACHE=/data/npm-cache
ENV PNPM_HOME=/data/pnpm
ENV PNPM_STORE_DIR=/data/pnpm-store
ENV PATH="/data/npm/bin:/data/pnpm:${PATH}"

WORKDIR /app

# Wrapper deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy built openclaw
COPY --from=openclaw-build /openclaw /openclaw

# Provide an openclaw executable
RUN printf '%s\n' '#!/usr/bin/env bash' 'exec node /openclaw/dist/entry.js "$@"' > /usr/local/bin/openclaw \
  && chmod +x /usr/local/bin/openclaw

COPY scripts/start-desktop.sh scripts/container-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-desktop.sh /usr/local/bin/container-entrypoint.sh

COPY app ./app
COPY components ./components
COPY lib ./lib
COPY src ./src
COPY next.config.mjs postcss.config.mjs tailwind.config.js jsconfig.json ./

RUN npm run setup:build && npm prune --omit=dev && npm cache clean --force

# The wrapper listens on $PORT.
# IMPORTANT: Do not set a default PORT here.
# Railway injects PORT at runtime and routes traffic to that port.
# If we force a different port, deployments can come up but the domain will route elsewhere.
ARG DEV_PORT
EXPOSE 8080 ${DEV_PORT}

# Ensure PID 1 reaps zombies and forwards signals.
ENTRYPOINT ["/usr/local/bin/container-entrypoint.sh"]
CMD ["node", "src/server.js"]
