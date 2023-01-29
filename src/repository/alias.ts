import * as fs from 'fs'

const ALIASES_FILE_PATH = '/data/alias.json'

export const getAllAlias = (): Record<string, string> => {
	const aliasesFile = fs.readFileSync(ALIASES_FILE_PATH, { encoding: 'utf8', flag: 'r+' })
	const aliases = JSON.parse(aliasesFile)

	return aliases
}

export const saveAlias = (user: string, newAlias: string): void => {
	const aliases = getAllAlias()
	aliases[user] = newAlias

	fs.writeFileSync(ALIASES_FILE_PATH, JSON.stringify(aliases))
}
