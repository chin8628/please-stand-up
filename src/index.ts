import * as dotenv from "dotenv" // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config() //Must be invoked before all statements

import { Client, Intents } from "discord.js"
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from "@discordjs/voice"
import discordTTS from "discord-tts"

const BOT_ID = "947897258014298162"
let connection

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES],
})

client.login(process.env.TOKEN)

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`)
})

client.on("voiceStateUpdate", async (prevState, newState) => {
	if (newState.member.id === BOT_ID) return

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

		const audioPlayer = createAudioPlayer()
		const resource = createAudioResource(
			discordTTS.getVoiceStream(`${newState.member.displayName} เข้ามาจ้า`, { lang: "th" })
		)
		audioPlayer.play(resource)
		const subscription = connection.subscribe(audioPlayer)

		if (subscription) {
			setTimeout(() => subscription.unsubscribe(), 10_000)
		}
	}
})
