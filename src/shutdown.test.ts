import { createShutdownHandler } from './shutdown'

describe('createShutdownHandler', () => {
	it('closes immediately when no speech is active', async () => {
		const dependencies = {
			isSpeaking: jest.fn(() => false),
			stopSpeaking: jest.fn(),
			disconnect: jest.fn(),
			close: jest.fn(),
		}

		await createShutdownHandler(dependencies, 1)()

		expect(dependencies.stopSpeaking).toHaveBeenCalled()
		expect(dependencies.disconnect).toHaveBeenCalled()
		expect(dependencies.close).toHaveBeenCalled()
	})

	it('is idempotent for repeated signals', async () => {
		const dependencies = {
			isSpeaking: jest.fn(() => false),
			stopSpeaking: jest.fn(),
			disconnect: jest.fn(),
			close: jest.fn(),
		}
		const shutdown = createShutdownHandler(dependencies, 1)

		await shutdown()
		await shutdown()

		expect(dependencies.close).toHaveBeenCalledTimes(1)
	})
})