import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	getVoiceConnection,
	joinVoiceChannel,
	VoiceConnection,
	VoiceConnectionStatus,
} from '@discordjs/voice'
import discordTTS from 'discord-tts'
import { InternalDiscordGatewayAdapterCreator } from 'discord.js'
import logger from 'npmlog'
import { v4 as uuidv4 } from 'uuid'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'

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

// Queue is updated by multiple functions. I have concern that it will have race condition soon.
// Need to refactor this to use a better queue service.
let queue: QueueItem[] = []

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
	const event = {
		id: uuidv4(),
		type,
		payload,
	}
	queue.push(event)
	logger.info('enqueue', JSON.stringify(event))

	if (!processing) consumeQueue()
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

const getSameTypeSameChannelQueue = (type: SpeakerQueueType, channelId: string): QueueItem[] => {
	return queue.filter((item) => item.type === type && item.payload.channelId === channelId)
}

let processing = false

const consumeQueue = async () => {
	processing = true
	for (let queueLength = 0; queueLength !== queue.length; queueLength = queue.length) {
		console.log('queue length before', queue.length)
		await new Promise((resolve) => setTimeout(resolve, 1000))
		console.log('queue length after', queue.length)
	}

	while (queue.length > 0) {
		const selectedEvents = getSameTypeSameChannelQueue(queue[0].type, queue[0].payload.channelId)
		logger.info('queue consuming', JSON.stringify(selectedEvents))

		if (selectedEvents.length > 1) {
			const names = selectedEvents.map((event) => {
				const alias = getAllAlias()
				return alias[event.payload.memberId] || event.payload.displayName
			})
			const text = getTextSpeechForMultipleMember(names, queue[0].type)

			await joinChannelAndSpeak(
				queue[0].payload.guildId,
				queue[0].payload.channelId,
				queue[0].payload.adapterCreator,
				text
			)
		}

		if (selectedEvents.length === 1) {
			const { payload, type } = queue[0]

			const alias = getAllAlias()
			const name = alias[payload.memberId] || payload.displayName
			const text = getTextSpeechForSingleMember(name, type)

			await joinChannelAndSpeak(payload.guildId, payload.channelId, payload.adapterCreator, text)
		}

		const selectedEventsId = selectedEvents.map((event) => event.id)
		queue = queue.filter((item) => !selectedEventsId.includes(item.id))
	}

	processing = false
}
