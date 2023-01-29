![image](https://user-images.githubusercontent.com/2943187/207028355-a0254b12-4bb7-4011-ad83-bb346d80f127.png)

# Please Stand Up

~Discord bot for playing "Ma-ha-leuk" song when people joining~

Let you know who joining or leaving your Discord's channel.

## Features

- Speak joining or leaving user's name
- Set alias name instead of calling a person by their username

## Installation

### Create a discord bot on Discord Portal

We don't provide any service so you need to create and run a bot on your own. You must create a bot on Discord Portal Developer. Check this [document](https://discord.com/developers/docs/intro).

#### Required bot permissions

- Send Messages
- Use Slash Commands
- Connect
- Speak

### Run a bot

There are two options to install/run a bot.

- **[Recommended]** Run this bot on your server using docker container. https://hub.docker.com/r/chin8628/please-stand-up
- Download this project then run it manually on any server. (Need to create alias data file which I didn't write a document yet.)

You need to specify environment variables before starting the bot. Please read the next section.

### For docker user

`docker run -v please-stand-up:/data chin8628/please-stand-up:latest`

`/data` keeps aliases data file. All aliases can be lost if the directory wasn't mounted to host.

### Environment Variables

The bot needs `.env` file at root project directory. You can an example field in `.env.example`

- `TOKEN` is discord bot token.
- `DISCORD_APP_ID` is discord bot application id.

 `TOKEN` and `DISCORD_APP_ID` can be found in Discord Portal Developer after you created your own bot.

### Register slash commands to Discord

Once you create your discord bot, you need to regis all slash commands in order to use it.

1. Please verify if you already specify required environment variables.
2. Run `ts-node scripts/registerCommands.ts`
