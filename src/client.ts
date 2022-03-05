import { Client, Intents } from "discord.js"
import {
	joinVoiceChannel,
	getVoiceConnection,
	VoiceConnectionStatus,
	AudioPlayer,
	entersState,
	VoiceConnection,
} from "@discordjs/voice"
import { getIntroAudio, getNameAudioByName } from "./audio"
import { getNameByTagNumber } from "./usernameMapper"

const BOT_ID = "947897258014298162"

export class ExtendedClient extends Client {
	audioPlayer: AudioPlayer
	lastJoinedChannelId: string
	connection: VoiceConnection

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

	async playMahaleuk() {
		console.log("== starting play a sound ==")
		this.audioPlayer.play(getIntroAudio())

		return new Promise((resolve, reject) => {
			setTimeout(() => {
				this.audioPlayer.stop()
				resolve(null)
			}, 2600)
		})
	}

	sayName(userTag: string) {
		console.log("== starting say your name ==")
		const tagNumber = userTag.split("#")[1]
		const name = getNameByTagNumber(tagNumber)
		const audio = getNameAudioByName(name)
		this.audioPlayer.play(audio)
	}

	async registerModules() {
		this.on("ready", () => {
			console.log("== BOT is now online!! ==")
		})

		this.on("voiceStateUpdate", async (prevState, newState) => {
			if (newState.member.id === BOT_ID) return

			// TODO: handle switing a channel
			if (!prevState.channel && !!newState.channel) {
				console.log(
					`${newState.member.user.tag} (${newState.member.user.id}) joined ${newState.channel.name} (${newState.channel.id}) channel at ${newState.guild.name} (${newState.guild.id}) guild.`
				)

				if (this.lastJoinedChannelId !== newState.channel.id || !this.connection) {
					this.connection = joinVoiceChannel({
						channelId: newState.channel.id,
						guildId: "389054453552119810",
						adapterCreator: newState.guild.voiceAdapterCreator,
						selfMute: false,
						selfDeaf: false,
					})
					this.lastJoinedChannelId = newState.channel.id
					this.connection = await entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000)
				}

				this.connection.subscribe(this.audioPlayer)

				await this.playMahaleuk()
				this.sayName(newState.member.user.tag)
			}
		})

		this.on("messageCreate", (message) => {
			if (message.content === "+leave") {
				console.log("== BOT is leaving ==")
				const connection = getVoiceConnection("389054453552119810")
				connection?.disconnect()
			}
		})
	}
}
