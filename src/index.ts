// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, Interaction, IntentsBitField, SlashCommandBuilder } from 'discord.js'
import { slashCommandsConfig } from './slashCommands'
import logger from 'npmlog'
import { isPleaseStandUp } from './helpers/isPleaseStandUp'
import { userMovedToAFKHandler } from './handlers/userMovedToAFK'
import { userJoinChannel } from './handlers/userJoinChannel'
import { userLeftChannel } from './handlers/userLeftChannel'
import { getVoiceConnection } from '@discordjs/voice'

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

let botTimeoutInstance: NodeJS.Timeout
client.on('voiceStateUpdate', async (prevState, newState) => {
	if (!enabledSayMyName) return
	if (isPleaseStandUp(newState)) return

	if (botTimeoutInstance) {
		clearTimeout(botTimeoutInstance)
	}

	botTimeoutInstance = setTimeout(() => {
		const guildId = prevState.guild?.id || newState.guild?.id
		const voiceConnection = getVoiceConnection(guildId)
		voiceConnection.destroy()
	}, 300_000)

	const isNotChannelUpdateEvent = prevState.channel?.id === newState.channel?.id
	if (isNotChannelUpdateEvent) {
		return
	}

	const isUserMovedToAFK = prevState.channelId && newState.guild.afkChannelId === newState.channelId
	if (isUserMovedToAFK) {
		userMovedToAFKHandler(prevState, newState)
	}

	const isLeftChannel = !newState.channelId && !!prevState.channelId
	if (isLeftChannel) {
		userLeftChannel(prevState)
	}

	const isJoinChannel = !prevState.channelId && !!newState.channelId
	if (isJoinChannel) {
		userJoinChannel(newState)
	}
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
