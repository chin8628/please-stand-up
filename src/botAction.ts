import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	DiscordGatewayAdapterCreator,
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnection,
} from '@discordjs/voice'
import discordTTS from 'discord-tts'
import logger from 'npmlog'
import { setChannelId } from './repository/botState'

const speak = async (voiceConnection: VoiceConnection, text: string) => {
	logger.info('speak()', `request tts resource: "${text}"`)
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = voiceConnection.subscribe(audioPlayer)
	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
	}

	await entersState(audioPlayer, AudioPlayerStatus.Idle, 5_000)
	audioPlayer.play(resource)
	logger.info('speak()', `Bot said "${text}"`)

	while (audioPlayer.state.status !== AudioPlayerStatus.Idle) {
		await new Promise((resolve) => setTimeout(resolve, 500))
	}
}

export const joinChannelAndSpeak = async (
	guildId: string,
	channelId: string,
	voiceAdapterCreator: DiscordGatewayAdapterCreator,
	text: string
) => {
	let voiceConnection = getVoiceConnection(guildId)

	voiceConnection = joinVoiceChannel({
		guildId: guildId,
		channelId: channelId,
		adapterCreator: voiceAdapterCreator,
		selfMute: false,
		selfDeaf: false,
	})

	setChannelId(channelId)
	await speak(voiceConnection, text)
}
