import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { getLastSpeechError, isSpeaking, stopSpeaking } from './botAction'
import { saveAlias } from './repository/alias'
import { disconnectBot } from './helpers/disconnectBotIfAlone'
import { MAX_SPEECH_TEMPLATE_LETTERS } from './repository/constants'
import { getQueueState } from './repository/queueState'
import { setJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { setLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import { getQueueDepth, resetQueue } from './speakerQueue'
import { describeSpeakers } from './speakers'

export const slashCommandsConfig = {
	set_join_template: {
		data: new SlashCommandBuilder()
			.setName('setjointemplate')
			.setDescription('Sets how bot should greeting an user')
			.addStringOption((option) =>
				option
					.setName('template')
					.setDescription(
						`Text2Speech template. Maximum is ${MAX_SPEECH_TEMPLATE_LETTERS} letters. Example: "{name} เข้ามาจ้า"`
					)
					.setRequired(true)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const newTemplate = interaction.options.getString('template')

			try {
				setJoiningSpeechTemplate(newTemplate)
			} catch (error: any) {
				if (error instanceof Error) {
					await interaction.reply({
						content: error.message,
						ephemeral: true,
					})
				}

				return
			}

			await interaction.reply({ content: `Successfully updates a template! New teamplate is: ${newTemplate}` })
		},
	},
	set_left_template: {
		data: new SlashCommandBuilder()
			.setName('setlefttemplate')
			.setDescription('Sets how bot should goodbye an user')
			.addStringOption((option) =>
				option
					.setName('template')
					.setDescription(
						`Text2Speech template. Maximum is ${MAX_SPEECH_TEMPLATE_LETTERS} letters. Example: "{name} ออกไปแล้วจ้า"`
					)
					.setRequired(true)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const newTemplate = interaction.options.getString('template')

			try {
				setLeavingSpeechTemplate(newTemplate)
			} catch (error: any) {
				if (error instanceof Error) {
					await interaction.reply({
						content: error.message,
						ephemeral: true,
					})
				}

				return
			}

			await interaction.reply({ content: `Successfully updates a template! New teamplate is: ${newTemplate}` })
		},
	},
	callme: {
		data: new SlashCommandBuilder()
			.setName('callme')
			.setDescription('Set how bot call you')
			.addStringOption((option) =>
				option.setName('name').setDescription('Alias name that you want Bot call').setRequired(true).setMaxLength(64)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const userID = interaction.user.id
			const aliasName = interaction.options?.getString('name')

			saveAlias(userID, aliasName)

			await interaction.reply({ content: `Bot remembered you as ${aliasName}`, ephemeral: true })
		},
	},
	leave: {
		data: new SlashCommandBuilder().setName('leave').setDescription('ask the bot to disconnect channel nicely'),
		async execute(interaction: ChatInputCommandInteraction) {
			if (!interaction.guild) {
				await interaction.reply({ content: 'This command can only run in a server.', ephemeral: true })
				return
			}

			stopSpeaking()
			const disconnected = disconnectBot(interaction.guild.id)
			if (disconnected === 0) {
				await interaction.reply({ content: 'Bot is not connected to a voice channel.', ephemeral: true })
				return
			}

			await interaction.reply({
				content: `Left ${disconnected} voice channel${disconnected === 1 ? '' : 's'}.`,
				ephemeral: true,
			})
		},
	},
	status: {
		data: new SlashCommandBuilder().setName('status').setDescription('Show bot runtime status'),
		async execute(interaction: ChatInputCommandInteraction) {
			const lastSpeechError = getLastSpeechError() || 'none'
			const speakers = describeSpeakers()
				.map(
					(speaker) =>
						`- ${speaker.tag}: ${speaker.channelId ? `channel ${speaker.channelId}` : 'idle'}${speaker.busy ? ' (speaking)' : ''}`
				)
				.join('\n')
			await interaction.reply({
				content: `Queue: ${getQueueDepth()} (${getQueueState()})\nSpeakers:\n${speakers}\nSpeaking: ${isSpeaking()}\nLast speech error: ${lastSpeechError}`,
				ephemeral: true,
			})
		},
	},
	reset: {
		data: new SlashCommandBuilder()
			.setName('reset')
			.setDescription('Reset service queue')
			.addStringOption((option) =>
				option
					.setName('target')
					.setDescription('What should be reset')
					.addChoices({ name: 'queue', value: 'queue' })
					.setRequired(true)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			if (!interaction.guild) {
				await interaction.reply({ content: 'This command can only run in a server.', ephemeral: true })
				return
			}

			const removedCount = await resetQueue(interaction.guild.id)
			await interaction.reply({
				content: `Queue reset completed. Removed ${removedCount} queued event(s) and disconnected all Speakers.`,
				ephemeral: true,
			})
		},
	},
}
