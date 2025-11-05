import logger from 'npmlog'
import { v4 as uuidv4 } from 'uuid'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import { getQueueState, QueueState, setQueueState } from './repository/queueState'
import { joinChannelAndSpeak } from './botAction'
import { DiscordGatewayAdapterCreator } from '@discordjs/voice'

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
	adapterCreator: DiscordGatewayAdapterCreator
}

type QueueItem = {
	id: string
	type: SpeakerQueueType
	payload: QueueItemPayload
}

// Queue is updated by multiple functions. I have concern that it will have race condition soon.
// Need to refactor this to use a better queue service.
let queue: QueueItem[] = []

export const queueSpeaker = (type: SpeakerQueueType, payload: QueueItemPayload) => {
	const event = {
		id: uuidv4(),
		type,
		payload,
	}
	queue.push(event)
	logger.info('enqueue', JSON.stringify(event))

	if (getQueueState() === QueueState.IDLE) consumeQueue()
}

const getTextSpeechForMultipleMember = (names: string[], type: SpeakerQueueType): string => {
	const speechForNames = names.filter((elem, pos) => names.indexOf(elem) == pos).join(' และ ')

	switch (type) {
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

const getSameUserSameChannelQueue = (memberId: string, channelId: string): QueueItem[] => {
	return queue.filter((item) => item.payload.memberId === memberId && item.payload.channelId === channelId)
}

const consumeQueue = async () => {
	try {
		setQueueState(QueueState.PROCESSING)
		for (let queueLength = 0; queueLength !== queue.length; queueLength = queue.length) {
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		logger.info('queue before consuming', JSON.stringify(queue))
		while (queue.length > 0) {
			const firstEvent = queue[0]

			const samePeopleSameChannelEvents = getSameUserSameChannelQueue(
				firstEvent.payload.memberId,
				firstEvent.payload.channelId
			)
			if (samePeopleSameChannelEvents.length > 1) {
				const samePeopleSameChannelEventIds = samePeopleSameChannelEvents.map((event) => event.id)
				queue = queue.filter((item) => !samePeopleSameChannelEventIds.includes(item.id))
				logger.info('consume queue', JSON.stringify(samePeopleSameChannelEvents))

				const name =
					getAllAlias[samePeopleSameChannelEvents[0].payload.memberId] ||
					samePeopleSameChannelEvents[0].payload.displayName
				const text = `เข้าออกทำเหี้ยอะไร ${name}`

				await joinChannelAndSpeak(
					samePeopleSameChannelEvents[0].payload.guildId,
					samePeopleSameChannelEvents[0].payload.channelId,
					samePeopleSameChannelEvents[0].payload.adapterCreator,
					text
				)

				continue
			}

			const selectedEvents = getSameTypeSameChannelQueue(firstEvent.type, firstEvent.payload.channelId)
			const selectedEventsId = selectedEvents.map((event) => event.id)
			queue = queue.filter((item) => !selectedEventsId.includes(item.id))
			logger.info('consume queue', JSON.stringify(selectedEvents))

			if (selectedEvents.length > 1) {
				const names = selectedEvents.map((event) => {
					const alias = getAllAlias()
					return alias[event.payload.memberId] || event.payload.displayName
				})
				const text = getTextSpeechForMultipleMember(names, selectedEvents[0].type)

				await joinChannelAndSpeak(
					selectedEvents[0].payload.guildId,
					selectedEvents[0].payload.channelId,
					selectedEvents[0].payload.adapterCreator,
					text
				)

				continue
			}

			if (selectedEvents.length === 1) {
				const { payload, type } = selectedEvents[0]

				const alias = getAllAlias()
				const name = alias[payload.memberId] || payload.displayName
				const text = getTextSpeechForSingleMember(name, type)

				await joinChannelAndSpeak(payload.guildId, payload.channelId, payload.adapterCreator, text)

				continue
			}
		}

		logger.info('queue after consuming', JSON.stringify(queue))
	} catch (error) {
		logger.error('consumeQueue()', 'Error occurred while consuming queue:', error)
	} finally {
		setQueueState(QueueState.IDLE)
	}
}
