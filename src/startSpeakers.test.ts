import { startSpeakers } from './startSpeakers'

const speaker = (token: string) => ({ id: `id-${token}`, tag: `tag-${token}`, client: {} as any })

describe('startSpeakers', () => {
	it('returns every Speaker in token order, primary first', async () => {
		const speakers = await startSpeakers(['a', 'b', 'c'], async (token) => speaker(token))

		expect(speakers.map((s) => s.id)).toEqual(['id-a', 'id-b', 'id-c'])
	})

	it('continues without a non-primary Speaker that fails to log in', async () => {
		const speakers = await startSpeakers(['a', 'bad', 'c'], async (token) => {
			if (token === 'bad') throw new Error('invalid token')
			return speaker(token)
		})

		expect(speakers.map((s) => s.id)).toEqual(['id-a', 'id-c'])
	})

	it('fails when the Primary Speaker cannot log in', async () => {
		await expect(
			startSpeakers(['bad', 'b'], async (token) => {
				if (token === 'bad') throw new Error('invalid token')
				return speaker(token)
			})
		).rejects.toThrow(/Primary Speaker/)
	})
})
