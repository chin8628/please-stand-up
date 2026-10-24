export interface SynthesisRequest {
	text: string
	/** Base language code such as 'th' or 'en'. The provider falls back to its default language when omitted or unknown. */
	lang?: string
}

export interface TtsProvider {
	readonly name: string
	/** Resolves with complete MP3 bytes, or rejects with TtsError. Empty audio is a failure. */
	synthesize(request: SynthesisRequest): Promise<Buffer>
}

export class TtsError extends Error {
	constructor(readonly provider: string, message: string, readonly cause?: unknown) {
		super(`[${provider}] ${message}`)
		this.name = 'TtsError'
	}
}

export interface VoiceConfig {
	/** Full BCP-47 code such as 'th-TH' */
	languageCode: string
	/** Provider voice name such as 'th-TH-Standard-A' */
	name: string
}
