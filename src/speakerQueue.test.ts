import { clearQueue, queueSpeaker, resetQueue, SpeakerQueueType } from './speakerQueue'
import { stopSpeaking } from './botAction'
import { disconnectBot, disconnectChannelSpeaker } from './helpers/disconnectBotIfAlone'
import { joinChannelAndSpeak } from './botAction'
import { getSpeakerPool } from './speakers'

jest.mock('./botAction', () => ({
	joinChannelAndSpeak: jest.fn().mockResolvedValue(undefined),
	stopSpeaking: jest.fn(),
}))

jest.mock('./repository/alias', () => ({
	getAllAlias: jest.fn(() => ({})),
}))

jest.mock('./repository/joinChannelSpeechTemplate', () => ({
	getJoiningSpeechTemplate: jest.fn(() => '{name} joined'),
}))

jest.mock('./repository/leaveChannelSpeechTemplate', () => ({
	getLeavingSpeechTemplate: jest.fn(() => '{name} left'),
}))

jest.mock('./helpers/disconnectBotIfAlone', () => ({
	disconnectBot: jest.fn(),
	disconnectChannelSpeaker: jest.fn(),
}))

jest.mock('./repository/constants', () => ({
	...jest.requireActual('./repository/constants'),
	QUEUE_DEBOUNCE_MS: 10,
}))

jest.mock('./speakers', () => {
	const { createSpeakerPool } = jest.requireActual('./speakerPool')
	const pool = createSpeakerPool(['s1', 's2'])
	return {
		getSpeakerPool: () => pool,
		getAdapterCreator: () => jest.fn(),
	}
})

describe('speakerQueue clearQueue', () => {
	it('should clear all queued events and return removed count', async () => {
		const payload = {
			guildId: 'guild-1',
			channelId: 'channel-1',
			memberId: 'member-1',
			displayName: 'member-1',
		}

		await queueSpeaker(SpeakerQueueType.Join, payload)
		await queueSpeaker(SpeakerQueueType.Left, { ...payload, memberId: 'member-2', displayName: 'member-2' })
		const removed = await clearQueue()

		expect(removed).toBe(2)
		expect(await clearQueue()).toBe(0)
	})

	it('cancels active speech and disconnects when resetting', async () => {
		const removed = await resetQueue('guild-1')

		expect(removed).toBe(0)
		expect(stopSpeaking).toHaveBeenCalled()
		expect(disconnectBot).toHaveBeenCalledWith('guild-1')
	})
})

describe('speakerQueue delivery', () => {
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
	const event = (channelId: string, memberId: string) => ({
		guildId: 'guild-1',
		channelId,
		memberId,
		displayName: memberId,
	})
	let finishers: Array<() => void>

	beforeEach(async () => {
		jest.clearAllMocks()
		await clearQueue()
		finishers = []
		jest.mocked(joinChannelAndSpeak).mockImplementation(
			() => new Promise<boolean>((resolve) => finishers.push(() => resolve(true)))
		)
	})

	afterEach(async () => {
		// let any pending delivery finish so the next test starts idle
		for (let i = 0; i < 10; i += 1) {
			finishers.splice(0).forEach((finish) => finish())
			await wait(30)
		}
		getSpeakerPool().vacateAll()
	})

	it('delivers different channels in parallel with different Speakers', async () => {
		await queueSpeaker(SpeakerQueueType.Join, event('channel-a', 'member-a'))
		await queueSpeaker(SpeakerQueueType.Join, event('channel-b', 'member-b'))
		await wait(100)

		const calls = jest.mocked(joinChannelAndSpeak).mock.calls
		expect(calls).toHaveLength(2)
		expect(calls.map(([speakerId]) => speakerId).sort()).toEqual(['s1', 's2'])
		expect(calls.map(([, , channelId]) => channelId).sort()).toEqual(['channel-a', 'channel-b'])
	})

	it('keeps later events of a busy channel queued and batches them into one announcement', async () => {
		await queueSpeaker(SpeakerQueueType.Join, event('channel-a', 'member-1'))
		await wait(100)
		expect(joinChannelAndSpeak).toHaveBeenCalledTimes(1)

		await queueSpeaker(SpeakerQueueType.Join, event('channel-a', 'member-2'))
		await queueSpeaker(SpeakerQueueType.Join, event('channel-a', 'member-3'))
		await wait(50)
		expect(joinChannelAndSpeak).toHaveBeenCalledTimes(1)

		finishers.splice(0).forEach((finish) => finish())
		await wait(100)

		expect(joinChannelAndSpeak).toHaveBeenCalledTimes(2)
		const text = jest.mocked(joinChannelAndSpeak).mock.calls[1][4]
		expect(text).toContain('member-2')
		expect(text).toContain('member-3')
	})

	it('still announces a third channel by hopping a Speaker once one is idle', async () => {
		await queueSpeaker(SpeakerQueueType.Join, event('channel-a', 'member-a'))
		await queueSpeaker(SpeakerQueueType.Join, event('channel-b', 'member-b'))
		await wait(100)
		await queueSpeaker(SpeakerQueueType.Join, event('channel-c', 'member-c'))
		await wait(50)
		expect(joinChannelAndSpeak).toHaveBeenCalledTimes(2)

		finishers.shift()?.()
		await wait(100)

		const channels = jest.mocked(joinChannelAndSpeak).mock.calls.map(([, , channelId]) => channelId)
		expect(channels).toContain('channel-c')
		expect(getSpeakerPool().getSpeakerIn('channel-c')).not.toBeNull()
	})

	it('frees the channel Speaker on a disconnect event after the leave announcement', async () => {
		await queueSpeaker(SpeakerQueueType.Left, event('channel-a', 'member-a'))
		await queueSpeaker(SpeakerQueueType.Disconnect, { ...event('channel-a', ''), displayName: '' })
		await wait(100)
		expect(disconnectChannelSpeaker).not.toHaveBeenCalled()

		finishers.splice(0).forEach((finish) => finish())
		await wait(100)

		expect(disconnectChannelSpeaker).toHaveBeenCalledWith('guild-1', 'channel-a')
	})

	it('releases the claim when a Delivery fails', async () => {
		jest.mocked(joinChannelAndSpeak).mockResolvedValue(false)

		await queueSpeaker(SpeakerQueueType.Join, event('channel-a', 'member-a'))
		await wait(100)

		expect(getSpeakerPool().getSpeakerIn('channel-a')).toBeNull()
	})
})
