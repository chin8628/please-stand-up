import * as dotenv from 'dotenv'
dotenv.config()

import { REST, Routes } from 'discord.js'
import { parseSpeakerTokens } from '../src/config'
import { commandsConfig } from '../src/commands'

const BOT_ID = process.env.PRIMARY_DISCORD_APP_ID
// Commands belong to the Primary Speaker, the first configured token.
const [TOKEN] = parseSpeakerTokens(process.env)

if (!BOT_ID) {
	throw new Error(
		'PRIMARY_DISCORD_APP_ID env is undefined. Please specify PRIMARY_DISCORD_APP_ID in environment variables'
	)
}

const commands = Object.values(commandsConfig).map((item) => item.data.toJSON())
const rest = new REST({ version: '10' }).setToken(TOKEN)

;(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`)
		const data = await rest.put(Routes.applicationCommands(BOT_ID), { body: commands })

		// @ts-ignore
		console.log(`Successfully reloaded ${data.length} application (/) commands.`)
	} catch (error) {
		console.error(error)
	}
})()
