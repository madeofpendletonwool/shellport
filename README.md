# Shellport

A self-hosted AI dev platform accessible from anywhere — phone, tablet, or browser. Manage terminal sessions, Claude Code sessions, expose localhost ports, and stream build logs, all through one authenticated web app.

## Features

- **Multi-terminal** — spawn and tab between shell sessions
- **Claude Code sessions** — launch `claude` CLI in a full PTY terminal
- **Port proxy** — expose any localhost port through `/proxy/:port/`
- **Log streaming** — tail log files via SSE
- **Auth** — JWT login + refresh cookies + named API keys for scripts/mobile
- **Single command** — `pnpm start` builds and runs everything

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 10+ | `npm install -g pnpm` |
| Claude Code | any | [claude.ai/code](https://claude.ai/code) *(optional, for Claude sessions)* |

---

## Setup

```bash
git clone <repo>
cd remote-term

pnpm install

cp .env.example .env
# Edit .env — set JWT_SECRET, REFRESH_SECRET, ADMIN_PASSWORD at minimum
```

### Generate secrets

```bash
# macOS / Linux
openssl rand -hex 32   # use for JWT_SECRET
openssl rand -hex 32   # use for REFRESH_SECRET
```

---

## Running

```bash
pnpm start
```

This builds the frontend and backend, then starts the server. Open **http://localhost:3001** and log in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### Development mode (hot reload)

```bash
pnpm dev
# frontend: http://localhost:5173
# backend:  http://localhost:3001
```

---

## External access (phone / remote)

Use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) for a free public URL:

```bash
# macOS
brew install cloudflared
cloudflared tunnel --url http://localhost:3001

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
cloudflared tunnel --url http://localhost:3001
```

Or ngrok:

```bash
ngrok http 3001
```

---

## Linux notes

On Linux, `node-pty` compiles from source and needs build tools:

```bash
sudo apt install python3 make g++   # Debian / Ubuntu
sudo dnf install python3 make gcc-c++   # Fedora / RHEL
```

Then install and start normally:

```bash
pnpm install
pnpm start
```

If `spawn-helper` isn't executable after install:

```bash
chmod +x node_modules/node-pty/prebuilds/linux-*/spawn-helper
```

---

## Environment variables

Set these in `.env` (copied from `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *required* | Secret for signing access tokens (min 16 chars) |
| `REFRESH_SECRET` | *required* | Secret for signing refresh tokens |
| `ADMIN_USERNAME` | `admin` | Username created on first run |
| `ADMIN_PASSWORD` | *required* | Password for the admin account (min 8 chars) |
| `PORT` | `3001` | Port the server listens on |
| `NODE_ENV` | `production` | `production` or `development` |
| `DB_PATH` | `./remote-term.db` | SQLite database file path |
| `LOG_DIRS` | `/tmp` | Colon-separated dirs the log viewer can tail |
| `DEFAULT_SHELL` | *auto* | Default shell for terminal sessions (auto-detected from `$SHELL`) |
| `CLAUDE_BIN` | *auto* | Path to the `claude` binary (auto-detected from `$PATH`) |

---

## Optional: nginx on port 80

If you want to run on port 80 (e.g. for a DNS-based tunnel), you can use the included Docker nginx overlay. The backend still runs natively; nginx proxies to it.

```bash
# Terminal 1 — native backend
pnpm start

# Terminal 2 — nginx on :80 proxying to :3001
docker compose up
```

Then access via **http://localhost**.

---

## API keys

Create named API keys in **Settings → API Keys**. Use them for scripting or future mobile clients:

```bash
curl http://localhost:3001/api/terminals \
  -H "Authorization: ApiKey <your-key>"
```

---

## Keyboard shortcuts (terminal)

| Key | Action |
|---|---|
| Click tab | Switch session |
| `+` button | New shell |
| Bot icon | New Claude Code session |
| Trash icon | Close session |
