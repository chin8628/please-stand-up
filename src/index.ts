import * as dotenv from "dotenv" // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config() //Must be invoked before all statements

import {
	Client,
	Interaction,
	IntentsBitField,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	GuildMember,
	VoiceState,
} from "discord.js"
import { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnection } from "@discordjs/voice"
import discordTTS from "discord-tts"
import * as fs from "fs"
import * as logger from 'npmlog'

const MAX_TEMPLATE_LETTER = 100

let enabledSayMyName = true
let joinChannelTemplate = "{name} เข้ามาจ้า"
let leftChannelTemplate = "{name} ออกไปแล้วจ้า"
let botConnection: VoiceConnection

// TODO: Extract this config to separated file.
export const commandsConfig = {
	stop: {
		data: new SlashCommandBuilder().setName("stop").setDescription("Stops SAY MY NAME!"),
		async execute(interaction) {
			enabledSayMyName = false
			await interaction.reply({ content: "Say your name is disabled!" })
		},
	},
	start: {
		data: new SlashCommandBuilder().setName("start").setDescription("Starts SAY MY NAME!"),
		async execute(interaction) {
			enabledSayMyName = true
			await interaction.reply({ content: "Say your name is enabled!" })
		},
	},
	set_join_template: {
		data: new SlashCommandBuilder()
			.setName("set_join_template")
			.setDescription("Sets how bot should greeting an user")
			.addStringOption((option) =>
				option
					.setName("template")
					.setDescription(
						`Text2Speech template. Maximum is ${MAX_TEMPLATE_LETTER} letters. Example: "{name} เข้ามาจ้า"`
					)
					.setRequired(true)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const unsanitizedTemplate = interaction.options.getString("template")
			if (!unsanitizedTemplate?.includes("{name}")) {
				await interaction.reply({
					content: "Template is wrong. Could not find {name} in the teamplate.",
					ephemeral: true,
				})
				return
			}

			if (unsanitizedTemplate.length > MAX_TEMPLATE_LETTER) {
				await interaction.reply({
					content: `Template cannot be longer than ${MAX_TEMPLATE_LETTER} letters.`,
					ephemeral: true,
				})
				return
			}

			joinChannelTemplate = unsanitizedTemplate
			await interaction.reply({ content: `Successfully updates a template! New teamplate is: ${joinChannelTemplate}` })
		},
	},
	set_left_template: {
		data: new SlashCommandBuilder()
			.setName("set_left_template")
			.setDescription("Sets how bot should goodbye an user")
			.addStringOption((option) =>
				option
					.setName("template")
					.setDescription(
						`Text2Speech template. Maximum is ${MAX_TEMPLATE_LETTER} letters. Example: "{name} ออกไปแล้วจ้า"`
					)
					.setRequired(true)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const unsanitizedTemplate = interaction.options.getString("template")
			if (!unsanitizedTemplate?.includes("{name}")) {
				await interaction.reply({
					content: "Template is wrong. Could not find {name} in the teamplate.",
					ephemeral: true,
				})
				return
			}

			if (unsanitizedTemplate.length > MAX_TEMPLATE_LETTER) {
				await interaction.reply({
					content: `Template cannot be longer than ${MAX_TEMPLATE_LETTER} letters.`,
					ephemeral: true,
				})
				return
			}

			leftChannelTemplate = unsanitizedTemplate
			await interaction.reply({ content: `Successfully updates a template! New teamplate is: ${leftChannelTemplate}` })
		},
	},
	callme: {
		data: new SlashCommandBuilder()
			.setName("callme")
			.setDescription("Set how bot call you")
			.addStringOption((option) =>
				option.setName("name").setDescription("Alias name that you want Bot call").setRequired(true).setMaxLength(64)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const userID = interaction.user.id
			const name = interaction.options?.getString("name")

			// >> Set Alias name to some storage with userID <<
			const aliasFile = fs.readFileSync(__dirname + "/alias.json", { encoding: "utf8", flag: "r+" })
			const alias = JSON.parse(aliasFile)
			alias[userID] = name
			fs.writeFileSync(__dirname + "/alias.json", JSON.stringify(alias))

			await interaction.reply({ content: `Bot remembered you as ${name}`, ephemeral: true })
		},
	},
}

function speak(text: string) {
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: "th" }))
	const audioPlayer = createAudioPlayer()
	const subscription = botConnection.subscribe(audioPlayer)
	audioPlayer.play(resource)
	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
	}
}

class Joiner {
	private joiners = []

	public push(member: GuildMember, type: "left" | "join") {
		if (this.joiners.includes(member.displayName)) {
			return
		}

		let name = member.displayName
		// Find user id match with alias
		const aliasFile = fs.readFileSync(__dirname + "/alias.json", { encoding: "utf8", flag: "r+" })
		const alias = JSON.parse(aliasFile)
		if (alias[member.id]) {
			name = alias[member.id]
		}

		this.joiners.push(name)
		const currentJoinersLength = this.joiners.length

		setTimeout(() => {
			if (currentJoinersLength !== this.joiners.length) {
				this.joiners = []
				return
			}

			let text = ""
			if (this.joiners.length > 1) {
				if (type === "join") {
					text = `มี ${this.joiners.length} คนเข้ามาจ้า`
				} else if (type === "left") {
					text = `มี ${this.joiners.length} ออกไปแล้ว`
				}
			} else {
				if (type === "join") {
					text = joinChannelTemplate.replace("{name}", name)
				} else if (type === "left") {
					text = leftChannelTemplate.replace("{name}", name)
				}
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
client.on("ready", () => {
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
	joiner.push(prevState.member, "left")
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

	joiner.push(newState.member, "join")
}

client.on("voiceStateUpdate", async (prevState, newState) => {
	if (!enabledSayMyName) return

	const isNotChannelUpdateEvent = prevState.channel?.id === newState.channel?.id
	if (isNotChannelUpdateEvent) {
		return
	}

	const isLeftChannel = !newState.channel?.id && !!prevState.channel?.id
	const isJoinChannel = !prevState.channel?.id && !!newState.channel?.id
	if (isLeftChannel) {
		logger.info(newState.member.displayName, "lefted a channel")
		userLeftChannel(prevState)
	} else if (isJoinChannel) {
		logger.info(newState.member.displayName, "joined a channel")
		userJoinChannel(newState)
	}
})

client.on("interactionCreate", async (interaction: Interaction) => {
	if (!interaction.isCommand()) return
	if (!Object.keys(commandsConfig).includes(interaction.commandName)) {
		await interaction.reply({
			content: `Command not found: ${interaction.commandName} isn't in the config key.`,
			ephemeral: true,
		})
	}

	commandsConfig[interaction.commandName].execute(interaction)
})
