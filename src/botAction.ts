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
import logger from 'npmlog'
import { Readable } from 'stream'
import { TtsProvider } from './tts/types'

const CONNECTION_TIMEOUT_MS = 5_000
const PLAYBACK_TIMEOUT_MS = 30_000
const DELIVERY_ATTEMPTS = 3

const activePlayers = new Map<string, AudioPlayer>()
let lastSpeechError: string | null = null
let ttsProvider: TtsProvider | null = null

export const configureTts = (provider: TtsProvider): void => {
	ttsProvider = provider
}

const getTts = (): TtsProvider => {
	if (!ttsProvider) throw new Error('TTS provider is not configured; call configureTts() before speaking')
	return ttsProvider
}

export const getLastSpeechError = (): string | null => lastSpeechError

export const isSpeaking = (): boolean => activePlayers.size > 0

export const isSpeakerSpeaking = (speakerId: string): boolean => activePlayers.has(speakerId)

export const stopSpeaking = (): void => {
	activePlayers.forEach((player) => player.stop(true))
	activePlayers.clear()
}

const speak = async (speakerId: string, voiceConnection: VoiceConnection, text: string): Promise<void> => {
	logger.info('speak()', `request tts resource: "${text}"`)
	const audio = await getTts().synthesize({ text })
	const resource = createAudioResource(Readable.from(audio))
	const audioPlayer = createAudioPlayer()
	const subscription = voiceConnection.subscribe(audioPlayer)

	activePlayers.set(speakerId, audioPlayer)
	try {
		audioPlayer.play(resource)
		await entersState(audioPlayer, AudioPlayerStatus.Idle, PLAYBACK_TIMEOUT_MS)
		logger.info('speak()', `Bot said "${text}"`)
	} finally {
		if (activePlayers.get(speakerId) === audioPlayer) activePlayers.delete(speakerId)
		subscription?.unsubscribe()
		audioPlayer.stop(true)
	}
}

export const joinChannelAndSpeak = async (
	speakerId: string,
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
				group: speakerId,
				selfMute: false,
				selfDeaf: false,
			})

			await entersState(voiceConnection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS)
			await speak(speakerId, voiceConnection, text)
			return true
		} catch (error) {
			lastSpeechError = error instanceof Error ? error.message : String(error)
			logger.warn('joinChannelAndSpeak', `Delivery attempt ${attempt} failed: ${lastSpeechError}`)
			voiceConnection?.destroy()
		}
	}

	logger.error('joinChannelAndSpeak', `Skipped announcement after ${DELIVERY_ATTEMPTS} failed attempts: ${lastSpeechError}`)
	return false
}
