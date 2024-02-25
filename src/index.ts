// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, Interaction, IntentsBitField, SlashCommandBuilder, VoiceChannel } from 'discord.js'
import { slashCommandsConfig } from './slashCommands'
import logger from 'npmlog'
import { isPleaseStandUp } from './helpers/isPleaseStandUp'
import { getVoiceConnection } from '@discordjs/voice'
import { handler } from './handler'

let enabledSayMyName = true

// TODO: Extract this config to separated file.
export const commandsConfig = {
	stop: {
		data: new SlashCommandBuilder().setName('stop').setDescription('Stops SAY MY NAME!'),
		async execute(interaction) {
			enabledSayMyName = false
			await interaction.reply({ content: 'Say your name is disabled!' })
		},
	},
	start: {
		data: new SlashCommandBuilder().setName('start').setDescription('Starts SAY MY NAME!'),
		async execute(interaction) {
			enabledSayMyName = true
			await interaction.reply({ content: 'Say your name is enabled!' })
		},
	},
	...slashCommandsConfig,
}

const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
})

client.login(process.env.TOKEN)
client.on('ready', () => {
	logger.info('', `Logged in as ${client.user.tag}!`)
})

client.on('voiceStateUpdate', async (prevState, newState) => {
	if (!enabledSayMyName) return
	if (isPleaseStandUp(client, prevState) || isPleaseStandUp(client, newState)) return

	const isNotChannelUpdateEvent = prevState.channel?.id === newState.channel?.id
	if (isNotChannelUpdateEvent) {
		return
	}

	for (const channel of client.channels.cache.values()) {
		if (channel.isVoiceBased()) {
			const voiceChannel = channel as VoiceChannel

			if (voiceChannel.members.has(client.user.id) && voiceChannel.members.size === 1) {
				const voiceConnection = getVoiceConnection(voiceChannel.guildId)

				if (voiceConnection) {
					voiceConnection.disconnect()
					voiceConnection.destroy()
					logger.info('bot state', 'leaved')

					return
				}
			}
		}
	}

	handler(prevState, newState)
})

client.on('interactionCreate', async (interaction: Interaction) => {
	if (!interaction.isCommand()) return
	if (!Object.keys(commandsConfig).includes(interaction.commandName)) {
		await interaction.reply({
			content: `Command not found: ${interaction.commandName} isn't in the config key.`,
			ephemeral: true,
		})
	}

	commandsConfig[interaction.commandName].execute(interaction)
})
