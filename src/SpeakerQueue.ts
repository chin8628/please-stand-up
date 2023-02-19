import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import logger from 'npmlog'
import discordTTS from 'discord-tts'
import {
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
	VoiceConnection,
	VoiceConnectionStatus,
} from '@discordjs/voice'
import { InternalDiscordGatewayAdapterCreator } from 'discord.js'

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
	type: SpeakerQueueType
	payload: QueueItemPayload
}

let queue: QueueItem[] = []

const speak = (voiceConnection: VoiceConnection, text: string) => {
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = voiceConnection.subscribe(audioPlayer)
	audioPlayer.play(resource)
	logger.info('', `Bot said "${text}"`)

	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
	}
}

const joinChannelAndSpeak = (
	guildId: string,
	channelId: string,
	voiceAdapterCreator: InternalDiscordGatewayAdapterCreator,
	text: string
) => {
	const voiceConnection = joinVoiceChannel({
		guildId: guildId,
		channelId: channelId,
		adapterCreator: voiceAdapterCreator,
		selfMute: false,
		selfDeaf: false,
	})

	if (voiceConnection.state.status === VoiceConnectionStatus.Ready) {
		speak(voiceConnection, text)
	} else {
		voiceConnection.once(VoiceConnectionStatus.Ready, () => {
			speak(voiceConnection, text)
		})
	}
}

export const queueSpeaker = (type: SpeakerQueueType, payload: QueueItemPayload) => {
	if (queue.find((item) => item.payload.memberId === payload.memberId)) {
		return
	}

	queue.push({
		type,
		payload,
	})

	consumeQueueWithDelay()
}

const getTextSpeechForMultipleMember = (queueSize: number, type: SpeakerQueueType): string => {
	switch (queue[0].type) {
		case SpeakerQueueType.Join:
			return `มี ${queueSize} คน เข้ามาจ้า`
		case SpeakerQueueType.Left:
			return `มี ${queueSize} คน ออกไปแล้ว`
		case SpeakerQueueType.Afk:
			return `มี ${queueSize} คน afk จ้า`
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

export const consumeQueueWithDelay = () => {
	setTimeout(() => {
		if (queue.length === 0) {
			return
		}

		if (queue.length > 1) {
			const firstQueueItem = queue[0]
			const text = getTextSpeechForMultipleMember(queue.length, firstQueueItem.type)
			joinChannelAndSpeak(
				firstQueueItem.payload.guildId,
				firstQueueItem.payload.memberId,
				firstQueueItem.payload.adapterCreator,
				text
			)

			queue = []
		} else {
			const { payload, type } = queue.shift()

			const alias = getAllAlias()
			const name = alias[payload.memberId] || payload.displayName
			const text = getTextSpeechForSingleMember(name, type)

			joinChannelAndSpeak(payload.guildId, payload.channelId, payload.adapterCreator, text)
		}
	}, 1500)
}
