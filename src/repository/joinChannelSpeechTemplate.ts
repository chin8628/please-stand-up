import { MAX_SPEECH_TEMPLATE_LETTERS } from './constants'

let joinChannelTemplate = '{name} เข้ามาจ้า'

export const getJoiningSpeechTemplate = (): string => {
	return joinChannelTemplate
}

export const setJoiningSpeechTemplate = (template: string) => {
	if (template.length > MAX_SPEECH_TEMPLATE_LETTERS) {
		throw new Error(`Template cannot be longer than ${MAX_SPEECH_TEMPLATE_LETTERS} letters`)
	}

	if (!template.includes('{name}')) {
		throw new Error(`Could not found {name} in an given template. Given template:${template}`)
	}

	joinChannelTemplate = template
}
