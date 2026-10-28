import { createSpeakerPool } from './speakerPool'

describe('speakerPool', () => {
	it('gives each channel its own Speaker', async () => {
		const pool = createSpeakerPool(['s1', 's2'])

		const first = await pool.acquire('channel-a', 'guild')
		const second = await pool.acquire('channel-b', 'guild')

		expect(first.speakerId).toBe('s1')
		expect(second.speakerId).toBe('s2')
		expect(pool.getSpeakerIn('channel-a')).toBe('s1')
		expect(pool.getSpeakerIn('channel-b')).toBe('s2')
	})

	it('reuses the Speaker already in the channel', async () => {
		const pool = createSpeakerPool(['s1', 's2'])
		await pool.acquire('channel-a', 'guild')
		pool.release('s1')

		const again = await pool.acquire('channel-a', 'guild')

		expect(again.speakerId).toBe('s1')
		expect(pool.snapshot().filter((speaker) => speaker.channelId === 'channel-a')).toHaveLength(1)
	})

	it('never puts two Speakers in the same channel', async () => {
		const pool = createSpeakerPool(['s1', 's2'])
		await pool.acquire('channel-a', 'guild')

		let resolved = false
		const waiting = pool.acquire('channel-a', 'guild').then((assignment) => {
			resolved = true
			return assignment
		})
		await Promise.resolve()
		expect(resolved).toBe(false)

		pool.release('s1')
		expect((await waiting).speakerId).toBe('s1')
		expect(pool.snapshot().filter((speaker) => speaker.channelId === 'channel-a')).toHaveLength(1)
	})

	it('hops the longest-idle Speaker when every Speaker is in another channel', async () => {
		const pool = createSpeakerPool(['s1', 's2'])
		await pool.acquire('channel-a', 'guild')
		await pool.acquire('channel-b', 'guild')
		pool.release('s2')
		pool.release('s1')

		const hop = await pool.acquire('channel-c', 'guild')

		expect(hop).toEqual({ speakerId: 's2', previousChannelId: 'channel-b' })
		expect(pool.getSpeakerIn('channel-b')).toBeNull()
		expect(pool.getSpeakerIn('channel-c')).toBe('s2')
		expect(pool.getSpeakerIn('channel-a')).toBe('s1')
	})

	it('prefers a Speaker that is not in any channel over hopping', async () => {
		const pool = createSpeakerPool(['s1', 's2'])
		await pool.acquire('channel-a', 'guild')
		pool.release('s1')

		const next = await pool.acquire('channel-b', 'guild')

		expect(next).toEqual({ speakerId: 's2', previousChannelId: null })
		expect(pool.getSpeakerIn('channel-a')).toBe('s1')
	})

	it('waits instead of hopping a Speaker that is speaking', async () => {
		const pool = createSpeakerPool(['s1'])
		await pool.acquire('channel-a', 'guild')

		let resolved = false
		const waiting = pool.acquire('channel-b', 'guild').then((assignment) => {
			resolved = true
			return assignment
		})
		await Promise.resolve()
		expect(resolved).toBe(false)
		expect(pool.getSpeakerIn('channel-a')).toBe('s1')

		pool.release('s1')

		expect(await waiting).toEqual({ speakerId: 's1', previousChannelId: 'channel-a' })
		expect(pool.getSpeakerIn('channel-a')).toBeNull()
		expect(pool.getSpeakerIn('channel-b')).toBe('s1')
	})

	it('serves waiting channels in the order they asked', async () => {
		const pool = createSpeakerPool(['s1'])
		await pool.acquire('channel-a', 'guild')
		const order: string[] = []
		const second = pool.acquire('channel-b', 'guild').then(() => order.push('b'))
		const third = pool.acquire('channel-c', 'guild').then(() => order.push('c'))

		pool.release('s1')
		await second
		pool.release('s1')
		await third

		expect(order).toEqual(['b', 'c'])
	})

	it('only assigns Speakers that can serve the guild', async () => {
		const pool = createSpeakerPool(['s1', 's2'], (speakerId, guildId) => !(speakerId === 's1' && guildId === 'guild'))

		const assignment = await pool.acquire('channel-a', 'guild')

		expect(assignment.speakerId).toBe('s2')
	})

	it('frees a Speaker when its channel is left', async () => {
		const pool = createSpeakerPool(['s1'])
		await pool.acquire('channel-a', 'guild')
		pool.release('s1')

		expect(pool.leaveChannel('channel-a')).toBe('s1')
		expect(pool.getSpeakerIn('channel-a')).toBeNull()
		expect(pool.leaveChannel('channel-a')).toBeNull()
	})

	it('can drop the claim when releasing after a failed delivery', async () => {
		const pool = createSpeakerPool(['s1'])
		await pool.acquire('channel-a', 'guild')

		pool.release('s1', { keepChannel: false })

		expect(pool.getSpeakerIn('channel-a')).toBeNull()
	})

	it('reports speaking state in snapshots and clears every claim on reset', async () => {
		const pool = createSpeakerPool(['s1', 's2'])
		await pool.acquire('channel-a', 'guild')

		expect(pool.snapshot()).toEqual([
			{ speakerId: 's1', channelId: 'channel-a', busy: true },
			{ speakerId: 's2', channelId: null, busy: false },
		])

		pool.vacateAll()

		expect(pool.snapshot().every((speaker) => speaker.channelId === null)).toBe(true)
	})
})
