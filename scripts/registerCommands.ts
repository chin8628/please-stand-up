import * as dotenv from 'dotenv'
dotenv.config()

import { REST, Routes } from 'discord.js'
import { commandsConfig } from '../src/'

const BOT_ID = process.env.DISCORD_APP_ID
const TOKEN = process.env.TOKEN

if (!BOT_ID) {
	throw new Error('DISCORD_APP_ID env is undefined. Please specify DISCORD_APP_ID in environment variables')
}

if (!TOKEN) {
	throw new Error('TOKEN env is undefined. Please specify TOKEN in environment variables')
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
