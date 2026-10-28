import { configureSpeakers, describeSpeakers, getAdapterCreator, getPrimarySpeaker, getSpeakerPool, isSpeakerId } from './speakers'

const speaker = (id: string, guildIds: string[]) =>
	({
		id,
		tag: `${id}#0001`,
		client: { guilds: { cache: new Map(guildIds.map((guildId) => [guildId, { voiceAdapterCreator: `adapter-${id}-${guildId}` }])) } },
	} as any)

describe('speakers', () => {
	beforeEach(() => {
		configureSpeakers([speaker('s1', ['guild']), speaker('s2', ['guild']), speaker('s3', ['other'])])
	})

	it('treats the first configured Speaker as primary', () => {
		expect(getPrimarySpeaker().id).toBe('s1')
	})

	it('recognises Speaker user ids', () => {
		expect(isSpeakerId('s2')).toBe(true)
		expect(isSpeakerId('human')).toBe(false)
		expect(isSpeakerId(undefined)).toBe(false)
	})

	it('uses each Speaker\'s own guild voice adapter', () => {
		expect(getAdapterCreator('s2', 'guild')).toBe('adapter-s2-guild')
		expect(() => getAdapterCreator('s3', 'guild')).toThrow(/not in guild/)
	})

	it('only assigns Speakers that are members of the guild', async () => {
		const pool = getSpeakerPool()
		const assigned = await Promise.all([pool.acquire('c1', 'guild'), pool.acquire('c2', 'guild')])

		expect(assigned.map((assignment) => assignment.speakerId)).toEqual(['s1', 's2'])
	})

	it('describes each Speaker with its channel', async () => {
		await getSpeakerPool().acquire('c1', 'guild')

		expect(describeSpeakers()[0]).toEqual({ id: 's1', tag: 's1#0001', channelId: 'c1', busy: true })
		expect(describeSpeakers()[1]).toEqual({ id: 's2', tag: 's2#0001', channelId: null, busy: false })
	})
})
