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

# Pin to a known-good ref (tag/branch). Override in Railway template settings if needed.
# Using a released tag avoids build breakage when `main` temporarily references unpublished packages.
ARG OPENCLAW_GIT_REF=v2026.3.13-1
RUN git clone --depth 1 --branch "${OPENCLAW_GIT_REF}" https://github.com/openclaw/openclaw.git .

# Patch: relax version requirements for packages that may reference unpublished versions.
# Apply to all extension package.json files to handle workspace protocol (workspace:*).
RUN set -eux; \
  find ./extensions -name 'package.json' -type f | while read -r f; do \
    sed -i -E 's/"openclaw"[[:space:]]*:[[:space:]]*">=[^"]+"/"openclaw": "*"/g' "$f"; \
    sed -i -E 's/"openclaw"[[:space:]]*:[[:space:]]*"workspace:[^"]+"/"openclaw": "*"/g' "$f"; \
  done

RUN pnpm install --no-frozen-lockfile
# OpenClaw v2026.3.13-1 expects the generated A2UI bundle to exist before `build:docker`.
# The bundle is gitignored upstream, so Docker builds must generate it explicitly.
RUN pnpm canvas:a2ui:bundle && pnpm build:docker
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm ui:install && pnpm ui:build


# Runtime image
# Use Debian Stable directly for the final image, then copy in the Node.js toolchain
# from the official Node build stage above. This keeps runtime on Debian Stable while
# preserving the existing Node 22 / corepack behavior.
FROM debian:stable-slim

ENV NODE_ENV=production
ENV DISPLAY=:99
ENV XVFB_WHD=1280x800x24
ENV XDG_RUNTIME_DIR=/tmp/xdg-runtime
ENV XDG_CURRENT_DESKTOP=XFCE
ENV XDG_SESSION_DESKTOP=xfce
ENV DESKTOP_SESSION=xfce
ENV NO_AT_BRIDGE=0
ENV GTK_MODULES=gail:atk-bridge

COPY --from=openclaw-build /usr/local/ /usr/local/

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    at-spi2-core \
    bash \
    ca-certificates \
    dbus-x11 \
    gir1.2-gtk-3.0 \
    python3 \
    python3-dogtail \
    python3-gi \
    python3-pyatspi \
    python3-venv \
    tini \
    wmctrl \
    x11-utils \
    xauth \
    xdotool \
    xvfb \
    xfce4-panel \
    xfce4-session \
    xfce4-settings \
    xfdesktop4 \
    xfwm4 \
    chromium \
  && rm -rf /var/lib/apt/lists/*

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
RUN npm ci --omit=dev && npm cache clean --force

# Copy built openclaw
COPY --from=openclaw-build /openclaw /openclaw

# Provide an openclaw executable
RUN printf '%s\n' '#!/usr/bin/env bash' 'exec node /openclaw/dist/entry.js "$@"' > /usr/local/bin/openclaw \
  && chmod +x /usr/local/bin/openclaw

COPY scripts/start-desktop.sh scripts/container-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-desktop.sh /usr/local/bin/container-entrypoint.sh

COPY src ./src

# The wrapper listens on $PORT.
# IMPORTANT: Do not set a default PORT here.
# Railway injects PORT at runtime and routes traffic to that port.
# If we force a different port, deployments can come up but the domain will route elsewhere.
EXPOSE 8080

# Ensure PID 1 reaps zombies and forwards signals.
ENTRYPOINT ["/usr/local/bin/container-entrypoint.sh"]
CMD ["node", "src/server.js"]
