import { getVoiceConnection } from '@discordjs/voice'
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { saveAlias } from './repository/alias'
import { MAX_SPEECH_TEMPLATE_LETTERS } from './repository/constants'
import { setJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { setLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'

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
		execute(interaction: ChatInputCommandInteraction) {
			const voiceConnection = getVoiceConnection(interaction.guild.id)
			voiceConnection.destroy()
		},
	},
}
