import { readFileSync } from 'fs'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { SynthesisRequest, TtsError, TtsProvider, VoiceConfig } from './types'

export class GoogleCloudTtsProvider implements TtsProvider {
	readonly name = 'google-cloud'

	private readonly client: Pick<TextToSpeechClient, 'synthesizeSpeech'>
	private readonly voices: Record<string, VoiceConfig>
	private readonly defaultLang: string

	constructor(
		client: Pick<TextToSpeechClient, 'synthesizeSpeech'>,
		voices: Record<string, VoiceConfig>,
		defaultLang: string,
	) {
		this.client = client
		this.voices = voices
		this.defaultLang = defaultLang
	}

	async synthesize({ text, lang }: SynthesisRequest): Promise<Buffer> {
		if (!text || text.trim().length === 0) {
			throw new TtsError(this.name, 'Cannot synthesize empty text')
		}
		const voice = (lang !== undefined ? this.voices[lang] : undefined) ?? this.voices[this.defaultLang]
		if (!voice) {
			throw new TtsError(this.name, `No voice configured for '${lang ?? ''}' or default '${this.defaultLang}'`)
		}

		let audioContent: Uint8Array | string | null | undefined
		try {
			const [response] = await this.client.synthesizeSpeech({
				input: { text },
				voice: { languageCode: voice.languageCode, name: voice.name },
				audioConfig: { audioEncoding: 'MP3' },
			})
			audioContent = response.audioContent as Uint8Array | string | null | undefined
		} catch (error) {
			throw new TtsError(this.name, 'Speech synthesis request failed', error)
		}

		if (!audioContent || audioContent.length === 0) {
			throw new TtsError(this.name, 'Speech synthesis returned empty audio')
		}
		return Buffer.from(audioContent)
	}
}

const read = (env: NodeJS.ProcessEnv, key: string): string | undefined => {
	const value = env[key]
	return value === undefined || value.trim() === '' ? undefined : value.trim()
}

const readVoice = (env: NodeJS.ProcessEnv, key: string, languageCode: string): VoiceConfig => {
	const name = read(env, key)
	if (name === undefined) {
		throw new Error(`${key} is required (a Google Cloud ${languageCode} voice name, e.g. "${languageCode}-Standard-A")`)
	}
	if (!name.startsWith(`${languageCode}-`)) {
		throw new Error(`${key}="${name}" is invalid: a ${languageCode} voice name must start with "${languageCode}-"`)
	}
	return { languageCode, name }
}

const readKeyFile = (env: NodeJS.ProcessEnv): string => {
	const path = read(env, 'GOOGLE_APPLICATION_CREDENTIALS')
	if (path === undefined) {
		throw new Error('TTS_PROVIDER=google-cloud requires GOOGLE_APPLICATION_CREDENTIALS (path to a service account key file)')
	}

	let content: string
	try {
		content = readFileSync(path, 'utf8')
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code
		throw new Error(
			`Google Cloud key file "${path}" cannot be read (${code ?? 'unknown error'}). Inside a container this must be a path inside the container (mount the key file with -v)`,
		)
	}
	try {
		JSON.parse(content)
	} catch {
		throw new Error(`Google Cloud key file "${path}" is not valid JSON`)
	}
	return path
}

export const createGoogleCloudTts = (
	env: NodeJS.ProcessEnv,
	deps: {
		makeClient?: (keyFilename: string) => Pick<TextToSpeechClient, 'synthesizeSpeech'>
	} = {},
): TtsProvider => {
	const voices: Record<string, VoiceConfig> = {
		th: readVoice(env, 'TTS_VOICE_TH', 'th-TH'),
		en: readVoice(env, 'TTS_VOICE_EN', 'en-US'),
	}
	const defaultLang = read(env, 'TTS_DEFAULT_LANG') ?? 'th'
	if (!Object.prototype.hasOwnProperty.call(voices, defaultLang)) {
		throw new Error(
			`TTS_DEFAULT_LANG="${defaultLang}" is invalid. Valid values: ${Object.keys(voices).join(', ')}`,
		)
	}
	const keyFilename = readKeyFile(env)
	const makeClient = deps.makeClient ?? ((file: string) => new TextToSpeechClient({ keyFilename: file }))
	return new GoogleCloudTtsProvider(makeClient(keyFilename), voices, defaultLang)
}
