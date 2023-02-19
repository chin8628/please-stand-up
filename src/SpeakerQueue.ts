import { Guild, GuildMember } from 'discord.js'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import logger from 'npmlog'
import discordTTS from 'discord-tts'
import { createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice'

export enum SpeakerQueueType {
	Left = 'left',
	Join = 'join',
	Afk = 'afk',
}

type QueueItemPayload = {
	member: GuildMember
	guild: Guild
}

type QueueItem = {
	type: SpeakerQueueType
	payload: QueueItemPayload
}

let queue: QueueItem[] = []

const speak = (guildId: string, text: string) => {
	logger.info('', `Bot said "${text}"`)
	const voiceConnection = getVoiceConnection(guildId)

	const resource = createAudioResource(discordTTS.getVoiceStream(text, { lang: 'th' }))
	const audioPlayer = createAudioPlayer()
	const subscription = voiceConnection.subscribe(audioPlayer)
	audioPlayer.play(resource)
	if (subscription) {
		setTimeout(() => subscription.unsubscribe(), 10_000)
	}
}

export const queueSpeaker = (guild: Guild, member: GuildMember, type: SpeakerQueueType) => {
	if (queue.find((item) => item.payload.member.id === member.id)) {
		return
	}

	queue.push({
		type,
		payload: {
			guild,
			member,
		},
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
			const text = getTextSpeechForMultipleMember(queue.length, queue[0].type)
			speak(queue[0].payload.guild.id, text)

			queue = []
		} else {
			const { payload, type } = queue.shift()

			const alias = getAllAlias()
			const name = alias[payload.member.id] || payload.member.displayName
			const text = getTextSpeechForSingleMember(name, type)

			speak(payload.guild.id, text)
		}
	}, 1500)
}
