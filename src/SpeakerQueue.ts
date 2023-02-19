import { GuildMember } from 'discord.js'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import logger from 'npmlog'
import discordTTS from 'discord-tts'
import { createAudioPlayer, createAudioResource, VoiceConnection } from '@discordjs/voice'

export enum SpeakerQueueType {
	Left = 'left',
	Join = 'join',
	Afk = 'afk',
}

type QueueItemPayload = {
	member: GuildMember
}

type QueueItem = {
	type: SpeakerQueueType
	payload: QueueItemPayload
}

let queue: QueueItem[] = []

const speak = (botConnection: VoiceConnection, text: string) => {
	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = botConnection.subscribe(audioPlayer)
	audioPlayer.play(resource)
	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
	}
}

export const queueSpeaker = (botConnection: VoiceConnection, member: GuildMember, type: SpeakerQueueType) => {
	if (queue.find((item) => item.payload.member.id === member.id)) {
		return
	}

	queue.push({
		type,
		payload: {
			member,
		},
	})

	consumeQueueWithDelay(botConnection)
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

export const consumeQueueWithDelay = (botConnection: VoiceConnection) => {
	setTimeout(() => {
		console.log('test')
		if (queue.length === 0) {
			return
		}

		let text = ''
		if (queue.length > 1) {
			text = getTextSpeechForMultipleMember(queue.length, queue[0].type)
			queue = []
		} else {
			const { payload, type } = queue.shift()
			const alias = getAllAlias()
			const name = alias[payload.member.id] || payload.member.displayName
			text = getTextSpeechForSingleMember(name, type)
		}

		logger.info('', `Bot said "${text}"`)
		speak(botConnection, text)
	}, 1500)
}
