import { commandsConfig } from './commands'

jest.mock('./botAction', () => ({
	getLastSpeechError: jest.fn(() => null),
	isSpeaking: jest.fn(() => false),
	stopSpeaking: jest.fn(),
}))

jest.mock('./repository/alias', () => ({ saveAlias: jest.fn() }))
jest.mock('./speakers', () => ({ describeSpeakers: jest.fn(() => []) }))
jest.mock('./helpers/disconnectBotIfAlone', () => ({ disconnectBot: jest.fn(() => 0) }))
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

	it('registers every command under its Discord command name', () => {
		expect(commandsConfig).toEqual(
			expect.objectContaining({
				setjointemplate: expect.any(Object),
				setlefttemplate: expect.any(Object),
				callme: expect.any(Object),
				leave: expect.any(Object),
			})
		)
	})

	it('does not register removed start and stop commands', () => {
		expect(commandsConfig).not.toHaveProperty('start')
		expect(commandsConfig).not.toHaveProperty('stop')
	})
})