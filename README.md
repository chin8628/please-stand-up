![workflow status badge](https://github.com/chin8628/please-stand-up/actions/workflows/pipeline.yaml/badge.svg?branch=main)

![image](https://user-images.githubusercontent.com/2943187/207028355-a0254b12-4bb7-4011-ad83-bb346d80f127.png)

# Please Stand Up

A Discord bot that speaks short notices in your voice channels, so you hear who joined, left or went AFK without looking at the screen.

## Features

- Speaks a member's name when they join, leave, switch channels or are moved to the AFK channel.
- Batches people who arrive together into one sentence ("A and B joined") and drops a join that is undone within a moment.
- Custom names (`/callme`) and custom join and leave sentences (`/setjointemplate`, `/setlefttemplate`).
- Pluggable text-to-speech: Google Cloud (default) or the credential-free Google Translate voice.
- **Multiple Speakers:** add several bot accounts and each one covers its own voice channel, so announcements no longer wait for a single bot to hop between channels.

Not announced: the first person alone in an empty channel, user-limited channels, and the AFK channel itself.

## How multiple Speakers work

Each bot account is a **Speaker**. Give the app one token per Speaker in `TOKENS`:

- A voice channel is served by at most one Speaker, and two Speakers never share a channel.
- A Speaker stays in its channel while people are there and leaves once everyone else is gone.
- If every Speaker is already in a channel and a new channel needs an announcement, the Speaker that has been idle longest moves over. Announcements are never dropped; if every Speaker is mid-sentence, the announcement waits for the first to finish.
- The first token is the **Primary Speaker**. It alone watches voice activity and answers slash commands, so it must be in your server. The other Speakers only join channels and speak. If a non-primary token fails to log in the app warns and carries on without it; if the Primary Speaker fails, the app exits.
- The app supports one Discord server at a time.

With a single token it behaves like the original single bot.

## Installation

### Create a discord bot on Discord Portal

We don't provide any service so you need to create and run the bot on your own. Create one application per Speaker on the Discord Developer Portal (one is enough to start; see [the intro docs](https://discord.com/developers/docs/intro)) and invite each to your server.

#### Required bot permissions

For the Primary Speaker:

- Send Messages
- Use Slash Commands
- Connect
- Speak

Other Speakers only need **Connect** and **Speak**. Make sure every Speaker can see the voice channels you want it to join.

### Environment Variables

Copy `.env.example` to `.env` and set `TOKENS` (the bot tokens) and `PRIMARY_DISCORD_APP_ID` (the application id of the first bot). Both are in the Discord Developer Portal. The TTS variables below are read at startup, and the bot exits with a clear error if the configuration is invalid.

| Variable | Default | Description |
| --- | --- | --- |
| `TOKENS` | required | Comma-separated Discord bot tokens, one per Speaker. The first is the Primary Speaker, which listens for voice events and handles slash commands. Invite every bot to the server with Connect and Speak permissions. A single `TOKEN` is still accepted. |
| `PRIMARY_DISCORD_APP_ID` | required | Discord application id of the Primary Speaker. |
| `TTS_PROVIDER` | `google-cloud` | `google-cloud` (needs credentials) or `translate` (no credentials). |
| `TTS_DEFAULT_LANG` | `th` | Default speech language: `th` or `en`. |
| `TTS_VOICE_TH` | required for `google-cloud` | Google Cloud voice for Thai, e.g. `th-TH-Standard-A`. |
| `TTS_VOICE_EN` | required for `google-cloud` | Google Cloud voice for English, e.g. `en-US-Standard-C`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | - | Path to a service-account JSON key file (required for `google-cloud`). In a container this must be the path inside the container, e.g. `/run/secrets/gcp-tts.json`; for local `pnpm dev`, a host path such as `./secrets/gcp-tts.json`. |

The key file is required when `TTS_PROVIDER=google-cloud`.

### Create a Google Cloud service account

1. In the [Google Cloud console](https://console.cloud.google.com/), create or select a project (billing must be enabled on it).
2. Enable the **Cloud Text-to-Speech API** (APIs & Services > Library).
3. Go to IAM & Admin > Service Accounts and create a service account. No project role is needed for Text-to-Speech.
4. Open the service account > Keys > Add key > Create new key > **JSON**. Save it as `secrets/gcp-tts.json` (the `secrets/` folder is git-ignored and excluded from the Docker image).
5. Google offers a monthly free tier for Standard voices. Quotas and prices change, so check the current [pricing page](https://cloud.google.com/text-to-speech/pricing). To avoid any charge, set `TTS_PROVIDER=translate`.

Treat the key like a password and never commit it.

### Run locally

Use Node 22 and enable the PNPM version pinned by the repository:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

### Run with Docker Compose

Put your key at `./secrets/gcp-tts.json` (or remove that volume line and set `TTS_PROVIDER=translate`; Docker would otherwise create a directory at the missing path). `docker-compose.yml` mounts it read-only and points `GOOGLE_APPLICATION_CREDENTIALS` at it:

```yaml
services:
  please-stand-up:
    build: .
    env_file: .env
    environment:
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/gcp-tts.json
    restart: unless-stopped
    volumes:
      - ./data:/usr/app/data
      - ./secrets/gcp-tts.json:/run/secrets/gcp-tts.json:ro
```

```sh
docker compose up --build -d
```

Settings are stored in `./data` on the host. Stop the bot with `docker compose down`.

### Run with plain Docker

The image is published as `chin8628/please-stand-up`. `.env` is not baked into the image, so pass it at run time.

Mounted key file (the env var is the container path):

```sh
docker run -d --name please-stand-up --restart unless-stopped \
  --env-file .env \
  -e GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-tts.json \
  -v "$(pwd)/secrets/gcp-tts.json:/run/secrets/gcp-tts.json:ro" \
  -v "$(pwd)/data:/usr/app/data" \
  chin8628/please-stand-up
```

Without Google credentials, add `-e TTS_PROVIDER=translate`.

### Register slash commands

Slash commands belong to the Primary Speaker. After creating the bot, register them once (and again whenever commands change):

1. Make sure `TOKENS` and `PRIMARY_DISCORD_APP_ID` are set in `.env`. Only the first token is used.
2. Run `pnpm update-command`

### Commands

Commands are answered by the Primary Speaker.

- `/callme` stores the name the bot should announce for you.
- `/setjointemplate` and `/setlefttemplate` set the speech templates for the whole server. Templates must include `{name}`.
- `/status` privately shows the queue, each Speaker with the channel it is in and whether it is speaking, and the most recent speech failure.
- `/reset queue` cancels queued and active speech and disconnects every Speaker, so the bot can recover without server access.
- `/leave` disconnects every Speaker from voice.

## Troubleshooting

### Bot exits at startup with a TTS error

The TTS configuration is validated at startup, so problems show in `docker logs please-stand-up` (or `docker compose logs`).

- Missing credentials: with `TTS_PROVIDER=google-cloud`, set `GOOGLE_APPLICATION_CREDENTIALS` (for local `pnpm dev`, set it in `.env`, e.g. `./secrets/gcp-tts.json`), or switch to `TTS_PROVIDER=translate`.
- Key file not found: inside Docker, `GOOGLE_APPLICATION_CREDENTIALS` must be the container path (`/run/secrets/gcp-tts.json`), not the host path, and the file must be mounted there. If the host file did not exist, Docker creates an empty directory instead.
- Invalid JSON: the key file must be the complete, unmodified file downloaded from Google Cloud.
- Permission or API errors: confirm the Cloud Text-to-Speech API is enabled and billing is active on the key's project.
- Invalid value: `TTS_PROVIDER` must be `google-cloud` or `translate`, and `TTS_DEFAULT_LANG` must be `th` or `en`.

### A Speaker never joins a channel

- Check that the bot was invited to the server and can view and connect to that voice channel.
- A token that fails to log in is skipped with a warning in the logs. Look for `failed to log in` and check the token.
- `/status` shows which Speakers are running.

### Upgrading from a single-bot setup

`DISCORD_APP_ID` was renamed to `PRIMARY_DISCORD_APP_ID`. `TOKEN` still works, or switch to `TOKENS=` to add more bots. Re-run `pnpm update-command` after changing the Primary Speaker.

## Development

```sh
pnpm test       # Jest
pnpm typecheck
pnpm lint
```

Domain vocabulary is in [CONTEXT.md](CONTEXT.md); project notes for contributors and agents are in [AGENTS.md](AGENTS.md).
