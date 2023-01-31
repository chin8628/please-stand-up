import { MAX_SPEECH_TEMPLATE_LETTERS } from './constants'

let leavingChannelSpeechTemplate = '{name} ออกไปแล้วจ้า'

export const getLeavingSpeechTemplate = (): string => {
	return leavingChannelSpeechTemplate
}

export const setLeavingSpeechTemplate = (template: string) => {
	if (template.length > MAX_SPEECH_TEMPLATE_LETTERS) {
		throw new Error(`Template cannot be longer than ${MAX_SPEECH_TEMPLATE_LETTERS} letters`)
	}

	if (!template.includes('{name}')) {
		throw new Error(`Could not found {name} in an given template. Given template:${template}`)
	}

	leavingChannelSpeechTemplate = template
}
