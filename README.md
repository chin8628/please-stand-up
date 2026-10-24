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

Copy `.env.example` to `.env` and set both values.

- `TOKEN` is discord bot token.
- `DISCORD_APP_ID` is discord bot application id.

 `TOKEN` and `DISCORD_APP_ID` can be found in Discord Portal Developer after you created your own bot.

### Run locally

Use Node 22 and enable the PNPM version pinned by the repository:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

### Run with Docker Compose

```sh
docker compose up --build -d
```

Settings are stored in `./data` on the host. Stop the bot with `docker compose down`.

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
