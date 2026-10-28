import { getVoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import { disconnectBot, disconnectChannelSpeaker, shouldBotDisconnect } from './disconnectBotIfAlone'
import { createSpeakerPool } from '../speakerPool'

jest.mock('@discordjs/voice', () => ({ getVoiceConnection: jest.fn() }))

const mockPool = createSpeakerPool(['s1', 's2'])
jest.mock('../speakers', () => ({
	getSpeakerPool: () => mockPool,
	getSpeakers: () => [{ id: 's1' }, { id: 's2' }],
}))

const state = (channelId: string, size: number) =>
	({ channelId, channel: { members: { size } } } as unknown as VoiceState)

// A Speaker that has finished a Delivery stays in its channel but is no longer busy.
const occupy = async (channelId: string) => {
	const { speakerId } = await mockPool.acquire(channelId, 'guild')
	mockPool.release(speakerId)
}

describe('disconnectBotIfAlone', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockPool.vacateAll()
	})

	it('disconnects only when a Speaker of that channel is the last member left', async () => {
		await occupy('channel-a')

		expect(shouldBotDisconnect(state('channel-a', 1))).toBe(true)
		expect(shouldBotDisconnect(state('channel-a', 2))).toBe(false)
	})

	it('does not disconnect in a channel without a Speaker', () => {
		expect(shouldBotDisconnect(state('channel-b', 1))).toBe(false)
	})

	it('destroys the channel Speaker\'s own connection and frees the Speaker', async () => {
		const connection = { destroy: jest.fn() }
		jest.mocked(getVoiceConnection).mockReturnValue(connection as any)
		await occupy('channel-a')

		disconnectChannelSpeaker('guild', 'channel-a')

		expect(getVoiceConnection).toHaveBeenCalledWith('guild', 's1')
		expect(connection.destroy).toHaveBeenCalled()
		expect(mockPool.getSpeakerIn('channel-a')).toBeNull()
	})

	it('disconnects every Speaker in the guild', async () => {
		const connection = { destroy: jest.fn() }
		jest.mocked(getVoiceConnection).mockReturnValue(connection as any)
		await occupy('channel-a')

		expect(disconnectBot('guild')).toBe(2)
		expect(mockPool.snapshot().every((speaker) => speaker.channelId === null)).toBe(true)
	})
})
