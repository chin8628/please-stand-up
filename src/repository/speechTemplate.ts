const MAX_TEMPLATE_LETTER = 80
let joinChannelTemplate = '{name} เข้ามาจ้า'

export const getJoiningSpeechTemplate = (): string => {
	return joinChannelTemplate
}

export const setJoiningSpeechTemplate = (template: string) => {
	if (template.length > MAX_TEMPLATE_LETTER) {
		throw new Error(`Template cannot be longer than ${MAX_TEMPLATE_LETTER} letters`)
	}

	if (!template.includes('{name}')) {
		throw new Error(`Could not found {name} in an given template. Given template:${template}`)
	}

	joinChannelTemplate = template
}
