import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus,
} from '@discordjs/voice'
import { getLastSpeechError, joinChannelAndSpeak } from './botAction'
import { setChannelId } from './repository/botState'

jest.mock('@discordjs/voice', () => ({
	AudioPlayerStatus: { Idle: 'idle' },
	VoiceConnectionStatus: { Ready: 'ready' },
	createAudioPlayer: jest.fn(),
	createAudioResource: jest.fn(),
	entersState: jest.fn(),
	joinVoiceChannel: jest.fn(),
}))

jest.mock('discord-tts', () => ({ getVoiceStream: jest.fn() }))
jest.mock('./repository/botState', () => ({ setChannelId: jest.fn() }))

describe('joinChannelAndSpeak', () => {
	const connection = { subscribe: jest.fn(), destroy: jest.fn() }
	const player = { play: jest.fn(), stop: jest.fn() }

	beforeEach(() => {
		jest.clearAllMocks()
		jest.mocked(joinVoiceChannel).mockReturnValue(connection as any)
		jest.mocked(createAudioPlayer).mockReturnValue(player as any)
		jest.mocked(createAudioResource).mockReturnValue({} as any)
		jest.mocked(entersState).mockResolvedValue(undefined as never)
		connection.subscribe.mockReturnValue({ unsubscribe: jest.fn() })
	})

	it('waits for a ready connection before playing speech', async () => {
		await expect(joinChannelAndSpeak('guild-1', 'channel-1', jest.fn() as any, 'Hello')).resolves.toBe(true)

		expect(entersState).toHaveBeenNthCalledWith(1, connection, VoiceConnectionStatus.Ready, 5_000)
		expect(player.play).toHaveBeenCalled()
		expect(entersState).toHaveBeenNthCalledWith(2, player, AudioPlayerStatus.Idle, 30_000)
		expect(setChannelId).toHaveBeenCalledWith('channel-1')
	})

	it('skips delivery after bounded retry exhaustion', async () => {
		jest.mocked(entersState).mockRejectedValue(new Error('connection failed'))

		await expect(joinChannelAndSpeak('guild-1', 'channel-1', jest.fn() as any, 'Hello')).resolves.toBe(false)

		expect(joinVoiceChannel).toHaveBeenCalledTimes(3)
		expect(connection.destroy).toHaveBeenCalledTimes(3)
		expect(getLastSpeechError()).toBe('connection failed')
	})
})