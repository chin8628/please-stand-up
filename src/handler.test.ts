import { VoiceState } from 'discord.js'
import { handler } from './handler'
import { userMovedToAFKHandler } from './handlers/userMovedToAFK'
import { userJoinChannel } from './handlers/userJoinChannel'
import { userLeftChannel } from './handlers/userLeftChannel'

jest.mock('./handlers/userMovedToAFK')
jest.mock('./handlers/userJoinChannel')
jest.mock('./handlers/userLeftChannel')

const buildDefaultVoiceState = (): VoiceState => {
	return {
		channelId: '0',
		guild: {
			afkChannelId: '1',
		},
	} as unknown as VoiceState
}

describe('handler', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('should call userMovedToAFK only when user moved to AFK', () => {
		const prevState = buildDefaultVoiceState()
		const nextState = { ...buildDefaultVoiceState(), channelId: '1' } as unknown as VoiceState

		handler(prevState, nextState)

		expect(userMovedToAFKHandler).toBeCalledWith(prevState, nextState)
		expect(userJoinChannel).not.toBeCalled()
		expect(userLeftChannel).not.toBeCalled()
	})

	it('should call userJoinChannel only when user switches a channel from AFK channel', () => {
		const prevState = { ...buildDefaultVoiceState(), channelId: '1' } as unknown as VoiceState
		const nextState = { ...buildDefaultVoiceState(), channelId: '2' } as unknown as VoiceState

		handler(prevState, nextState)

		expect(userMovedToAFKHandler).not.toBeCalled()
		expect(userJoinChannel).toBeCalledWith(nextState)
		expect(userLeftChannel).not.toBeCalled()
	})

	it('should call userLeftChannel and userJoinChannel only when user switches a channel and prev channel is not afk channel', () => {
		const prevState = { ...buildDefaultVoiceState(), channelId: '2' } as unknown as VoiceState
		const nextState = { ...buildDefaultVoiceState(), channelId: '3' } as unknown as VoiceState

		handler(prevState, nextState)

		expect(userMovedToAFKHandler).not.toBeCalled()
		expect(userLeftChannel).toBeCalledWith(prevState)
		expect(userJoinChannel).toBeCalledWith(nextState)
	})

	it('should call userLeftChannel only when user left a channel', () => {
		const prevState = { ...buildDefaultVoiceState(), channelId: '1' } as unknown as VoiceState
		const nextState = { ...buildDefaultVoiceState(), channelId: undefined } as unknown as VoiceState

		handler(prevState, nextState)

		expect(userMovedToAFKHandler).not.toBeCalled()
		expect(userJoinChannel).not.toBeCalled()
		expect(userLeftChannel).toBeCalledWith(prevState)
	})
})
