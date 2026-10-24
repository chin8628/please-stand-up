// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, Events, IntentsBitField, Interaction } from 'discord.js'
import logger from 'npmlog'
import { configureTts, isSpeaking, stopSpeaking } from './botAction'
import { commandsConfig } from './commands'
import { handler } from './handler'
import { disconnectBot } from './helpers/disconnectBotIfAlone'
import { isPleaseStandUp } from './helpers/isPleaseStandUp'
import { createShutdownHandler } from './shutdown'
import { createGoogleCloudTts, createGoogleTranslateTts } from './tts'

let isAcceptingVoiceEvents = true

const ttsProviders = {
	'google-cloud': createGoogleCloudTts,
	translate: createGoogleTranslateTts,
}

try {
	const ttsProviderName = process.env.TTS_PROVIDER?.trim() || 'google-cloud'
	if (!(ttsProviderName in ttsProviders)) {
		throw new Error(`TTS_PROVIDER="${ttsProviderName}" is invalid. Valid values: ${Object.keys(ttsProviders).join(', ')}`)
	}
	configureTts(ttsProviders[ttsProviderName as keyof typeof ttsProviders](process.env))
} catch (error) {
	logger.error('tts', `Invalid TTS configuration: ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
}

const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
})

client.login(process.env.TOKEN)
client.on(Events.ClientReady, () => {
	logger.info('', `Logged in as ${client.user.tag}!`)
})

client.on('voiceStateUpdate', async (prevState, newState) => {
	if (!isAcceptingVoiceEvents) return
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

const shutdown = createShutdownHandler({
	isSpeaking,
	stopSpeaking,
	disconnect: () => {
		for (const guild of client.guilds.cache.values()) {
			disconnectBot(guild.id)
		}
	},
	close: () => client.destroy(),
})

const handleSignal = (signal: string) => {
	isAcceptingVoiceEvents = false
	logger.info('shutdown', `Received ${signal}; shutting down.`)
	void shutdown()
}

process.once('SIGINT', () => handleSignal('SIGINT'))
process.once('SIGTERM', () => handleSignal('SIGTERM'))
