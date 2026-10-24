import { QueueItem, QueueItemPayload, reduceStableEvents, SpeakerQueueType } from './speakerQueue'

const payload: QueueItemPayload = {
	guildId: 'guild-1',
	channelId: 'channel-1',
	memberId: 'member-1',
	displayName: 'Member 1',
	adapterCreator: jest.fn() as any,
}

const event = (id: string, type: SpeakerQueueType, overrides: Partial<QueueItemPayload> = {}): QueueItem => ({
	id,
	type,
	payload: { ...payload, ...overrides },
})

describe('reduceStableEvents', () => {
	it('removes a join followed by a leave from the same channel', () => {
		const events = [event('join', SpeakerQueueType.Join), event('left', SpeakerQueueType.Left)]

		expect(reduceStableEvents(events)).toEqual([])
	})

	it('keeps a stable channel switch', () => {
		const events = [
			event('left', SpeakerQueueType.Left, { channelId: 'channel-1' }),
			event('join', SpeakerQueueType.Join, { channelId: 'channel-2' }),
		]

		expect(reduceStableEvents(events).map(({ id }) => id)).toEqual(['left', 'join'])
	})

	it('keeps only the most recent stable event for duplicate activity', () => {
		const events = [
			event('first', SpeakerQueueType.Join, { displayName: 'Old name' }),
			event('latest', SpeakerQueueType.Join, { displayName: 'New name' }),
		]

		expect(reduceStableEvents(events)).toEqual([events[1]])
	})

	it('preserves disconnect events', () => {
		const events = [event('disconnect', SpeakerQueueType.Disconnect, { memberId: '' })]

		expect(reduceStableEvents(events)).toEqual(events)
	})
})