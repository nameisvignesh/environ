FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    dbus-x11 \
    fluxbox \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    novnc \
    websockify \
    x11vnc \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run typecheck && npm run build && chown -R node:node /app

COPY docker/start.sh /usr/local/bin/environ-start
RUN sed -i 's/\r$//' /usr/local/bin/environ-start && chmod +x /usr/local/bin/environ-start

ENV DISPLAY=:0 \
    ENVIRON_WORKSPACE=/workspace
EXPOSE 6080
VOLUME ["/workspace"]
USER node

CMD ["/usr/local/bin/environ-start"]
