import {
	AudioPlayer,
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	DiscordGatewayAdapterCreator,
	entersState,
	joinVoiceChannel,
	VoiceConnection,
	VoiceConnectionStatus,
} from '@discordjs/voice'
import discordTTS from 'discord-tts'
import logger from 'npmlog'
import { setChannelId } from './repository/botState'

const CONNECTION_TIMEOUT_MS = 5_000
const PLAYBACK_TIMEOUT_MS = 30_000
const DELIVERY_ATTEMPTS = 3

let activePlayer: AudioPlayer | null = null
let lastSpeechError: string | null = null

export const getLastSpeechError = (): string | null => lastSpeechError

export const isSpeaking = (): boolean => activePlayer !== null

export const stopSpeaking = (): void => {
	if (activePlayer) {
		activePlayer.stop(true)
		activePlayer = null
	}
}

const speak = async (voiceConnection: VoiceConnection, text: string): Promise<void> => {
	logger.info('speak()', `request tts resource: "${text}"`)
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = voiceConnection.subscribe(audioPlayer)

	activePlayer = audioPlayer
	try {
		audioPlayer.play(resource)
		await entersState(audioPlayer, AudioPlayerStatus.Idle, PLAYBACK_TIMEOUT_MS)
		logger.info('speak()', `Bot said "${text}"`)
	} finally {
		if (activePlayer === audioPlayer) activePlayer = null
		subscription?.unsubscribe()
		audioPlayer.stop(true)
	}
}

export const joinChannelAndSpeak = async (
	guildId: string,
	channelId: string,
	voiceAdapterCreator: DiscordGatewayAdapterCreator,
	text: string
): Promise<boolean> => {
	lastSpeechError = null

	for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt += 1) {
		let voiceConnection: VoiceConnection | undefined
		try {
			voiceConnection = joinVoiceChannel({
				guildId,
				channelId,
				adapterCreator: voiceAdapterCreator,
				selfMute: false,
				selfDeaf: false,
			})

			await entersState(voiceConnection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS)
			setChannelId(channelId)
			await speak(voiceConnection, text)
			return true
		} catch (error) {
			lastSpeechError = error instanceof Error ? error.message : String(error)
			logger.warn('joinChannelAndSpeak', `Delivery attempt ${attempt} failed: ${lastSpeechError}`)
			voiceConnection?.destroy()
			setChannelId(null)
		}
	}

	logger.error('joinChannelAndSpeak', `Skipped announcement after ${DELIVERY_ATTEMPTS} failed attempts: ${lastSpeechError}`)
	return false
}
