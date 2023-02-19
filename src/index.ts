// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, Interaction, IntentsBitField, SlashCommandBuilder, VoiceState } from 'discord.js'
import { joinVoiceChannel, VoiceConnection } from '@discordjs/voice'
import { slashCommandsConfig } from './slashCommands'
import { queueSpeaker, SpeakerQueueType } from './SpeakerQueue'
import logger from 'npmlog'

let enabledSayMyName = true
let botConnection: VoiceConnection

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

const isPleaseStandUp = (newState: VoiceState): boolean => newState.member.id === process.env.DISCORD_APP_ID

function userLeftChannel(prevState: VoiceState) {
	if (isPleaseStandUp(prevState)) return
	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return
	// skip when only one member in channel
	if (prevState.channel.members.size === 0) {
		if (botConnection) {
			botConnection.destroy()
		}
		return
	}

	if (!botConnection || prevState.channel?.id) {
		botConnection = joinVoiceChannel({
			channelId: prevState.channel.id,
			guildId: prevState.guild.id,
			adapterCreator: prevState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(botConnection, prevState.member, SpeakerQueueType.Left)
}

function userJoinChannel(newState: VoiceState) {
	if (isPleaseStandUp(newState)) return
	// skip when only one member in channel
	if (newState.channel.members.size === 1) return
	// skip in limit member channel
	if (newState.channel.userLimit != 0) return
	// skip when try to join afk channel
	if (newState.guild.afkChannelId === newState.channelId) return
	// skip & disconnect from channel when no one else
	if (newState.channel.members.size === 0) {
		if (botConnection) {
			botConnection.destroy()
		}
		return
	}

	if (!botConnection || newState.channel?.id) {
		botConnection = joinVoiceChannel({
			channelId: newState.channel.id,
			guildId: newState.guild.id,
			adapterCreator: newState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(botConnection, newState.member, SpeakerQueueType.Join)
}

const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	if (isPleaseStandUp(newState)) return

	if (!botConnection || prevState.channel?.id) {
		botConnection = joinVoiceChannel({
			channelId: prevState.channel.id,
			guildId: prevState.guild.id,
			adapterCreator: prevState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(botConnection, newState.member, SpeakerQueueType.Join)
}

client.on('voiceStateUpdate', async (prevState, newState) => {
	if (!enabledSayMyName) return

	const isNotChannelUpdateEvent = prevState.channel?.id === newState.channel?.id
	if (isNotChannelUpdateEvent) {
		return
	}

	const isUserMovedToAFK = newState.guild.afkChannelId === newState.channelId
	if (isUserMovedToAFK) {
		logger.info('', newState.member.displayName, 'is moved to AFK channel')
		userMovedToAFKHandler(prevState, newState)
	}

	const isLeftChannel = !newState.channel?.id && !!prevState.channel?.id
	if (isLeftChannel) {
		logger.info('', newState.member.displayName, 'lefted a channel')
		userLeftChannel(prevState)
	}

	const isJoinChannel = !prevState.channel?.id && !!newState.channel?.id
	if (isJoinChannel) {
		logger.info('', newState.member.displayName, 'joined a channel')
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
