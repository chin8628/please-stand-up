import * as realGoogleTts from 'google-tts-api'
import type * as GoogleTtsApi from 'google-tts-api'
import { SynthesisRequest, TtsError, TtsProvider } from './types'

type GoogleTts = Pick<typeof GoogleTtsApi, 'getAllAudioBase64'>

const TIMEOUT_MS = 15000

export class GoogleTranslateTtsProvider implements TtsProvider {
	readonly name = 'google-translate'

	private readonly googleTts: GoogleTts
	private readonly defaultLang: string

	constructor(googleTts: GoogleTts, defaultLang = 'th') {
		this.googleTts = googleTts
		this.defaultLang = defaultLang
	}

	async synthesize({ text, lang }: SynthesisRequest): Promise<Buffer> {
		if (!text || text.trim() === '') {
			throw new TtsError(this.name, 'Cannot synthesize empty text')
		}

		let chunks: { shortText: string; base64: string }[]
		try {
			chunks = await this.googleTts.getAllAudioBase64(text, {
				lang: lang ?? this.defaultLang,
				slow: false,
				timeout: TIMEOUT_MS,
			})
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			throw new TtsError(this.name, `Synthesis failed: ${reason}`, error)
		}

		const buffers = (chunks ?? []).map((chunk) => Buffer.from(chunk.base64 ?? '', 'base64'))
		const audio = Buffer.concat(buffers as unknown as Uint8Array[])
		if (audio.length === 0) {
			throw new TtsError(this.name, 'Synthesis returned empty audio')
		}
		return audio
	}
}

const LANGS = ['th', 'en']

export const createGoogleTranslateTts = (
	env: NodeJS.ProcessEnv,
	deps: { googleTts?: GoogleTts } = {},
): TtsProvider => {
	const raw = env.TTS_DEFAULT_LANG?.trim()
	const defaultLang = raw === undefined || raw === '' ? 'th' : raw
	if (!LANGS.includes(defaultLang)) {
		throw new Error(
			`TTS_DEFAULT_LANG="${defaultLang}" is invalid. Valid values: ${LANGS.join(', ')}`,
		)
	}
	return new GoogleTranslateTtsProvider(deps.googleTts ?? realGoogleTts, defaultLang)
}
