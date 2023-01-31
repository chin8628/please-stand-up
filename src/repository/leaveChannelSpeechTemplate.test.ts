import { getLeavingSpeechTemplate, setLeavingSpeechTemplate } from './leaveChannelSpeechTemplate'

describe('Leaving Channel Speech Template Repository', () => {
	it('should get leaving speech template with its default value when no one updated it yet', () => {
		const actual = getLeavingSpeechTemplate()
		expect(actual).toEqual('{name} ออกไปแล้วจ้า')
	})

	describe('set a new joining template', () => {
		it('should set it correctly', () => {
			setLeavingSpeechTemplate('{name} left the channel')

			const actual = getLeavingSpeechTemplate()
			expect(actual).toEqual('{name} left the channel')
		})

		describe('should throw an error', () => {
			test('when it is more than 80 letters', () => {
				const newTemplate = 'a'.repeat(81)

				expect(() => setLeavingSpeechTemplate(newTemplate)).toThrowError('Template cannot be longer than 80 letters')
			})

			test('when it does not include {name}', () => {
				const newTemplate = 'foo'
				expect(() => setLeavingSpeechTemplate(newTemplate)).toThrowError(
					`Could not found {name} in an given template. Given template:${newTemplate}`
				)
			})
		})
	})
})
