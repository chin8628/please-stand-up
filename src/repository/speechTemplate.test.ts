import { getJoiningSpeechTemplate, setJoiningSpeechTemplate } from './speechTemplate'

describe('Speech Template Repository', () => {
	it('should get joining template with its default value when no one updated it yet', () => {
		const actual = getJoiningSpeechTemplate()
		expect(actual).toEqual('{name} เข้ามาจ้า')
	})

	describe('set a new joining template', () => {
		it('should set it correctly', () => {
			setJoiningSpeechTemplate('Hi {name}, Welcome to the channel!')

			const actual = getJoiningSpeechTemplate()
			expect(actual).toEqual('Hi {name}, Welcome to the channel!')
		})

		describe('should throw an error', () => {
			test('when it is more than 80 letters', () => {
				const newTemplate = 'a'.repeat(81)

				expect(() => setJoiningSpeechTemplate(newTemplate)).toThrowError('Template cannot be longer than 80 letters')
			})

			test('when it does not include {name}', () => {
				const newTemplate = 'foo'
				expect(() => setJoiningSpeechTemplate(newTemplate)).toThrowError(
					`Could not found {name} in an given template. Given template:${newTemplate}`
				)
			})
		})
	})
})
