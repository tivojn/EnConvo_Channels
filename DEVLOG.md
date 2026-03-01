# EnConvo Telegram Adapter — Development Log

> Living document. Updated as the project evolves. Read this to understand what exists, why decisions were made, and what's next.

**Last updated:** 2026-03-01

---

## What This Is

A Telegram bot that acts as a stateless proxy to **EnConvo AI** (a local macOS AI platform). Users chat with the bot on Telegram, and messages are forwarded to EnConvo's local API. Responses — including text, images, and files — are sent back through Telegram.

**Bot:** `@Encovo_Mavis_001_bot`
**Stack:** TypeScript, Grammy (Telegram bot framework), tsx (runtime)
**Repo:** https://github.com/tivojn/EnConvo_Channels

---

## Architecture

```
Telegram ←→ Grammy Bot (long polling) ←→ EnConvo API (localhost:54535)
```

### Core Design Decisions

1. **Stateless proxy** — The adapter doesn't store conversation history. It passes a `sessionId` to EnConvo, which handles context/memory internally.

2. **Long polling, not webhooks** — No public URL needed. The bot polls Telegram for updates. Simpler to run on a local Mac.

3. **Multi-agent support** — Users can switch between different EnConvo agents (Mavis, OpenClaw, Translator) via `/agent` command. Agents are configured in `config.json`.

4. **Session management** — Session IDs are deterministic (`telegram-{chatId}`). `/reset` appends a UUID suffix to start fresh. This maps to EnConvo's session-based context.

5. **Auth via allowlist** — `config.json` has `allowedUserIds`. Empty array = open to everyone. No database needed.

---

## File Structure

```
src/
├── index.ts              # Entry point, graceful shutdown handlers
├── bot.ts                # Bot creation, middleware + handler wiring
├── config.ts             # Loads .env + config.json, defines types
├── handlers/
│   ├── commands.ts       # /start, /help, /agent, /reset, /status
│   ├── message.ts        # Text message → EnConvo → reply
│   └── media.ts          # Photo/document download → EnConvo → reply
├── services/
│   ├── enconvo-client.ts # HTTP client for EnConvo API
│   ├── response-parser.ts# Parses EnConvo response formats (messages, result, flow_step, deliverables)
│   └── session-manager.ts# Session ID + agent selection per chat
├── middleware/
│   ├── auth.ts           # Allowlist check
│   └── typing.ts         # "typing..." indicator loop
└── utils/
    └── message-splitter.ts # Splits long replies at 4096 char Telegram limit

config.json               # Agent definitions, EnConvo URL, auth settings
.env                      # BOT_TOKEN (not committed)
```

---

## EnConvo API Integration

- **Base URL:** `http://localhost:54535`
- **Endpoint pattern:** `POST /command/call/{category}/{command}`
- **Request body:** `{ "input_text": "...", "sessionId": "..." }`
- **Response formats:**
  - Standard: `{ "type": "messages", "messages": [{ "role": "assistant", "content": [{ "type": "text", "text": "..." }] }] }`
  - Simple: `{ "result": "..." }` (used by Translator agent)
  - Flow steps: content items with `type: "flow_step"`, `flowParams` containing file paths or Deliverable objects
- **File delivery:** Response parser extracts absolute file paths from text content, `flow_step` params, and `Deliverable` objects. Files are sent as Telegram photos (images) or documents (everything else).

---

## Development Timeline

### Phase 1 — Initial Adapter (commit `c98f911`)
- Basic Grammy bot with long polling
- Text messages forwarded to EnConvo's default agent (Mavis)
- Session IDs based on Telegram chat ID
- Auth allowlist, typing indicator, message splitting

### Phase 2 — Multi-Agent Support (commit `553f50a`)
- Added `/agent` command to list and switch between EnConvo agents
- Agents configured in `config.json` with id, name, path, description
- Per-chat agent selection stored in memory (Map)

### Phase 3 — Command Filtering (commit `f23cb3f`)
- Unrecognized `/commands` blocked from being forwarded to EnConvo
- Prevents confusing AI responses to bot commands

### Phase 4 — Translator + Simple Response Format (commit `32a5254`)
- Added Translator agent to config
- Response parser handles `{ "result": "..." }` format alongside message arrays

### Phase 5 — File Delivery (commit `3ce018e`)
- Parse `Deliverable` objects from `flow_step` content
- Extract file paths from `flowParams` JSON
- Send images as photos, other files as documents
- Media handler: download Telegram photos/documents to `/tmp/`, include path in EnConvo request

### Phase 6 — Auto-Restart Service (2026-03-01)
- Created macOS LaunchAgent (`com.enconvo.telegram-adapter.plist`) for auto-restart on wake/crash/login
- `KeepAlive` with `NetworkState: true` — restarts when network returns (i.e., after Mac wakes)
- `RunAtLoad: true` — starts on user login
- **TCC workaround:** Project lives in `~/Downloads` (macOS-protected). LaunchAgent runs via `/bin/bash` (granted Full Disk Access), which `rsync`s project to `~/.local/share/enconvo-telegram-adapter/` before launching `node`. This avoids needing FDA for node itself.
- Install script auto-detects permission errors and opens System Settings to the right pane
- Scripts: `npm run install-service`, `npm run uninstall-service`, `npm run logs`

**Files added:**
- `com.enconvo.telegram-adapter.plist` — launchd plist template
- `scripts/run.sh` — rsync + launch wrapper
- `scripts/install.sh` — copies plist, loads agent, detects TCC errors
- `scripts/uninstall.sh` — unloads agent, removes plist

---

## Current State (2026-03-01)

**Working:**
- Bot running as LaunchAgent (auto-restarts on wake/crash/login)
- Text, photo, and document messages forwarded to EnConvo
- Multi-agent switching (Mavis, OpenClaw, Translator)
- File/image delivery from EnConvo responses
- Session management with `/reset`
- Auth allowlist (currently open — empty list)

**Configured agents:**
| ID | Name | Path | Description |
|---|---|---|---|
| `mavis` | Mavis | `chat_with_ai/chat` | Default AI assistant |
| `openclaw` | OpenClaw Assistant | `openclaw/OpenClaw` | OpenClaw agent manager |
| `translate` | Translator | `translate/translate` | Translate text between languages |

---

## Known Limitations & Future Work

- **No agent discovery** — Agents are manually configured in `config.json`. Waiting for EnConvo to expose an API to enumerate available agents/deeplinks.
- **In-memory state** — Agent selection and session overrides live in JS Maps. Lost on restart. Fine for single-user, but won't scale.
- **No retry on Telegram 409** — When two polling instances collide (e.g., during restart), the new instance crashes and waits for launchd to restart it. Could add retry logic with backoff.
- **Media handling is one-way** — Photos/docs are downloaded and path is sent as text to EnConvo. EnConvo may or may not use the file depending on the agent.
- **Markdown rendering** — Bot tries Telegram Markdown first, falls back to plain text. Some EnConvo responses use GitHub-flavored markdown that doesn't render correctly in Telegram.

### Phase 7 — CLI Refactor: `enconvo_cli` with `channels` Subcommand Group (2026-03-01)
- Refactored project into `enconvo_cli` — an extensible CLI tool modeled after OpenClaw's architecture
- Added **Commander.js** for hierarchical CLI subcommands
- **Moved Telegram code** into `src/channels/telegram/` (bot, config, handlers, middleware, utils)
- **Created ChannelAdapter interface** (`src/types/channel.ts`) — all channels implement this contract
- **Created centralized config system** at `~/.enconvo_cli/config.json` (`src/config/paths.ts`, `src/config/store.ts`)
- **Built TelegramAdapter** (`src/channels/telegram/adapter.ts`) wrapping existing bot code
- **Channel registry** (`src/channels/registry.ts`) — static adapter lookup, extensible for future channels
- **Refactored `enconvo-client.ts`** — `callEnConvo()` now accepts optional `url`/`timeoutMs` params
- **9 CLI subcommands**: `list`, `status`, `add`, `remove`, `login`, `logout`, `capabilities`, `resolve`, `logs`
- All commands support `--json` flag for machine-readable output
- `npm run dev` still works unchanged (backward compat via `src/index.ts`)
- `npm run cli` / `npx tsx src/cli.ts` for CLI access

**New file structure:**
```
src/
├── cli.ts                          # CLI entry point (Commander.js)
├── index.ts                        # Legacy dev entry (import path updated)
├── types/channel.ts                # ChannelAdapter interface
├── config/paths.ts                 # ~/.enconvo_cli/ path constants
├── config/store.ts                 # Global config read/write/migrate
├── commands/channels/              # 9 subcommands (list, add, login, etc.)
├── channels/registry.ts            # Adapter lookup
├── channels/telegram/              # Telegram adapter + all bot code
│   ├── adapter.ts                  # Implements ChannelAdapter
│   ├── bot.ts, config.ts           # Moved from src/
│   ├── handlers/, middleware/, utils/  # Moved from src/
└── services/                       # Shared (enconvo-client, response-parser, session-manager)
```

**CLI usage:**
```bash
enconvo channels list                          # List channels + status
enconvo channels add --channel telegram --token <token>  # Configure
enconvo channels login --channel telegram -f   # Start in foreground
enconvo channels status --probe                # Check runtime
enconvo channels logs --channel telegram       # Tail logs
enconvo channels logout --channel telegram     # Stop service
enconvo channels capabilities --channel telegram  # Show features
```

---

## How to Run

### Development
```bash
cp .env.example .env  # Add BOT_TOKEN
npm install
npm run dev
```

### Production (LaunchAgent)
```bash
npm run install-service   # Install + start
npm run logs              # Watch output
npm run uninstall-service # Stop + remove
```

### Prerequisites
- macOS with Homebrew node
- EnConvo running locally (port 54535)
- Telegram bot token in `.env`
- For LaunchAgent: `/bin/bash` needs Full Disk Access (install script guides you through this)
