import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../speakerQueue'
import { userJoinChannel } from './userJoinChannel'

jest.mock('../speakerQueue', () => ({
	queueSpeaker: jest.fn(),
	SpeakerQueueType: { Join: 'join' },
}))

const voiceState = (overrides: Record<string, unknown> = {}): VoiceState =>
	({
		channelId: 'channel-1',
		member: { id: 'member-1', displayName: 'Member 1' },
		channel: { members: { size: 2 }, userLimit: 0 },
		guild: { id: 'guild-1', afkChannelId: 'afk-channel', voiceAdapterCreator: jest.fn() },
		...overrides,
	} as unknown as VoiceState)

describe('userJoinChannel', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('queues eligible joins', () => {
		const state = voiceState()

		userJoinChannel(state)

		expect(queueSpeaker).toHaveBeenCalledWith(
			SpeakerQueueType.Join,
			expect.objectContaining({ guildId: 'guild-1', channelId: 'channel-1', memberId: 'member-1' })
		)
	})

	it.each([
		['the first member in a channel', { channel: { members: { size: 1 }, userLimit: 0 } }],
		['a user-limited channel', { channel: { members: { size: 2 }, userLimit: 3 } }],
		['an AFK channel', { channelId: 'afk-channel' }],
	])('does not queue joins for %s', (_description, overrides) => {
		userJoinChannel(voiceState(overrides))

		expect(queueSpeaker).not.toHaveBeenCalled()
	})
})