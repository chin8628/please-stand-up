![workflow status badge](https://github.com/chin8628/please-stand-up/actions/workflows/pipeline.yaml/badge.svg?branch=main)

![image](https://user-images.githubusercontent.com/2943187/207028355-a0254b12-4bb7-4011-ad83-bb346d80f127.png)

# Please Stand Up

~Discord bot for playing "Ma-ha-leuk" song when people joining~

Let you know who joining or leaving your Discord's channel.

## Features

- Announce a person name who join or leave a channel including switching between channels
- Set alias name instead of calling a person by their username

## Installation

### Create a discord bot on Discord Portal

We don't provide any service so you need to create and run a bot on your own. You must create a bot on Discord Portal Developer. Check this [document](https://discord.com/developers/docs/intro).

#### Required bot permissions

- Send Messages
- Use Slash Commands
- Connect
- Speak

### Environment Variables

Copy `.env.example` to `.env` and set `TOKENS` and `PRIMARY_DISCORD_APP_ID` (both found in Discord Portal Developer after you created your bot). The TTS variables below are read at startup, and the bot exits with a clear error if the configuration is invalid.

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

Once you create your discord bot, you need to regis all slash commands in order to use it.

1. Please verify if you already specify required environment variables.
2. Run `pnpm update-command`

### Commands

- `/callme` stores the name the bot should announce for you.
- `/setjointemplate` and `/setlefttemplate` set the speech templates. Templates must include `{name}`.
- `/status` shows the queue, voice connection, active speech, and most recent speech failure privately.
- `/reset queue` cancels queued and active speech, then disconnects the bot so it can recover without server access.
- `/leave` disconnects the bot from voice.

## Troubleshooting

### Bot exits at startup with a TTS error

The TTS configuration is validated at startup, so problems show in `docker logs please-stand-up` (or `docker compose logs`).

- Missing credentials: with `TTS_PROVIDER=google-cloud`, set `GOOGLE_APPLICATION_CREDENTIALS` (for local `pnpm dev`, set it in `.env`, e.g. `./secrets/gcp-tts.json`), or switch to `TTS_PROVIDER=translate`.
- Key file not found: inside Docker, `GOOGLE_APPLICATION_CREDENTIALS` must be the container path (`/run/secrets/gcp-tts.json`), not the host path, and the file must be mounted there. If the host file did not exist, Docker creates an empty directory instead.
- Invalid JSON: the key file must be the complete, unmodified file downloaded from Google Cloud.
- Permission or API errors: confirm the Cloud Text-to-Speech API is enabled and billing is active on the key's project.
- Invalid value: `TTS_PROVIDER` must be `google-cloud` or `translate`, and `TTS_DEFAULT_LANG` must be `th` or `en`.
