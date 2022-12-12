import * as dotenv from "dotenv" // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config() //Must be invoked before all statements

import {
	Client,
	Interaction,
	IntentsBitField,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	VoiceChannel,
	GuildMember,
} from "discord.js"
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from "@discordjs/voice"
import discordTTS from "discord-tts"
import * as fs from "fs"

const BOT_ID = "947897258014298162"
const MAX_TEMPLATE_LETTER = 100

let enabledSayMyName = true
let sayMyNameTemplate = "{name} เข้ามาจ้า"
let connection

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
	set_saymyname_template: {
		data: new SlashCommandBuilder()
			.setName("set_saymyname_template")
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

			sayMyNameTemplate = unsanitizedTemplate
			await interaction.reply({ content: `Successfully updates a template! New teamplate is: ${sayMyNameTemplate}` })
		},
	},
	callme: {
		data: new SlashCommandBuilder()
			.setName("callme")
			.setDescription("Set how bot call user")
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

	public push(member: GuildMember) {
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
				return
			}

			let text = ""
			if (this.joiners.length > 1) {
				text = `มี ${this.joiners.length} คนเข้ามาจ้า`
			} else {
				text = sayMyNameTemplate.replace("{name}", name)
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
	// validate to be leave or join channel event
	if (!newState.channel?.id || prevState.channel?.id === newState.channel?.id) return

	if (newState.channel.members.size === 1) return
	if (newState.member.id === BOT_ID) return
	if (!enabledSayMyName) return
	if (newState.guild.afkChannelId === newState.channelId) return
	if (newState.channel.members.size === 0) {
		connection.destroy();
		return
	}
	if (newState.channel.userLimit != 0) {
		return
	}

	if (prevState.channel?.id !== newState.channel.id) {
		connection = joinVoiceChannel({
			channelId: newState.channel.id,
			guildId: newState.guild.id,
			adapterCreator: newState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	joiner.push(newState.member)
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
