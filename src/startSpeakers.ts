import logger from 'npmlog'
import { Speaker } from './speakers'

/**
 * Logs every Speaker in. The first token is the Primary Speaker, whose failure is fatal;
 * any other Speaker that fails is skipped with a warning.
 */
export const startSpeakers = async (tokens: string[], login: (token: string) => Promise<Speaker>): Promise<Speaker[]> => {
	const [primaryToken, ...otherTokens] = tokens

	let primary: Speaker
	try {
		primary = await login(primaryToken)
	} catch (error) {
		throw new Error(`Primary Speaker failed to log in: ${error instanceof Error ? error.message : String(error)}`)
	}

	const results = await Promise.allSettled(otherTokens.map(login))
	const others: Speaker[] = []
	results.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			others.push(result.value)
		} else {
			logger.warn('speakers', `Speaker #${index + 2} failed to log in and will be skipped: ${result.reason}`)
		}
	})

	return [primary, ...others]
}
