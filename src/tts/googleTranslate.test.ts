import { createGoogleTranslateTts, GoogleTranslateTtsProvider } from './googleTranslate'
import { TtsError } from './types'

const b64 = (s: string) => Buffer.from(s).toString('base64')

const makeProvider = (impl: jest.Mock, defaultLang?: string) =>
	new GoogleTranslateTtsProvider({ getAllAudioBase64: impl }, defaultLang)

describe('GoogleTranslateTtsProvider', () => {
	it('has a stable name', () => {
		expect(makeProvider(jest.fn()).name).toBe('google-translate')
	})

	it('returns decoded audio for a single chunk', async () => {
		const fake = jest.fn().mockResolvedValue([{ shortText: 'hi', base64: b64('audio') }])
		const result = await makeProvider(fake).synthesize({ text: 'hi' })
		expect(result.toString()).toBe('audio')
	})

	it('concatenates multiple chunks in order', async () => {
		const fake = jest.fn().mockResolvedValue([
			{ shortText: 'a', base64: b64('one-') },
			{ shortText: 'b', base64: b64('two-') },
			{ shortText: 'c', base64: b64('three') },
		])
		const result = await makeProvider(fake).synthesize({ text: 'long text' })
		expect(result.toString()).toBe('one-two-three')
	})

	it('uses the default language when none is given', async () => {
		const fake = jest.fn().mockResolvedValue([{ shortText: 'x', base64: b64('a') }])
		await makeProvider(fake).synthesize({ text: 'x' })
		expect(fake).toHaveBeenCalledWith('x', expect.objectContaining({ lang: 'th' }))
	})

	it('uses a custom default language', async () => {
		const fake = jest.fn().mockResolvedValue([{ shortText: 'x', base64: b64('a') }])
		await makeProvider(fake, 'ja').synthesize({ text: 'x' })
		expect(fake).toHaveBeenCalledWith('x', expect.objectContaining({ lang: 'ja' }))
	})

	it('overrides the language per request', async () => {
		const fake = jest.fn().mockResolvedValue([{ shortText: 'x', base64: b64('a') }])
		await makeProvider(fake).synthesize({ text: 'x', lang: 'en' })
		expect(fake).toHaveBeenCalledWith('x', expect.objectContaining({ lang: 'en' }))
	})

	it('wraps underlying errors in TtsError and keeps the cause', async () => {
		const cause = new Error('network down')
		const fake = jest.fn().mockRejectedValue(cause)
		const error = await makeProvider(fake).synthesize({ text: 'x' }).catch((e) => e)
		expect(error).toBeInstanceOf(TtsError)
		expect(error.provider).toBe('google-translate')
		expect(error.cause).toBe(cause)
		expect(error.message).toContain('network down')
	})

	it.each(['', '   '])('rejects empty text %j without calling the API', async (text) => {
		const fake = jest.fn()
		await expect(makeProvider(fake).synthesize({ text })).rejects.toBeInstanceOf(TtsError)
		expect(fake).not.toHaveBeenCalled()
	})

	it.each([[[]], [[{ shortText: 'x', base64: '' }]]])('rejects empty audio %j', async (chunks) => {
		const fake = jest.fn().mockResolvedValue(chunks)
		await expect(makeProvider(fake).synthesize({ text: 'x' })).rejects.toBeInstanceOf(TtsError)
	})
})

describe('createGoogleTranslateTts', () => {
	const make = (env: NodeJS.ProcessEnv) => {
		const fake = jest.fn().mockResolvedValue([{ shortText: 'x', base64: b64('a') }])
		return { fake, provider: createGoogleTranslateTts(env, { googleTts: { getAllAudioBase64: fake } }) }
	}

	it('builds a translate provider defaulting to th', async () => {
		const { fake, provider } = make({})
		expect(provider).toBeInstanceOf(GoogleTranslateTtsProvider)
		await provider.synthesize({ text: 'x' })
		expect(fake).toHaveBeenCalledWith('x', expect.objectContaining({ lang: 'th' }))
	})

	it('treats an empty TTS_DEFAULT_LANG as unset', async () => {
		const { fake, provider } = make({ TTS_DEFAULT_LANG: '' })
		await provider.synthesize({ text: 'x' })
		expect(fake).toHaveBeenCalledWith('x', expect.objectContaining({ lang: 'th' }))
	})

	it('applies TTS_DEFAULT_LANG=en', async () => {
		const { fake, provider } = make({ TTS_DEFAULT_LANG: 'en' })
		await provider.synthesize({ text: 'x' })
		expect(fake).toHaveBeenCalledWith('x', expect.objectContaining({ lang: 'en' }))
	})

	it('rejects an unknown default language', () => {
		expect(() => make({ TTS_DEFAULT_LANG: 'fr' })).toThrow(/TTS_DEFAULT_LANG.*th, en/)
	})
})
