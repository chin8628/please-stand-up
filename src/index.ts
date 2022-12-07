import * as dotenv from "dotenv" // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config() //Must be invoked before all statements

import {
	Client,
	Interaction,
	IntentsBitField,
	SlashCommandBuilder,
	Collection,
	CommandInteraction,
	ChatInputCommandInteraction,
} from "discord.js"
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from "@discordjs/voice"
import discordTTS from "discord-tts"

let enabledSayMyName = true
let sayMyNameTemplate = "{name} เข้ามาจ้า"
const BOT_ID = "947897258014298162"
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
					.setDescription(`Template of the tts. use {name} to positioning the displayname. Example: "{name} เข้ามาจ้า"`)
					.setRequired(true)
			),
		async execute(interaction: ChatInputCommandInteraction) {
			const unsanitizedTemplate = interaction.options.getString("template")
			if (!unsanitizedTemplate?.includes("{name}")) {
				await interaction.reply({ content: "Template is wrong. Could not find {name} in the teamplate.", ephemeral: true })
				return
			}

			sayMyNameTemplate = unsanitizedTemplate
			await interaction.reply({ content: `Successfully updates a template! New teamplate is: ${sayMyNameTemplate}` })
		},
	},
}

const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates],
})

client.login(process.env.TOKEN)

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`)
})

client.on("voiceStateUpdate", async (prevState, newState) => {
	if (newState.member.id === BOT_ID) return
	if (!enabledSayMyName) return

	if (newState.channel?.id && prevState.channel?.id !== newState.channel?.id) {
		if (prevState.channel?.id !== newState.channel.id) {
			connection = joinVoiceChannel({
				channelId: newState.channel.id,
				guildId: "389054453552119810",
				adapterCreator: newState.guild.voiceAdapterCreator,
				selfMute: false,
				selfDeaf: false,
			})
		}

		const text = sayMyNameTemplate.replace("{name}", newState.member.displayName)
		const audioPlayer = createAudioPlayer()
		const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: "th" }))
		audioPlayer.play(resource)
		const subscription = connection.subscribe(audioPlayer)

		if (subscription) {
			setTimeout(() => subscription.unsubscribe(), 10_000)
		}
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
