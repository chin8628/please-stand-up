// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, Events, IntentsBitField, Interaction } from 'discord.js'
import logger from 'npmlog'
import { configureTts, isSpeaking, stopSpeaking } from './botAction'
import { commandsConfig } from './commands'
import { handler } from './handler'
import { parseSpeakerTokens } from './config'
import { disconnectBot } from './helpers/disconnectBotIfAlone'
import { isPleaseStandUp } from './helpers/isPleaseStandUp'
import { createShutdownHandler } from './shutdown'
import { configureSpeakers, getPrimarySpeaker, getSpeakers, Speaker } from './speakers'
import { startSpeakers } from './startSpeakers'
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

let tokens: string[]
try {
	tokens = parseSpeakerTokens(process.env)
} catch (error) {
	logger.error('config', error instanceof Error ? error.message : String(error))
	process.exit(1)
}

const loginSpeaker = (token: string): Promise<Speaker> =>
	new Promise((resolve, reject) => {
		const client = new Client({
			intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
		})
		client.once(Events.ClientReady, () => {
			logger.info('', `Logged in as ${client.user.tag}!`)
			resolve({ id: client.user.id, tag: client.user.tag, client })
		})
		client.login(token).catch(reject)
	})

// Only the Primary Speaker observes voice events and answers commands; the others only speak.
const listenAsPrimary = (client: Client) => {
	client.on('voiceStateUpdate', async (prevState, newState) => {
		if (!isAcceptingVoiceEvents) return
		if (isPleaseStandUp(prevState) || isPleaseStandUp(newState)) return

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
}

const shutdown = createShutdownHandler({
	isSpeaking,
	stopSpeaking,
	disconnect: () => {
		const guildIds = new Set(getSpeakers().flatMap((speaker) => Array.from(speaker.client.guilds.cache.keys())))
		guildIds.forEach((guildId) => disconnectBot(guildId))
	},
	close: () => getSpeakers().forEach((speaker) => speaker.client.destroy()),
})

const handleSignal = (signal: string) => {
	isAcceptingVoiceEvents = false
	logger.info('shutdown', `Received ${signal}; shutting down.`)
	void shutdown()
}

process.once('SIGINT', () => handleSignal('SIGINT'))
process.once('SIGTERM', () => handleSignal('SIGTERM'))

startSpeakers(tokens, loginSpeaker)
	.then((speakers) => {
		configureSpeakers(speakers)
		listenAsPrimary(getPrimarySpeaker().client)
		logger.info('speakers', `${speakers.length} Speaker(s) ready: ${speakers.map((speaker) => speaker.tag).join(', ')}`)
	})
	.catch((error) => {
		logger.error('speakers', error instanceof Error ? error.message : String(error))
		process.exit(1)
	})
