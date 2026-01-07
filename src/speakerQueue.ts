import logger from 'npmlog'
import { v4 as uuidv4 } from 'uuid'
import { Mutex } from 'async-mutex'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import { getQueueState, QueueState, setQueueState } from './repository/queueState'
import { joinChannelAndSpeak } from './botAction'
import { DiscordGatewayAdapterCreator } from '@discordjs/voice'
import { QUEUE_DEBOUNCE_MS, QUEUE_MAX_SIZE } from './repository/constants'
import { NAME_CONNECTOR, SPEECH_TEMPLATES } from './repository/speechTemplates'

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

// Mutex to prevent race conditions when accessing the queue
const queueMutex = new Mutex()
let queue: QueueItem[] = []

/**
 * Resolves user display name from alias or falls back to the provided name
 */
const resolveDisplayName = (memberId: string, fallbackName: string): string => {
	const aliases = getAllAlias()
	return aliases[memberId] || fallbackName
}

/**
 * Waits for the queue to stabilize (no new events for QUEUE_DEBOUNCE_MS)
 * This batches multiple rapid events together for a better user experience
 */
const waitForQueueToStabilize = async (): Promise<void> => {
	let previousLength = -1
	while (previousLength !== queue.length) {
		previousLength = queue.length
		logger.verbose('waitForQueueToStabilize', `Queue length: ${queue.length}, waiting ${QUEUE_DEBOUNCE_MS}ms for more events...`)
		await new Promise((resolve) => setTimeout(resolve, QUEUE_DEBOUNCE_MS))
	}
	logger.info('waitForQueueToStabilize', `Queue stabilized with ${queue.length} event(s)`)
}

export const queueSpeaker = async (type: SpeakerQueueType, payload: QueueItemPayload): Promise<void> => {
	await queueMutex.runExclusive(() => {
		// Protect against queue overflow
		if (queue.length >= QUEUE_MAX_SIZE) {
			logger.warn('queueSpeaker', `Queue is full (max: ${QUEUE_MAX_SIZE}), dropping oldest event`)
			const droppedEvent = queue.shift()
			logger.warn('queueSpeaker', `Dropped event: ${JSON.stringify(droppedEvent)}`)
		}

		const event = {
			id: uuidv4(),
			type,
			payload,
		}
		queue.push(event)
		logger.info('queueSpeaker', `Enqueued event: ${JSON.stringify(event)}`)
	})

	if (getQueueState() === QueueState.IDLE) {
		consumeQueue()
	}
}

const getTextSpeechForMultipleMember = (names: string[], type: SpeakerQueueType): string => {
	const uniqueNames = names.filter((elem, pos) => names.indexOf(elem) === pos)
	const speechForNames = uniqueNames.join(NAME_CONNECTOR)

	switch (type) {
		case SpeakerQueueType.Join:
			return SPEECH_TEMPLATES.multipleJoin(speechForNames)
		case SpeakerQueueType.Left:
			return SPEECH_TEMPLATES.multipleLeft(speechForNames)
		case SpeakerQueueType.Afk:
			return SPEECH_TEMPLATES.multipleAfk(speechForNames)
		default:
			logger.error('getTextSpeechForMultipleMember', `Unhandled TTS event type: [${type}]`)
			throw new Error(`TTS event type isn't handled properly. type is [${type}]`)
	}
}

const getTextSpeechForSingleMember = (name: string, type: SpeakerQueueType): string => {
	switch (type) {
		case SpeakerQueueType.Join:
			return getJoiningSpeechTemplate().replace('{name}', name)
		case SpeakerQueueType.Left:
			return getLeavingSpeechTemplate().replace('{name}', name)
		case SpeakerQueueType.Afk:
			return SPEECH_TEMPLATES.singleAfk(name)
		default:
			logger.error('getTextSpeechForSingleMember', `Unhandled TTS event type: [${type}]`)
			throw new Error(`Unhandled type: ${type}`)
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
		logger.info('consumeQueue', 'Started processing queue')

		// Wait for queue to stabilize before processing
		await waitForQueueToStabilize()

		logger.info('consumeQueue', `Queue before consuming: ${JSON.stringify(queue)}`)
		while (queue.length > 0) {
			logger.verbose('consumeQueue', `Processing queue (${queue.length} event(s) remaining)`)
			const firstEvent = queue[0]

			// Handle frequent join/leave by same user in same channel
			const samePeopleSameChannelEvents = getSameUserSameChannelQueue(
				firstEvent.payload.memberId,
				firstEvent.payload.channelId
			)
			if (samePeopleSameChannelEvents.length > 1) {
				const samePeopleSameChannelEventIds = samePeopleSameChannelEvents.map((event) => event.id)
				queue = queue.filter((item) => !samePeopleSameChannelEventIds.includes(item.id))
				logger.info('consumeQueue', `Batched ${samePeopleSameChannelEvents.length} events for frequent join/leave user`)

				const name = resolveDisplayName(
					samePeopleSameChannelEvents[0].payload.memberId,
					samePeopleSameChannelEvents[0].payload.displayName
				)
				const text = SPEECH_TEMPLATES.frequentJoinLeave(name)

				await joinChannelAndSpeak(
					samePeopleSameChannelEvents[0].payload.guildId,
					samePeopleSameChannelEvents[0].payload.channelId,
					samePeopleSameChannelEvents[0].payload.adapterCreator,
					text
				)

				continue
			}

			// Handle multiple users with same event type in same channel
			const selectedEvents = getSameTypeSameChannelQueue(firstEvent.type, firstEvent.payload.channelId)
			const selectedEventsId = selectedEvents.map((event) => event.id)
			queue = queue.filter((item) => !selectedEventsId.includes(item.id))

			if (selectedEvents.length > 1) {
				logger.info('consumeQueue', `Batched ${selectedEvents.length} events of type "${firstEvent.type}"`)
				const names = selectedEvents.map((event) =>
					resolveDisplayName(event.payload.memberId, event.payload.displayName)
				)
				const text = getTextSpeechForMultipleMember(names, selectedEvents[0].type)

				await joinChannelAndSpeak(
					selectedEvents[0].payload.guildId,
					selectedEvents[0].payload.channelId,
					selectedEvents[0].payload.adapterCreator,
					text
				)

				continue
			}

			// Handle single user event
			if (selectedEvents.length === 1) {
				const { payload, type } = selectedEvents[0]
				const name = resolveDisplayName(payload.memberId, payload.displayName)
				const text = getTextSpeechForSingleMember(name, type)

				logger.info('consumeQueue', `Processing single event: type="${type}", name="${name}"`)
				await joinChannelAndSpeak(payload.guildId, payload.channelId, payload.adapterCreator, text)

				continue
			}
		}

		logger.info('consumeQueue', 'Queue processing completed')
	} catch (error) {
		logger.error('consumeQueue', `Error occurred while consuming queue: ${error}`)
	} finally {
		setQueueState(QueueState.IDLE)
		logger.verbose('consumeQueue', 'Queue state set to IDLE')
	}
}
