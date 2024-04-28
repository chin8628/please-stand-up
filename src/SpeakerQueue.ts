import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import logger from 'npmlog'
import discordTTS from 'discord-tts'
import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnection,
	VoiceConnectionStatus,
} from '@discordjs/voice'
import { ApplicationCommandOptionWithChoicesAndAutocompleteMixin, InternalDiscordGatewayAdapterCreator } from 'discord.js'
import { getVoiceConnection } from '@discordjs/voice'
import { v4 as uuidv4 } from 'uuid'

export enum SpeakerQueueType {
	Left = 'left',
	Join = 'join',
	Afk = 'afk',
}

type QueueItemPayload = {
	guildId: string
	channelId: string
	memberId: string
	displayName: string
	adapterCreator: InternalDiscordGatewayAdapterCreator
}

type QueueItem = {
	id: string
	type: SpeakerQueueType
	payload: QueueItemPayload
}

const queue: QueueItem[] = []

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

const joinChannelAndSpeak = async (
	guildId: string,
	channelId: string,
	voiceAdapterCreator: InternalDiscordGatewayAdapterCreator,
	text: string
) => {
	let voiceConnection = getVoiceConnection(guildId)
	if (voiceConnection) {
		await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000)
	}

	voiceConnection = joinVoiceChannel({
		guildId: guildId,
		channelId: channelId,
		adapterCreator: voiceAdapterCreator,
		selfMute: false,
		selfDeaf: false,
	})

	await speak(voiceConnection, text)
}

export const queueSpeaker = (type: SpeakerQueueType, payload: QueueItemPayload) => {
	queue.push({
		id: uuidv4(),
		type,
		payload,
	})

	consumeQueueWithDelay()
}

const getTextSpeechForMultipleMember = (names: string[], type: SpeakerQueueType): string => {
	const speechForNames = names.filter((elem, pos) => names.indexOf(elem) == pos).join(' และ ')

	switch (queue[0].type) {
		case SpeakerQueueType.Join:
			return `${speechForNames} เข้ามาจ้า`
		case SpeakerQueueType.Left:
			return `${speechForNames} ออกไปแล้ว`
		case SpeakerQueueType.Afk:
			return `${speechForNames} afk จ้า`
		default:
			logger.error('', `tts event type isn't handled properly. type is [${type}].`)
			throw new Error(`tts event type isn't handled properly. type is [${type}]`)
	}
}

const getTextSpeechForSingleMember = (name: string, type: SpeakerQueueType): string => {
	if (type === SpeakerQueueType.Join) {
		return getJoiningSpeechTemplate().replace('{name}', name)
	} else if (type === SpeakerQueueType.Left) {
		return getLeavingSpeechTemplate().replace('{name}', name)
	} else if (type === SpeakerQueueType.Afk) {
		return '{name} afk จ้า'.replace('{name}', name)
	}
}

const consumeQueueWithDelay = async () => {
	logger.info('queue consuming', JSON.stringify(queue))

	while (queue.length > 0) {
		const { payload, type } = queue[0]

		const alias = getAllAlias()
		const name = alias[payload.memberId] || payload.displayName
		const text = getTextSpeechForSingleMember(name, type)

		await joinChannelAndSpeak(payload.guildId, payload.channelId, payload.adapterCreator, text)

		queue.shift()
	}
}
