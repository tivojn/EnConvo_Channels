# OpenClaw CLI Parity Mapping

## Status: Phase 1-4 Complete, Advancing on Priority 3+

## OpenClaw Command Domains (25+ domains, 142+ subcommands)

### Fully Implemented in enconvo_cli
| OpenClaw Command | enconvo_cli Equivalent | Status |
|---|---|---|
| `channels add` | `enconvo channels add` | done |
| `channels remove` | `enconvo channels remove` | done |
| `channels login` | `enconvo channels login` | done |
| `channels logout` | `enconvo channels logout` | done |
| `channels list` | `enconvo channels list` | done |
| `channels status` | `enconvo channels status` | done |
| `channels send` | `enconvo channels send` | done |
| `agents list` | `enconvo agents list` | done |
| `agents add` | `enconvo agents add` | done |
| `agents delete` | `enconvo agents delete` | done |
| `agents set-identity` | `enconvo agents set-identity` | done |
| `agents bindings` | `enconvo agents bindings` | done |
| `agents sync` | `enconvo agents sync` | done |
| `agents bind` | `enconvo agents bind` | done |
| `agents unbind` | `enconvo agents unbind` | done |
| `config get` | `enconvo config get` | done |
| `config set` | `enconvo config set` | done |
| `config unset` | `enconvo config unset` | done |
| `config path` | `enconvo config path` | done |
| `status` (top-level) | `enconvo status` | done |
| `doctor` | `enconvo doctor` | done |
| `health` | `enconvo health` | done |
| `message send` | `enconvo message send` | done |
| `sessions` | `enconvo sessions` | done |
| `logs` | `enconvo logs` | done |

### Priority 1: Next Up (Medium Impact)
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `configure` | Setup wizard (interactive) | medium |
| `message read` | Read recent messages | medium |
| `message broadcast` | Multi-target broadcast | medium |

### Priority 2: Infrastructure
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `gateway run/start/stop/status` | Adapter lifecycle management | high (use launchctl) |
| `security audit` | Config + state audit | medium |

### Priority 3: Advanced Features
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `plugins list/enable/disable/install` | Extension management | high |
| `cron add/rm/list/enable/disable` | Scheduled jobs | high |
| `hooks list/enable/disable` | Internal agent hooks | high |
| `memory search/index/status` | Vector search | high |
| `browser *` | 40+ Playwright subcommands | very high |
| `nodes *` | Paired device management | very high |
| `sandbox list/recreate/explain` | Container isolation | high |

### Priority 4: Messaging Extensions
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `message search` | Search messages | medium |
| `message react/pin/unpin` | Reactions, pins | low |
| `message poll` | Send polls | medium |
| `message thread *` | Thread management | medium |
| `message ban/kick/timeout` | Moderation | medium |

### Not Applicable (EnConvo-specific differences)
- `pairing/devices` — EnConvo handles device management
- `dns` — Not relevant for EnConvo
- `acp` — EnConvo has its own protocol
- `secrets` — Different credential model
- `nodes` — EnConvo is a local macOS app, no remote nodes

## Implementation Progress

### Round-by-round delivery
| Round | Commands Added | Tests |
|---|---|---|
| Phase 12 | Bug fixes, delegation, agent-router | 38 tests |
| Round 4 | Message-splitter refactor | 50 tests |
| Round 5 | config get/set/unset/path, status, doctor | 72 tests |
| Round 6 | agents bind/unbind, message send | 72 tests |
| Round 7 | ESLint setup | 72 tests |
| Round 8 | health, sessions | 76 tests |
| Round 9 | Workspace/session-manager tests | 91 tests |
| Round 10 | logs, CLI integration tests | 96 tests |

### Current CLI surface
- **9 top-level commands**: channels, agents, config, message, status, doctor, health, sessions, logs
- **25+ implemented parity commands** (vs OpenClaw's 142+)
- **96 tests** across 11 suites
- **Zero ESLint warnings**, TypeScript clean
