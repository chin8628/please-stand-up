import logger from 'npmlog'
import { v4 as uuidv4 } from 'uuid'
import { Mutex } from 'async-mutex'
import { getAllAlias } from './repository/alias'
import { getJoiningSpeechTemplate } from './repository/joinChannelSpeechTemplate'
import { getLeavingSpeechTemplate } from './repository/leaveChannelSpeechTemplate'
import { getQueueState, QueueState, setQueueState } from './repository/queueState'
import { joinChannelAndSpeak, stopSpeaking } from './botAction'
import { disconnectBot, disconnectChannelSpeaker } from './helpers/disconnectBotIfAlone'
import { getAdapterCreator, getSpeakerPool } from './speakers'
import { QUEUE_DEBOUNCE_MS, QUEUE_MAX_SIZE } from './repository/constants'
import { NAME_CONNECTOR, SPEECH_TEMPLATES } from './repository/speechTemplates'

export enum SpeakerQueueType {
	Left = 'left',
	Join = 'join',
	Afk = 'afk',
	Disconnect = 'disconnect',
}

export type QueueItemPayload = {
	guildId: string
	channelId: string
	memberId: string
	displayName: string
}

export type QueueItem = {
	id: string
	type: SpeakerQueueType
	payload: QueueItemPayload
}

// Mutex to prevent race conditions when accessing the queue
const queueMutex = new Mutex()
let queue: QueueItem[] = []

// Channels with a Delivery in flight. A channel is served by one Speaker at a time, but
// different channels are served in parallel by different Speakers.
const inflight = new Map<string, Promise<void>>()
let wakeConsumer: (() => void) | null = null

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

	wakeConsumer?.()

	if (getQueueState() === QueueState.IDLE) {
		consumeQueue()
	}
}

export const clearQueue = async (): Promise<number> => {
	return await queueMutex.runExclusive(() => {
		const queueLength = queue.length
		queue = []
		logger.info('clearQueue', `Queue cleared. ${queueLength} event(s) removed`)
		return queueLength
	})
}

export const resetQueue = async (guildId: string): Promise<number> => {
	const removedCount = await clearQueue()
	stopSpeaking()
	disconnectBot(guildId)
	setQueueState(QueueState.IDLE)
	return removedCount
}

export const getQueueDepth = (): number => queue.length

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

export const reduceStableEvents = (events: QueueItem[]): QueueItem[] => {
	const stableEvents = new Map<string, { event: QueueItem; types: Set<SpeakerQueueType> }>()
	const disconnectEvents: QueueItem[] = []

	for (const event of events) {
		if (event.type === SpeakerQueueType.Disconnect) {
			disconnectEvents.push(event)
			continue
		}

		const key = `${event.payload.guildId}:${event.payload.channelId}:${event.payload.memberId}`
		const existingEvent = stableEvents.get(key)
		if (existingEvent) {
			existingEvent.event = event
			existingEvent.types.add(event.type)
			continue
		}

		stableEvents.set(key, { event, types: new Set([event.type]) })
	}

	return [
		...Array.from(stableEvents.values())
			.filter(({ types }) => !(types.has(SpeakerQueueType.Join) && types.has(SpeakerQueueType.Left)))
			.map(({ event }) => event),
		...disconnectEvents,
	]
}

const deliver = async (guildId: string, channelId: string, text: string): Promise<void> => {
	const pool = getSpeakerPool()
	const { speakerId, previousChannelId } = await pool.acquire(channelId, guildId)
	if (previousChannelId && previousChannelId !== channelId) {
		logger.info('deliver', `Speaker ${speakerId} hops from channel ${previousChannelId} to ${channelId}`)
	}

	let delivered = false
	try {
		delivered = await joinChannelAndSpeak(speakerId, guildId, channelId, getAdapterCreator(speakerId, guildId), text)
	} catch (error) {
		logger.error('deliver', `Speaker ${speakerId} failed to deliver in channel ${channelId}: ${error}`)
	} finally {
		// A failed Delivery destroyed the connection, so the Speaker no longer occupies the channel.
		pool.release(speakerId, { keepChannel: delivered })
	}
}

const startDelivery = (guildId: string, channelId: string, text: string): void => {
	const delivery = deliver(guildId, channelId, text).finally(() => {
		inflight.delete(channelId)
	})
	inflight.set(channelId, delivery)
}

const waitForProgress = async (): Promise<void> => {
	await Promise.race([...inflight.values(), new Promise<void>((resolve) => (wakeConsumer = resolve))])
	wakeConsumer = null
}

const consumeQueue = async () => {
	try {
		setQueueState(QueueState.PROCESSING)
		logger.info('consumeQueue', 'Started processing queue')

		// Wait for queue to stabilize before processing
		await waitForQueueToStabilize()
		await queueMutex.runExclusive(() => {
			queue = reduceStableEvents(queue)
		})

		logger.info('consumeQueue', `Queue before consuming: ${JSON.stringify(queue)}`)
		while (queue.length > 0 || inflight.size > 0) {
			// Events for a channel that is mid-Delivery stay queued so they can be batched together
			const firstEvent = queue.find((item) => !inflight.has(item.payload.channelId))
			if (!firstEvent) {
				await waitForProgress()
				continue
			}
			logger.verbose('consumeQueue', `Processing queue (${queue.length} event(s) remaining)`)

			// Handle disconnect events - process immediately and clear remaining events for this channel
			if (firstEvent.type === SpeakerQueueType.Disconnect) {
				const channelId = firstEvent.payload.channelId
				const guildId = firstEvent.payload.guildId

				// Remove all events for this channel (including the disconnect event itself)
				const eventsToRemove = queue.filter((item) => item.payload.channelId === channelId)
				queue = queue.filter((item) => item.payload.channelId !== channelId)

				logger.info(
					'consumeQueue',
					`Processing disconnect event, removing ${eventsToRemove.length} event(s) for channel ${channelId}`
				)

				// Free the Speaker in this channel
				disconnectChannelSpeaker(guildId, channelId)

				continue
			}

			// Handle multiple users with same event type in same channel
			const selectedEvents = getSameTypeSameChannelQueue(firstEvent.type, firstEvent.payload.channelId)
			const selectedEventsId = selectedEvents.map((event) => event.id)
			queue = queue.filter((item) => !selectedEventsId.includes(item.id))

			const { guildId, channelId } = selectedEvents[0].payload
			const names = selectedEvents.map((event) => resolveDisplayName(event.payload.memberId, event.payload.displayName))

			if (selectedEvents.length > 1) {
				logger.info('consumeQueue', `Batched ${selectedEvents.length} events of type "${firstEvent.type}"`)
				startDelivery(guildId, channelId, getTextSpeechForMultipleMember(names, firstEvent.type))
				continue
			}

			logger.info('consumeQueue', `Processing single event: type="${firstEvent.type}", name="${names[0]}"`)
			startDelivery(guildId, channelId, getTextSpeechForSingleMember(names[0], firstEvent.type))
		}

		logger.info('consumeQueue', 'Queue processing completed')
	} catch (error) {
		logger.error('consumeQueue', `Error occurred while consuming queue: ${error}`)
	} finally {
		setQueueState(QueueState.IDLE)
		logger.verbose('consumeQueue', 'Queue state set to IDLE')
	}
}
