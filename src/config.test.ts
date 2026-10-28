import { parseSpeakerTokens } from './config'

describe('parseSpeakerTokens', () => {
	it('reads comma-separated TOKENS, trimming blanks', () => {
		expect(parseSpeakerTokens({ TOKENS: ' a, b ,,c ' })).toEqual(['a', 'b', 'c'])
	})

	it('falls back to the legacy single TOKEN', () => {
		expect(parseSpeakerTokens({ TOKEN: 'solo' })).toEqual(['solo'])
	})

	it('prefers TOKENS over TOKEN', () => {
		expect(parseSpeakerTokens({ TOKENS: 'a,b', TOKEN: 'solo' })).toEqual(['a', 'b'])
	})

	it('drops duplicate tokens, keeping the first as primary', () => {
		expect(parseSpeakerTokens({ TOKENS: 'a,b,a' })).toEqual(['a', 'b'])
	})

	it('throws when no token is configured', () => {
		expect(() => parseSpeakerTokens({})).toThrow(/TOKENS/)
		expect(() => parseSpeakerTokens({ TOKENS: ' , ' })).toThrow(/TOKENS/)
	})
})
