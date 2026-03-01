# enconvo_cli

CLI tool for managing [EnConvo AI](https://enconvo.com) channels, agents, and services. Deploy EnConvo agents as dedicated bots on **Telegram** and **Discord** — one bot per agent — and compose them into team groups.

**Stack:** TypeScript, Commander.js, Grammy (Telegram), discord.js (Discord), tsx

---

## Quick Start

```bash
npm install

# Telegram
enconvo channels add --channel telegram --name mavis \
  --token <TELEGRAM_BOT_TOKEN> --agent chat_with_ai/chat --validate
enconvo channels login --channel telegram --name mavis -f

# Discord
enconvo channels add --channel discord --name mavis-discord \
  --token <DISCORD_BOT_TOKEN> --agent chat_with_ai/chat --validate
enconvo channels login --channel discord --name mavis-discord -f
```

## Prerequisites

- **macOS** with Node.js (Homebrew or nvm)
- **EnConvo** running locally (listens on `http://localhost:54535`)
- Bot tokens — see [Telegram Bot Setup](#telegram-bot-setup) and [Discord Bot Setup](#discord-bot-setup)

---

## Architecture

```
EnConvo (agent factory, GUI)
  └── enconvo_cli (maps agents to channels, composes teams)
        ├── Telegram bots (one bot per agent, Grammy)
        ├── Discord bots (one bot per agent, discord.js)
        └── Agent groups (team compositions)
```

Each bot is a **dedicated instance** pinned to one EnConvo agent. No agent switching — each bot knows exactly which agent it serves.

**Flow:** Customize agent in EnConvo → Register via CLI → Deploy to channel → Compose into groups

Config stored at `~/.enconvo_cli/config.json`:

```json
{
  "channels": {
    "telegram": {
      "instances": {
        "mavis": { "enabled": true, "token": "...", "agent": "chat_with_ai/chat" }
      }
    },
    "discord": {
      "instances": {
        "mavis-discord": { "enabled": true, "token": "...", "agent": "chat_with_ai/chat" }
      }
    }
  }
}
```

---

## Telegram Bot Setup

### 1. Create a Bot via BotFather

1. Open Telegram, search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` → choose display name → choose username (must end in `bot`)
3. Save the API token (format: `1234567890:AAF...`)

### 2. Configure Bot Settings

**Disable Group Privacy** (required for group @mention support):

1. BotFather → `/setprivacy` → select bot → **Disable**
2. **Remove and re-add** the bot to any existing groups (Telegram caches privacy per membership)

**Optional — set commands menu:**
```
/setcommands → Select bot →
reset - Start a fresh conversation
status - Check connection status
help - Show help message
```

### 3. Register with enconvo_cli

```bash
enconvo channels add --channel telegram --name mavis \
  --token "1234567890:AAF..." \
  --agent chat_with_ai/chat \
  --validate

enconvo channels login --channel telegram --name mavis -f
```

### 4. Add to a Group (Optional)

- Create a Telegram group or use an existing one
- Add each bot as a member (privacy mode must be disabled)
- Bots respond to @mentions, replies, or targeted commands (`/reset@BotName`)

---

## Discord Bot Setup

### 1. Create the Application + Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. Name it (e.g. "Mavis - EnConvo") → Create
3. Go to **Bot** tab → click **Reset Token** → copy and save

### 2. Enable Privileged Intents

In the **Bot** tab, enable:
- **Message Content Intent** (required — the bot reads message text)

### 3. Invite to Your Server

1. Go to **OAuth2** → **URL Generator**
2. Select scopes: `bot`
3. Select permissions: `Send Messages`, `Read Message History`, `Attach Files`
4. Copy the generated URL → open in browser → select your server

### 4. Register with enconvo_cli

```bash
enconvo channels add --channel discord --name mavis-discord \
  --token "MTIzNDU2Nzg5..." \
  --agent chat_with_ai/chat \
  --validate

enconvo channels login --channel discord --name mavis-discord -f
```

### 5. Interaction Model

- **DMs:** Bot responds to all messages
- **Servers:** Bot responds when @mentioned, replied to, or on `!commands`
- **Commands:** `!reset`, `!status`, `!help` (prefix-based, not slash commands)

---

## CLI Reference

### Channel Management

```bash
# List all channels and instances
enconvo channels list [--json]

# Add a bot instance
enconvo channels add --channel <telegram|discord> --name <name> \
  --token <token> --agent <agent_path> [--validate]

# Start/stop instances
enconvo channels login --channel <telegram|discord> --name <name> -f
enconvo channels logout --channel <telegram|discord> --name <name>

# Monitor
enconvo channels status --channel <telegram|discord> [--name <name>]
enconvo channels logs --channel <telegram|discord> --name <name>

# Send a message via bot (calls EnConvo, delivers response to chat)
enconvo channels send --channel <telegram|discord> --name <name> \
  --chat <id> --message "hello" [--reset] [--json]
enconvo channels send --channel telegram --name mavis \
  --group main --message "hello"                        # named group

# Remove
enconvo channels remove --channel <telegram|discord> --name <name> [--delete]

# Resolve a user/channel identifier
enconvo channels resolve --channel <telegram|discord> --name <name> --identifier <id>

# Show channel capabilities
enconvo channels capabilities --channel <telegram|discord>
```

### Named Groups

```bash
# List groups
enconvo channels groups [--channel telegram]

# Add a named group (maps a human name to a chat/channel ID)
enconvo channels groups add --name main --chat-id "-5063546642" --label "Agents Group"

# Remove
enconvo channels groups remove --name main
```

### Agent Team Management

```bash
# View team roster
enconvo agents list [--bindings] [--json]

# Add an agent
enconvo agents add --id mavis --name Mavis --role "Team Lead" \
  --specialty "Coordination" --agent-path chat_with_ai/chat \
  --telegram-bot @Mavis_bot --instance-name mavis --emoji 👑 --lead

# Update identity
enconvo agents set-identity mavis --name "Mavis 2.0" --role "Chief Orchestrator"

# Show agent-to-channel bindings
enconvo agents bindings

# Sync prompts to EnConvo preferences (backs up first)
enconvo agents sync [--agent mavis] [--dry-run]

# Refresh agents (re-read workspace files)
enconvo agents refresh --group main [--agent mavis] [--reset] [--silent]

# Health check
enconvo agents check [--agent mavis] [--json]

# Remove an agent
enconvo agents delete timothy [--force]
```

---

## Multi-Instance Examples

```bash
# Deploy a full team — Telegram
enconvo channels add --channel telegram --name mavis    --agent chat_with_ai/chat                --token <t1> --validate
enconvo channels add --channel telegram --name elena    --agent custom_bot/YJBEY3qHhFslKkMd6WIT --token <t2> --validate
enconvo channels add --channel telegram --name vivienne --agent custom_bot/BVxrKvityKoIpdJjS4p7 --token <t3> --validate
enconvo channels add --channel telegram --name timothy  --agent custom_bot/pOPhKXnP1CmNjCSQZ1mK --token <t4> --validate

# Deploy a full team — Discord
enconvo channels add --channel discord --name mavis-discord    --agent chat_with_ai/chat                --token <d1> --validate
enconvo channels add --channel discord --name elena-discord    --agent custom_bot/YJBEY3qHhFslKkMd6WIT --token <d2> --validate
enconvo channels add --channel discord --name vivienne-discord --agent custom_bot/BVxrKvityKoIpdJjS4p7 --token <d3> --validate
enconvo channels add --channel discord --name timothy-discord  --agent custom_bot/pOPhKXnP1CmNjCSQZ1mK --token <d4> --validate

# Start all bots
enconvo channels login --channel telegram --name mavis -f &
enconvo channels login --channel discord --name mavis-discord -f &
```

---

## Group Chat Behavior

### Telegram

| Action | Result |
|---|---|
| `@BotName message` | Only that bot responds |
| Reply to bot's message | Only that bot responds |
| `/reset@BotName` | Resets only that bot's session |
| Bare `/reset` | Only one bot receives it (Telegram picks) |
| Regular text (no @mention) | No bot responds |

### Discord (Servers)

| Action | Result |
|---|---|
| `@BotName message` | Only that bot responds |
| Reply to bot's message | Only that bot responds |
| `!reset` | Resets session for that channel |
| `!status` / `!help` | Bot responds with info |
| Regular text (no @mention) | No bot responds |

**DMs:** Both Telegram and Discord bots respond to all DMs without mention-gating.

---

## Development

```bash
# Legacy single-bot mode (uses .env + config.json)
cp .env.example .env   # Set BOT_TOKEN
npm run dev

# CLI mode
npm run cli -- channels list
npx tsx src/cli.ts channels list

# Type check
npx tsc --noEmit
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Telegram bot ignores @mentions in groups | Privacy mode ON (BotFather default) | `/setprivacy` → Disable, remove/re-add bot to group |
| Only one Telegram bot responds to `/reset` | Telegram delivers bare commands to one bot | Use `/reset@BotUsername` |
| Discord bot ignores messages in server | Message Content Intent disabled | Enable in Developer Portal → Bot → Privileged Intents |
| 409 Conflict (Telegram) | Another process polling same token | `ps aux \| grep telegram` → kill old PID |
| Empty responses | EnConvo not running | `curl http://localhost:54535/health` |
| Bot works in DM but not group/server | Privacy mode (Telegram) or missing permissions (Discord) | Check BotFather / Developer Portal settings |
| Commands work but no text responses | Agent path incorrect | Verify with `enconvo channels list` |

---

## Project Structure

```
src/
  cli.ts                          # Commander.js entry point
  types/channel.ts                # ChannelAdapter interface
  channels/
    registry.ts                   # Adapter registry + factory
    telegram/                     # Telegram adapter (Grammy)
      adapter.ts                  #   ChannelAdapter implementation
      bot.ts                      #   Bot factory
      handlers/                   #   message, commands, media
      middleware/                 #   auth, mention-gate, typing
      utils/                      #   message-splitter (4096 chars)
    discord/                      # Discord adapter (discord.js)
      adapter.ts                  #   ChannelAdapter implementation
      bot.ts                      #   Bot factory
      handlers/                   #   message, commands, media
      middleware/                 #   mention-gate, typing
      utils/                      #   message-splitter (2000 chars), file-sender
  commands/
    channels/                     # CLI: list, add, remove, login, logout, send, etc.
    agents/                       # CLI: list, add, delete, sync, refresh, check, etc.
  services/
    enconvo-client.ts             # HTTP client for EnConvo API
    response-parser.ts            # Parse EnConvo responses (text + files)
    session-manager.ts            # Session ID management
    workspace.ts                  # OpenClaw-style workspace generation
    team-prompt.ts                # System prompt generator
  config/
    store.ts                      # Global config CRUD (~/.enconvo_cli/config.json)
    agent-store.ts                # Agent roster CRUD (~/.enconvo_cli/agents.json)
    paths.ts                      # Config directory paths
```

---

## License

ISC
