// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, IntentsBitField, Interaction } from 'discord.js'
import logger from 'npmlog'
import { commandsConfig } from './commands'
import { handler } from './handler'
import { isPleaseStandUp } from './helpers/isPleaseStandUp'

const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
})

client.login(process.env.TOKEN)
client.on('ready', () => {
	logger.info('', `Logged in as ${client.user.tag}!`)
})

client.on('voiceStateUpdate', async (prevState, newState) => {
	if (isPleaseStandUp(client, prevState) || isPleaseStandUp(client, newState)) return

	const isNotChannelUpdateEvent = prevState.channel?.id === newState.channel?.id
	if (isNotChannelUpdateEvent) {
		return
	}

	handler(prevState, newState)
})

client.on('interactionCreate', async (interaction: Interaction) => {
	if (!interaction.isChatInputCommand()) return
	const command = commandsConfig[interaction.commandName]
	if (!command) {
		await interaction.reply({
			content: `Command not found: ${interaction.commandName} isn't in the config key.`,
			ephemeral: true,
		})
		return
	}

	try {
		await command.execute(interaction)
	} catch (error) {
		logger.error('interactionCreate', `Command ${interaction.commandName} failed: ${error}`)
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'Command failed. Please try again.', ephemeral: true })
		}
	}
})
