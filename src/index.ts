// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv'

// Must be invoked before all statements
dotenv.config()

import { Client, Interaction, IntentsBitField, SlashCommandBuilder, GuildMember, VoiceState } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnection } from '@discordjs/voice'
import discordTTS from 'discord-tts'
import * as logger from 'npmlog'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import { slashCommandsConfig } from './slashCommands'

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

function speak(text: string) {
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = botConnection.subscribe(audioPlayer)
	audioPlayer.play(resource)
	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
	}
}

class Joiner {
	private joiners = []

	public push(member: GuildMember, type: 'left' | 'join') {
		if (this.joiners.includes(member.displayName)) {
			return
		}

		const alias = getAllAlias()
		const name = alias[member.id] || member.displayName

		this.joiners.push(name)
		const currentJoinersLength = this.joiners.length

		setTimeout(() => {
			if (currentJoinersLength !== this.joiners.length) {
				this.joiners = []
				return
			}

			let text = ''
			if (this.joiners.length > 1) {
				if (type === 'join') {
					text = `มี ${this.joiners.length} คนเข้ามาจ้า`
				} else if (type === 'left') {
					text = `มี ${this.joiners.length} ออกไปแล้ว`
				}
			} else if (type === 'join') {
				text = getJoiningSpeechTemplate().replace('{name}', name)
			} else if (type === 'left') {
				text = getLeavingSpeechTemplate().replace('{name}', name)
			}

			speak(text)
			this.joiners = []
		}, 1500)
	}
}

const joiner = new Joiner()

const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
})

client.login(process.env.TOKEN)
client.on('ready', () => {
	logger.info(`Logged in as ${client.user.tag}!`)
})

function isBot(state: VoiceState) {
	return state.member.user.bot
}

function userLeftChannel(prevState: VoiceState) {
	if (isBot(prevState)) return
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

	// Push member to announce
	joiner.push(prevState.member, 'left')
}

function userJoinChannel(newState: VoiceState) {
	if (isBot(newState)) return
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

	joiner.push(newState.member, 'join')
}

client.on('voiceStateUpdate', async (prevState, newState) => {
	if (!enabledSayMyName) return

	const isNotChannelUpdateEvent = prevState.channel?.id === newState.channel?.id
	if (isNotChannelUpdateEvent) {
		return
	}

	const isLeftChannel = !newState.channel?.id && !!prevState.channel?.id
	const isJoinChannel = !prevState.channel?.id && !!newState.channel?.id
	if (isLeftChannel) {
		logger.info(newState.member.displayName, 'lefted a channel')
		userLeftChannel(prevState)
	} else if (isJoinChannel) {
		logger.info(newState.member.displayName, 'joined a channel')
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
