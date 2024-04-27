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
import { InternalDiscordGatewayAdapterCreator } from 'discord.js'
import { getVoiceConnection } from '@discordjs/voice'

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

const speak = async (voiceConnection: VoiceConnection, text: string) => {
	logger.info('speak()', `request tts resource: "${text}"`)
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = voiceConnection.subscribe(audioPlayer)

	await entersState(audioPlayer, AudioPlayerStatus.Idle, 5_000)
	audioPlayer.play(resource)
	logger.info('speak()', `Bot said "${text}"`)

	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
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

let timeoutInstance: NodeJS.Timeout

const consumeQueueWithDelay = () => {
	if (timeoutInstance) {
		clearTimeout(timeoutInstance)
	}

	timeoutInstance = setTimeout(() => {
		logger.info('queue consuming', JSON.stringify(queue))

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

			const allDisplayNames = queue.map((item) => item.payload.displayName)
			let text = ''
			if (allDisplayNames.every((i) => allDisplayNames[0] === i)) {
				text = `เข้าออกทำเหี้ยอะไร ${names[0]}`
			} else {
				text = getTextSpeechForMultipleMember(names, firstQueueItem.type)
			}
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
