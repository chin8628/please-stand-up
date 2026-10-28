/**
 * Speaker tokens from `TOKENS` (comma-separated) or the legacy single `TOKEN`.
 * The first token is the Primary Speaker.
 */
export const parseSpeakerTokens = (env: NodeJS.ProcessEnv): string[] => {
	const raw = env.TOKENS?.trim() ? env.TOKENS : env.TOKEN
	const tokens = Array.from(
		new Set(
			(raw ?? '')
				.split(',')
				.map((token) => token.trim())
				.filter(Boolean)
		)
	)

	if (tokens.length === 0) {
		throw new Error('TOKENS is not set. Provide one or more comma-separated Discord bot tokens (or legacy TOKEN).')
	}
	return tokens
}
