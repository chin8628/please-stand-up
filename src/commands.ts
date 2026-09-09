import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { slashCommandsConfig } from './slashCommands'

export type Command = {
	data: SlashCommandBuilder
	execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void
}

export const commandsConfig: Record<string, Command> = slashCommandsConfig