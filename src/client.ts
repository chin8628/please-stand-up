import { Client, Intents } from "discord.js"
import {
	joinVoiceChannel,
	getVoiceConnection,
	VoiceConnectionStatus,
	createAudioResource,
	StreamType,
	AudioPlayer,
	generateDependencyReport,
} from "@discordjs/voice"
import discordTTS from "discord-tts"
import { join } from "node:path"

export class ExtendedClient extends Client {
	audioPlayer: AudioPlayer

	constructor() {
		super({
			intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES],
		})

		this.audioPlayer = new AudioPlayer()
	}

	start() {
		this.registerModules()
		this.login(process.env.TOKEN)
	}

	async registerModules() {
		this.on("ready", () => {
			console.log("== BOT is now online!! ==")
		})

		this.on("voiceStateUpdate", (prevState, newState) => {
			// TODO: handle switing a channel
			if (!prevState.channel && !!newState.channel) {
				console.log(
					`${newState.member.user.tag} (${newState.member.user.id}) joined ${newState.channel.name} (${newState.channel.id}) channel at ${newState.guild.name} (${newState.guild.id}) guild.`
				)

				const connection = joinVoiceChannel({
					channelId: newState.channel.id,
					guildId: "389054453552119810",
					adapterCreator: newState.guild.voiceAdapterCreator,
					selfMute: false,
					selfDeaf: false,
				})

				connection.subscribe(this.audioPlayer)

				const mahaloukSound = createAudioResource(join(__dirname, "/sound.ogg"), {
					inputType: StreamType.OggOpus,
				})
				this.audioPlayer.play(mahaloukSound)

				setTimeout(() => {
					console.log("== starting say your name ==")
					const userName = newState.member.user.tag.split("#")[0]
					const userNameStream = discordTTS.getVoiceStream(userName)
					const audioResource = createAudioResource(userNameStream)
					this.audioPlayer.play(audioResource)
				}, 2600)
			}
		})

		this.on("messageCreate", (message) => {
			console.log(message.content)

			if (message !== null && message.content === "+join") {
				console.log("joined")

				const connection = joinVoiceChannel({
					channelId: "741898883973644379",
					guildId: "389054453552119810",
					adapterCreator: message.guild.voiceAdapterCreator,
					selfMute: false,
					selfDeaf: false,
				})

				const audioPlayer = new AudioPlayer()
				connection.subscribe(audioPlayer)

				connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
					console.log("Connection is in the Ready state!")
				})

				const userName = message.member.user.tag.split("#")[0]
				const userNameStream = discordTTS.getVoiceStream(userName)
				const audioResource = createAudioResource(userNameStream, {
					inlineVolume: true,
				})
				audioResource.volume.setVolume(0.3)

				// const mahaloukSound = createAudioResource(
				//   join(__dirname, "/sound.mp3"),
				//   { inlineVolume: true }
				// )
				// mahaloukSound.volume.setVolume(0.3)

				// audioPlayer.play(mahaloukSound)
				setTimeout(() => {
					audioPlayer.play(audioResource)
				}, 2000)

				// const stream = discordTTS.getVoiceStream("Hello R")
				// const audioResource = createAudioResource(stream, {
				//   inputType: StreamType.Arbitrary,
				//   inlineVolume: true,
				// })

				// connection.subscribe(audioPlayer)
				// audioPlayer.play(audioResource)
			}

			if (message.content === "+leave") {
				const connection = getVoiceConnection("389054453552119810")
				connection?.disconnect()
			}
		})
	}
}
