import { Readable } from 'stream'
import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus,
} from '@discordjs/voice'
import { configureTts, getLastSpeechError, joinChannelAndSpeak } from './botAction'
import { setChannelId } from './repository/botState'
import { TtsError, TtsProvider } from './tts/types'

jest.mock('@discordjs/voice', () => ({
	AudioPlayerStatus: { Idle: 'idle' },
	VoiceConnectionStatus: { Ready: 'ready' },
	createAudioPlayer: jest.fn(),
	createAudioResource: jest.fn(),
	entersState: jest.fn(),
	joinVoiceChannel: jest.fn(),
}))

jest.mock('./repository/botState', () => ({ setChannelId: jest.fn() }))

describe('joinChannelAndSpeak', () => {
	const connection = { subscribe: jest.fn(), destroy: jest.fn() }
	const player = { play: jest.fn(), stop: jest.fn() }
	const synthesize = jest.fn()
	const provider: TtsProvider = { name: 'fake', synthesize }

	beforeEach(() => {
		jest.clearAllMocks()
		synthesize.mockResolvedValue(Buffer.from('mp3'))
		configureTts(provider)
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
		expect(synthesize).toHaveBeenCalledTimes(1)
		expect(synthesize).toHaveBeenCalledWith({ text: 'Hello' })
		const stream = jest.mocked(createAudioResource).mock.calls[0][0] as Readable
		let received = ''
		for await (const chunk of stream) received += chunk.toString()
		expect(received).toBe('mp3')
	})

	it('retries synthesis failures and skips delivery', async () => {
		synthesize.mockRejectedValue(new TtsError('fake', 'quota exceeded'))

		await expect(joinChannelAndSpeak('guild-1', 'channel-1', jest.fn() as any, 'Hello')).resolves.toBe(false)

		expect(synthesize).toHaveBeenCalledTimes(3)
		expect(synthesize).toHaveBeenCalledWith({ text: 'Hello' })
		expect(player.play).not.toHaveBeenCalled()
		expect(getLastSpeechError()).toBe('[fake] quota exceeded')
	})

	it('fails delivery when no TTS provider is configured', async () => {
		jest.resetModules()
		const fresh = await import('./botAction')

		await expect(fresh.joinChannelAndSpeak('guild-1', 'channel-1', jest.fn() as any, 'Hello')).resolves.toBe(false)

		expect(fresh.getLastSpeechError()).toMatch(/not configured/)
	})

	it('skips delivery after bounded retry exhaustion', async () => {
		jest.mocked(entersState).mockRejectedValue(new Error('connection failed'))

		await expect(joinChannelAndSpeak('guild-1', 'channel-1', jest.fn() as any, 'Hello')).resolves.toBe(false)

		expect(joinVoiceChannel).toHaveBeenCalledTimes(3)
		expect(connection.destroy).toHaveBeenCalledTimes(3)
		expect(getLastSpeechError()).toBe('connection failed')
	})
})