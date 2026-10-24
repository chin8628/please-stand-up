import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js'
import { slashCommandsConfig } from './slashCommands'

export type Command = {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder
	execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void
}

// Keyed by the Discord command name, since that is what interaction.commandName holds.
export const commandsConfig: Record<string, Command> = Object.fromEntries(
	Object.values(slashCommandsConfig).map((command) => [command.data.name, command])
)
