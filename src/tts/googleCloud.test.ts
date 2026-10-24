import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createGoogleCloudTts, GoogleCloudTtsProvider } from './googleCloud'
import { TtsError, VoiceConfig } from './types'

const voices: Record<string, VoiceConfig> = {
	th: { languageCode: 'th-TH', name: 'th-TH-Standard-A' },
	en: { languageCode: 'en-US', name: 'en-US-Standard-C' },
}

function setup(result: unknown = [{ audioContent: new Uint8Array([1, 2, 3]) }]) {
	const synthesizeSpeech = jest.fn().mockResolvedValue(result)
	const provider = new GoogleCloudTtsProvider({ synthesizeSpeech } as never, voices, 'th')
	return { synthesizeSpeech, provider }
}

describe('GoogleCloudTtsProvider', () => {
	it('returns audio bytes on success', async () => {
		const { provider } = setup()
		expect(provider.name).toBe('google-cloud')
		expect(await provider.synthesize({ text: 'hi', lang: 'en' })).toEqual(Buffer.from([1, 2, 3]))
	})

	it('accepts string audio content', async () => {
		const { provider } = setup([{ audioContent: 'abc' }])
		expect(await provider.synthesize({ text: 'hi', lang: 'en' })).toEqual(Buffer.from('abc'))
	})

	it('picks the voice for the language and requests MP3', async () => {
		const { provider, synthesizeSpeech } = setup()
		await provider.synthesize({ text: 'hello', lang: 'en' })
		expect(synthesizeSpeech).toHaveBeenCalledWith({
			input: { text: 'hello' },
			voice: { languageCode: 'en-US', name: 'en-US-Standard-C' },
			audioConfig: { audioEncoding: 'MP3' },
		})
	})

	it('falls back to the default language for unknown or missing lang', async () => {
		const { provider, synthesizeSpeech } = setup()
		await provider.synthesize({ text: 'x', lang: 'fr' })
		await provider.synthesize({ text: 'x' })
		for (const call of synthesizeSpeech.mock.calls) {
			expect(call[0].voice).toEqual({ languageCode: 'th-TH', name: 'th-TH-Standard-A' })
		}
	})

	it('throws when neither language nor default has a voice', async () => {
		const provider = new GoogleCloudTtsProvider({ synthesizeSpeech: jest.fn() } as never, {}, 'th')
		await expect(provider.synthesize({ text: 'x' })).rejects.toBeInstanceOf(TtsError)
	})

	it('wraps client errors keeping the cause', async () => {
		const cause = new Error('boom')
		const synthesizeSpeech = jest.fn().mockRejectedValue(cause)
		const provider = new GoogleCloudTtsProvider({ synthesizeSpeech } as never, voices, 'th')
		const error = await provider.synthesize({ text: 'x' }).catch((e) => e)
		expect(error).toBeInstanceOf(TtsError)
		expect(error.cause).toBe(cause)
	})

	it.each([[undefined], [null], [new Uint8Array()], ['']])('rejects empty audio %p', async (audioContent) => {
		const { provider } = setup([{ audioContent }])
		await expect(provider.synthesize({ text: 'x' })).rejects.toBeInstanceOf(TtsError)
	})

	it('rejects empty text without calling the client', async () => {
		const { provider, synthesizeSpeech } = setup()
		await expect(provider.synthesize({ text: '  ' })).rejects.toBeInstanceOf(TtsError)
		expect(synthesizeSpeech).not.toHaveBeenCalled()
	})
})

describe('createGoogleCloudTts', () => {
	const key = JSON.stringify({ client_email: 'a@b.iam', private_key: 'x' })
	let dir: string
	let keyFile: string
	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), 'tts-gcloud-'))
		keyFile = join(dir, 'key.json')
		writeFileSync(keyFile, key)
	})
	afterAll(() => rmSync(dir, { recursive: true, force: true }))

	const build = (env: NodeJS.ProcessEnv) => {
		const synthesizeSpeech = jest.fn().mockResolvedValue([{ audioContent: Buffer.from('mp3') }])
		const makeClient = jest.fn().mockReturnValue({ synthesizeSpeech })
		const provider = createGoogleCloudTts(env, { makeClient })
		return { provider, makeClient, synthesizeSpeech }
	}
	const cloudEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
		GOOGLE_APPLICATION_CREDENTIALS: keyFile,
		TTS_VOICE_TH: 'th-TH-Standard-A',
		TTS_VOICE_EN: 'en-US-Standard-C',
		...extra,
	})

	it('builds a client from the key file and uses the configured voices', async () => {
		const { provider, makeClient, synthesizeSpeech } = build(cloudEnv())
		expect(provider).toBeInstanceOf(GoogleCloudTtsProvider)
		expect(makeClient).toHaveBeenCalledWith(keyFile)
		await provider.synthesize({ text: 'x' })
		await provider.synthesize({ text: 'x', lang: 'en' })
		expect(synthesizeSpeech.mock.calls[0][0].voice).toEqual({ languageCode: 'th-TH', name: 'th-TH-Standard-A' })
		expect(synthesizeSpeech.mock.calls[1][0].voice).toEqual({ languageCode: 'en-US', name: 'en-US-Standard-C' })
	})

	it('defaults the language to th and treats an empty TTS_DEFAULT_LANG as unset', async () => {
		const { provider, synthesizeSpeech } = build(cloudEnv({ TTS_DEFAULT_LANG: '' }))
		await provider.synthesize({ text: 'x' })
		expect(synthesizeSpeech.mock.calls[0][0].voice.name).toBe('th-TH-Standard-A')
	})

	it.each(['TTS_VOICE_TH', 'TTS_VOICE_EN'])('requires %s, rejecting unset and empty values', (key) => {
		expect(() => build(cloudEnv({ [key]: undefined }))).toThrow(new RegExp(`${key} is required`))
		expect(() => build(cloudEnv({ [key]: '  ' }))).toThrow(new RegExp(`${key} is required`))
	})

	it('applies overrides', async () => {
		const { provider, synthesizeSpeech } = build(
			cloudEnv({ TTS_DEFAULT_LANG: 'en', TTS_VOICE_TH: 'th-TH-Neural2-C', TTS_VOICE_EN: 'en-US-Neural2-A' }),
		)
		await provider.synthesize({ text: 'x' })
		await provider.synthesize({ text: 'x', lang: 'th' })
		expect(synthesizeSpeech.mock.calls[0][0].voice).toEqual({ languageCode: 'en-US', name: 'en-US-Neural2-A' })
		expect(synthesizeSpeech.mock.calls[1][0].voice).toEqual({ languageCode: 'th-TH', name: 'th-TH-Neural2-C' })
	})

	it('rejects an unknown default language', () => {
		expect(() => build(cloudEnv({ TTS_DEFAULT_LANG: 'fr' }))).toThrow(/TTS_DEFAULT_LANG.*th, en/)
	})

	it('rejects voice names with the wrong language prefix', () => {
		expect(() => build(cloudEnv({ TTS_VOICE_TH: 'en-US-Standard-C' }))).toThrow(/TTS_VOICE_TH/)
		expect(() => build(cloudEnv({ TTS_VOICE_EN: 'th-TH-Standard-A' }))).toThrow(/TTS_VOICE_EN/)
	})

	it('rejects an unset key file path, naming the variable', () => {
		expect(() => build(cloudEnv({ GOOGLE_APPLICATION_CREDENTIALS: undefined }))).toThrow(/GOOGLE_APPLICATION_CREDENTIALS/)
		expect(() => build(cloudEnv({ GOOGLE_APPLICATION_CREDENTIALS: '  ' }))).toThrow(/GOOGLE_APPLICATION_CREDENTIALS/)
	})

	it('rejects a missing key file with its path and a container hint', () => {
		const path = join(dir, 'nope.json')
		expect(() => build(cloudEnv({ GOOGLE_APPLICATION_CREDENTIALS: path }))).toThrow(new RegExp(`${path}.*container`))
	})

	it('rejects a key file that is not JSON', () => {
		const bad = join(dir, 'bad.json')
		writeFileSync(bad, 'not json')
		expect(() => build(cloudEnv({ GOOGLE_APPLICATION_CREDENTIALS: bad }))).toThrow(/not valid JSON/)
	})
})
