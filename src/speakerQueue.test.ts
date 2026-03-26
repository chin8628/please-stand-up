import { clearQueue, queueSpeaker, SpeakerQueueType } from './speakerQueue'

jest.mock('./botAction', () => ({
	joinChannelAndSpeak: jest.fn().mockResolvedValue(undefined),
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
}))

describe('speakerQueue clearQueue', () => {
	it('should clear all queued events and return removed count', async () => {
		const payload = {
			guildId: 'guild-1',
			channelId: 'channel-1',
			memberId: 'member-1',
			displayName: 'member-1',
			adapterCreator: jest.fn() as any,
		}

		await queueSpeaker(SpeakerQueueType.Join, payload)
		await queueSpeaker(SpeakerQueueType.Left, { ...payload, memberId: 'member-2', displayName: 'member-2' })
		const removed = await clearQueue()

		expect(removed).toBe(2)
		expect(await clearQueue()).toBe(0)
	})
})
