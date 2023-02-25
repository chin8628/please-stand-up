import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import logger from 'npmlog'
import discordTTS from 'discord-tts'
import {
	AudioPlayerStatus,
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

	audioPlayer.once(AudioPlayerStatus.Idle, () => {
		voiceConnection.destroy()
	})

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

const getTextSpeechForMultipleMember = (names: string[], type: SpeakerQueueType): string => {
	const speechForNames = names.join(' และ ')

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

let timeoutInstance: NodeJS.Timeout

const consumeQueueWithDelay = () => {
	console.log(JSON.stringify(queue))

	if (timeoutInstance) {
		clearTimeout(timeoutInstance)
	}

	timeoutInstance = setTimeout(() => {
		console.log('inside', JSON.stringify(queue))

		if (queue.length === 0) {
			return
		}

		if (queue.length > 1) {
			const firstQueueItem = queue[0]
			const names = queue.map((queueItem) => {
				const alias = getAllAlias()
				const name = alias[queueItem.payload.memberId] || queueItem.payload.displayName

				return name
			})

			const text = getTextSpeechForMultipleMember(names, firstQueueItem.type)
			joinChannelAndSpeak(
				firstQueueItem.payload.guildId,
				firstQueueItem.payload.channelId,
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
