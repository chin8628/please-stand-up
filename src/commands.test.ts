import { commandsConfig } from './commands'

jest.mock('./botAction', () => ({
	getLastSpeechError: jest.fn(() => null),
	isSpeaking: jest.fn(() => false),
	stopSpeaking: jest.fn(),
}))

jest.mock('./repository/alias', () => ({ saveAlias: jest.fn() }))
jest.mock('./repository/botState', () => ({ getChannelId: jest.fn(() => null) }))
jest.mock('./repository/joinChannelSpeechTemplate', () => ({ setJoiningSpeechTemplate: jest.fn() }))
jest.mock('./repository/leaveChannelSpeechTemplate', () => ({ setLeavingSpeechTemplate: jest.fn() }))
jest.mock('./repository/queueState', () => ({ getQueueState: jest.fn(() => 'IDLE') }))
jest.mock('./speakerQueue', () => ({ getQueueDepth: jest.fn(() => 0), resetQueue: jest.fn() }))

describe('commandsConfig', () => {
	it('registers runtime status and queue recovery commands', () => {
		expect(commandsConfig).toEqual(
			expect.objectContaining({
				status: expect.any(Object),
				reset: expect.any(Object),
			})
		)
	})

	it('does not register removed start and stop commands', () => {
		expect(commandsConfig).not.toHaveProperty('start')
		expect(commandsConfig).not.toHaveProperty('stop')
	})
})