import { VoiceState } from 'discord.js'
import { isPleaseStandUp } from './isPleaseStandUp'

jest.mock('../speakers', () => ({ isSpeakerId: (id?: string) => id === 's1' || id === 's2' }))

const state = (memberId?: string) => ({ member: memberId ? { id: memberId } : null } as unknown as VoiceState)

describe('isPleaseStandUp', () => {
	it('recognises every Speaker, not just one', () => {
		expect(isPleaseStandUp(state('s1'))).toBe(true)
		expect(isPleaseStandUp(state('s2'))).toBe(true)
	})

	it('lets human members through', () => {
		expect(isPleaseStandUp(state('human'))).toBe(false)
		expect(isPleaseStandUp(state())).toBe(false)
	})
})
