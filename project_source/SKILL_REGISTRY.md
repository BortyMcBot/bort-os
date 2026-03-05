# SKILL_REGISTRY.md
Generated: Mar 03, 2026

This file documents installed Bort skills with enough detail for prompt construction.
Format: name | hats | what it does | key inputs | key outputs | notes

---

## Skills by category

### Communication & Messaging
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| bluebubbles | ops-core, inbox | Use when you need to send or manage iMessages via BlueBubbles; calls go through the generic message tool with `channel:"bluebubbles"`. | `target` (chat_guid/E.164/email), `message`, `messageId` for react/edit/unsend, attachment `path` or `buffer`+`filename`. | Message send/edit/reply/unsend, reactions, attachment delivery via message tool. | Requires config `channels.bluebubbles`. SKILL.md: /usr/lib/node_modules/openclaw/skills/bluebubbles/SKILL.md |
| imsg | ops-core, inbox | iMessage/SMS CLI for listing chats, history, and sending messages via Messages.app. | CLI args to `imsg` (chat selection, message body). | CLI stdout; message send/receive via Messages.app. | Requires bin `imsg`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/imsg/SKILL.md |
| discord | ops-core | Discord ops via the message tool (`channel:"discord"`). | Message tool fields (target/channel/message, reactions, edits). | Discord messages, reactions, edits via message tool. | Requires `channels.discord.token` config; respects `channels.discord.actions.*` gating. SKILL.md: /usr/lib/node_modules/openclaw/skills/discord/SKILL.md |
| himalaya | inbox | CLI email client for IMAP/SMTP: list, read, write, reply, forward, search, organize. | CLI args to `himalaya` (account, folder, query, message). | CLI output; email actions via IMAP/SMTP. | Requires bin `himalaya`. SKILL.md: /usr/lib/node_modules/openclaw/skills/himalaya/SKILL.md |

### Email & Inbox
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| (gmail) | inbox | Gmail daily summary and triage — listed in hat-profiles, not skill inventory. | Inbox contents via daily-review.js. | Digest / triage report. | Runs via integrations/gmail/daily-review.js (no SKILL.md). |

### Research & Web
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| blogwatcher | web | Monitor blogs and RSS/Atom feeds for updates via `blogwatcher` CLI. | Feed URLs; CLI args (`add`, `list`, `check`). | CLI output; new post summaries/links. | Requires bin `blogwatcher`. SKILL.md: /usr/lib/node_modules/openclaw/skills/blogwatcher/SKILL.md |
| gemini | web, ops-core | Gemini CLI for one-shot Q&A, summaries, and generation. | Prompt string; optional `--model`, `--output-format`. | CLI stdout (text/JSON). | Requires bin `gemini`. SKILL.md: /usr/lib/node_modules/openclaw/skills/gemini/SKILL.md |
| gifgrep | web | Search GIF providers (Tenor/Giphy), browse in TUI, download, extract stills/sheets. | Search query; CLI args for download/extract. | GIF files, still images/sheets, CLI output. | Requires bin `gifgrep`. SKILL.md: /usr/lib/node_modules/openclaw/skills/gifgrep/SKILL.md |
| goplaces | web | Google Places API (New) CLI for text search, place details, reviews; supports `--json`. | Query text/place ID; `--json` for structured output. | Human-readable output or JSON. | Requires bin `goplaces` + env `GOOGLE_PLACES_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/goplaces/SKILL.md |
| pinchtab | ops-core, web, resale | HTTP browser automation bridge — navigate, snapshot a11y tree, extract text, click/type by ref, screenshots, PDF export. Stealth mode, persistent sessions, tab management. | Base URL (default http://localhost:9867), BRIDGE_TOKEN from ~/.pinchtab/.env, tabId for multi-tab ops. CLI: pinchtab nav/snap/text/click/type/ss/pdf/eval | JSON a11y snapshot, plain text extraction, JPEG screenshots, PDF files, health status. | Requires pinchtab binary and Chrome/Chromium. Start server manually before use. Token stored at ~/.pinchtab/.env. SKILL.md: /usr/lib/node_modules/openclaw/skills/pinchtab/SKILL.md |


### Productivity & Google Workspace
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| gog | resale | Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, Docs. | OAuth credentials; CLI args for service + action. | CLI output; data read/write to Google services. | Requires bin `gog`. SKILL.md: /usr/lib/node_modules/openclaw/skills/gog/SKILL.md |

### Smart Home & Devices
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| eightctl | resale, ops-core | Control Eight Sleep pods (status, temperature, alarms, schedules). | CLI args (device, temp, schedule). | CLI output; device state changes. | Requires bin `eightctl` and auth/config. SKILL.md: /usr/lib/node_modules/openclaw/skills/eightctl/SKILL.md |

### Resale Operations
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|

### Development & Code
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| coding-agent | autonomous, ops-core | Delegate coding tasks to Codex/Claude Code/Pi via interactive CLI (pty). | Task spec; repo path; agent selection (`codex|claude|pi`). | Code changes, diffs/PRs produced by agent. | Requires any of bins: `claude`, `codex`, `opencode`, `pi`. Uses bash with pty. SKILL.md: /usr/lib/node_modules/openclaw/skills/coding-agent/SKILL.md |
| github | autonomous, ops-core | GitHub ops via `gh` CLI: issues, PRs, CI runs, review, API queries. | Repo, issue/PR identifiers, `gh` subcommands/flags. | CLI output; PRs/issues/comments. | Requires bin `gh`. SKILL.md: /usr/lib/node_modules/openclaw/skills/github/SKILL.md |
| gh-issues | autonomous, ops-core | Orchestrate GitHub issue triage and PRs using curl + REST API. | owner/repo + flags (`--label`, `--limit`, `--milestone`, etc.). | Issue list, spawned fix tasks, PR updates. | Requires bins `curl`, `git`, `gh` (per metadata); uses GH_TOKEN env. SKILL.md: /usr/lib/node_modules/openclaw/skills/gh-issues/SKILL.md |
| mcporter | ops-core | MCP server/tool management via `mcporter` CLI (list, configure, auth, call). | Server name/tool selector + key=value args. | CLI output; tool call results. | Requires bin `mcporter`. SKILL.md: /usr/lib/node_modules/openclaw/skills/mcporter/SKILL.md |

### Media & Content
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| nano-banana-pro | resale | Generate or edit images via Gemini 3 Pro Image (Nano Banana Pro). | Prompt + output filename; optional edit inputs. | Generated/edited image files. | Requires `uv` + env `GEMINI_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/nano-banana-pro/SKILL.md |
| camsnap | ops-core | Capture frames or clips from RTSP/ONVIF cameras. | Camera name/host, snapshot/clip args. | Image or clip files. | Requires bin `camsnap` and config at `~/.config/camsnap/config.yaml`. SKILL.md: /usr/lib/node_modules/openclaw/skills/camsnap/SKILL.md |
| openai-image-gen | ops-core, autonomous | Batch-generate images via OpenAI Images API; creates gallery. | Prompt list/config; output format/size. | Image files + `prompts.json` + `index.html` gallery. | Requires `python3` + env `OPENAI_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/openai-image-gen/SKILL.md |
| openai-whisper | ops-core | Local speech-to-text with Whisper CLI. | Audio path; `--model`, `--output_format`, `--output_dir`, `--task`. | Transcripts as `.txt`/`.srt`/etc in output dir. | Requires bin `whisper`. SKILL.md: /usr/lib/node_modules/openclaw/skills/openai-whisper/SKILL.md |
| openai-whisper-api | ops-core | Whisper transcription via OpenAI API (curl script). | Audio path; optional `--model`, `--out`, `--language`, `--prompt`, `--json`. | Transcript text or JSON file (default `<input>.txt`). | Requires `curl` + env `OPENAI_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/openai-whisper-api/SKILL.md |
| nano-pdf | ops-core | Edit PDFs via natural-language instructions using `nano-pdf`. | PDF path + page number + instruction string. | Modified PDF output (per CLI). | Requires bin `nano-pdf`. SKILL.md: /usr/lib/node_modules/openclaw/skills/nano-pdf/SKILL.md |

### Platform & Tools
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| 1password | ops-core | Set up and use 1Password CLI (`op`) for secrets retrieval and injection. | Vault/item/field references; `op` subcommands. | Secret values or command output (sensitive). | Requires bin `op`. High-sensitivity output; follow suppression rules. SKILL.md: /usr/lib/node_modules/openclaw/skills/1password/SKILL.md |
| clawhub | ops-core | ClawHub CLI to search/install/update/publish skills from clawhub.com. | Search query, skill name, version, publish args. | Installed skill folders or publish output. | Requires bin `clawhub`. SKILL.md: /usr/lib/node_modules/openclaw/skills/clawhub/SKILL.md |
| healthcheck | ops-core | Host security hardening and risk-tolerance configuration for OpenClaw deployments. | Target host/context; audit/hardening choices. | Security report + recommended actions. | No bin requirements listed. SKILL.md: /usr/lib/node_modules/openclaw/skills/healthcheck/SKILL.md |
| model-usage | ops-core | CodexBar CLI usage/cost summaries per model (Codex/Claude). | Provider (`codex|claude`), optional input JSON, `--format`. | Text or JSON cost summary (no per-model tokens). | Requires bin `codexbar`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/model-usage/SKILL.md |

### Notes & Knowledge
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| apple-notes | ops-core, inbox | Manage Apple Notes via `memo` CLI (create/view/edit/delete/search/move/export). | Note title/content; folder; CLI flags. | Notes created/updated; exported files. | Requires bin `memo`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/apple-notes/SKILL.md |
| apple-reminders | ops-core, inbox | Manage Apple Reminders via `remindctl` CLI (list/add/edit/complete/delete). | Reminder text, list name, due date, filters. | CLI output; reminders created/updated. | Requires bin `remindctl`; macOS only (`os: darwin`). SKILL.md: /usr/lib/node_modules/openclaw/skills/apple-reminders/SKILL.md |
| bear-notes | ops-core | Create/search/manage Bear notes via `grizzly` CLI. | Note title/content/tags; CLI flags. | Notes created/updated; CLI output. | Requires bin `grizzly`; macOS only. Some ops require Bear app token. SKILL.md: /usr/lib/node_modules/openclaw/skills/bear-notes/SKILL.md |
| notion | ops-core | Notion API for creating/managing pages, databases, blocks. | API key + page/database IDs + payload. | Notion pages/blocks created/updated; API responses. | Requires env `NOTION_API_KEY`. SKILL.md: /usr/lib/node_modules/openclaw/skills/notion/SKILL.md |
| obsidian | ops-core | Work with Obsidian vaults (Markdown files) via `obsidian-cli`. | Vault path; note path; CLI args. | Markdown files created/updated; CLI output. | Requires bin `obsidian-cli`. SKILL.md: /usr/lib/node_modules/openclaw/skills/obsidian/SKILL.md |

### Automation
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| pr-review | ops-core | Trigger an immediate PR review run on BortyMcBot/bort-os. Invoked via Telegram /pr-review command or directly. | `--silent` flag for quiet mode, `--dry-run` for simulation. | Summary of decisions: merged/flagged/skipped counts + Telegram notifications. | Wraps scripts/pr-review-job.mjs. Cron also runs at 7am + 6pm Phoenix. |

### Social
| Skill | Allowed Hats | Description | Key Inputs | Key Outputs | Notes |
|-------|-------------|-------------|------------|-------------|-------|
| blucli | ops-core | BluOS CLI (`blu`) for discovery, playback, grouping, volume. | Device selection + playback/volume commands. | CLI output; device control effects. | Requires bin `blu`. SKILL.md: /usr/lib/node_modules/openclaw/skills/blucli/SKILL.md |

---

## Action items for Bryan
- Confirm which hats each skill is actually callable from (some above are inferred from hat-profiles).
- Clarify if any of these skills are installed-but-dormant vs actively used.

---

## How this file is used
Claude references this registry when drafting Task Envelope prompts to:
1. Select the correct skill tag for actions field
2. Avoid referencing skills not allowed for the target hat
3. Flag when a task requires a skill with no documented capability
