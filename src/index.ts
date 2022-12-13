import * as dotenv from "dotenv" // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config() //Must be invoked before all statements

import {
	Client,
	Interaction,
	IntentsBitField,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	GuildMember,
} from "discord.js"
import { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnection } from "@discordjs/voice"
import discordTTS from "discord-tts"
import * as fs from "fs"

const BOT_ID = process.env.DISCORD_APP_ID
const MAX_TEMPLATE_LETTER = 100

let enabledSayMyName = true
let joinChannelTemplate = "{name} เข้ามาจ้า"
let leftChannelTemplate = "{name} ออกไปแล้วจ้า"
let connection: VoiceConnection

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
	const subscription = connection.subscribe(audioPlayer)
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
				} else {
					text = `มี ${this.joiners.length} ออกไปแล้ว`
				}
			} else {
				if (type === "join") {
					text = joinChannelTemplate.replace("{name}", name)
				} else {
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
	console.log(`Logged in as ${client.user.tag}!`)
})

client.on("voiceStateUpdate", async (prevState, newState) => {
	const prevVoiceChannelID = prevState.channel?.id || null
	const newVoiceChannelID = newState.channel?.id || null

	if (prevVoiceChannelID === newVoiceChannelID) {
		// nothing change
		return
	} else if (newVoiceChannelID === null) {
		//user left

		// skip when disable
		if (!enabledSayMyName) return
		// skip when bot left
		if (prevState.member.id === BOT_ID) return
		// skip in limit member channel
		if (prevState.channel.userLimit != 0) return
		// skip when only one member in channel
		if (prevState.channel.members.size <= 1) {
			if (connection) {
				connection.destroy()
			}
			return
		}

		// Connect bot to channel that user left
		if (!connection || connection.joinConfig.channelId !== prevVoiceChannelID) {
			connection = joinVoiceChannel({
				channelId: prevVoiceChannelID,
				guildId: prevState.guild.id,
				adapterCreator: prevState.guild.voiceAdapterCreator,
				selfMute: false,
				selfDeaf: false,
			})
		}

		// Push member to announce
		joiner.push(prevState.member, "left")
	} else if (prevVoiceChannelID === null) {
		// user join

		// skip when disable
		if (!enabledSayMyName) return
		// skip when bot join
		if (newState.member.id === BOT_ID) return
		// skip when only one member in channel
		if (newState.channel.members.size === 1) return
		// skip in limit member channel
		if (newState.channel.userLimit != 0) return
		// skip when try to join afk channel
		if (newState.guild.afkChannelId === newState.channelId) return
		// skip & disconnect from channel when no one else
		if (newState.channel.members.size === 0) {
			if (connection) {
				connection.destroy()
			}
			return
		}

		// Connect bot to channel that user join
		if (!connection || connection.joinConfig.channelId !== newVoiceChannelID) {
			connection = joinVoiceChannel({
				channelId: newVoiceChannelID,
				guildId: newState.guild.id,
				adapterCreator: newState.guild.voiceAdapterCreator,
				selfMute: false,
				selfDeaf: false,
			})
		}

		// Push member to announce
		joiner.push(newState.member, "join")
	} else {
		// user move
		/* 
			ตรงนี้ไม่รู้ว่าจะให้แจ้งออก หรือแจ้งเข้าดี สำหรับตอนนี้เลยให้แจ้งเข้าไปก่อน
		*/

		// skip when disable
		if (!enabledSayMyName) return
		// skip when bot join
		if (newState.member.id === BOT_ID) return
		// skip when only one member in channel
		if (newState.channel.members.size === 1) return
		// skip in limit member channel
		if (newState.channel.userLimit != 0) return
		// skip when try to join afk channel
		if (newState.guild.afkChannelId === newState.channelId) return
		// skip & disconnect from channel when no one else
		if (newState.channel.members.size === 0) {
			if (connection) {
				connection.destroy()
			}
			return
		}

		// Connect bot to channel that user join
		if (!connection || connection.joinConfig.channelId !== newVoiceChannelID) {
			connection = joinVoiceChannel({
				channelId: newVoiceChannelID,
				guildId: newState.guild.id,
				adapterCreator: newState.guild.voiceAdapterCreator,
				selfMute: false,
				selfDeaf: false,
			})
		}

		// Push member to announce
		joiner.push(newState.member, "join")
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
