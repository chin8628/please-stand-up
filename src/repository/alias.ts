import * as fs from 'fs'

const ALIASES_FILE_PATH = '/var/please-stand-up/alias.json'
const DEFAULT_ALIAS_VALUE = JSON.stringify({})

export const createAliasFileIfNotExist = () => {
	fs.writeFile(ALIASES_FILE_PATH, DEFAULT_ALIAS_VALUE, { flag: 'wx' }, (err) => {
		if (err) throw err
		console.log('The alias file is created at', ALIASES_FILE_PATH)
	})
}

export const getAllAlias = (): Record<string, string> => {
	const aliasesFile = fs.readFileSync(__dirname + '/alias.json', { encoding: 'utf8', flag: 'r+' })
	const aliases = JSON.parse(aliasesFile)

	return aliases
}

export const saveAlias = (user: string, newAlias: string): void => {
	const aliases = getAllAlias()
	aliases[user] = newAlias

	fs.writeFileSync(ALIASES_FILE_PATH, JSON.stringify(aliases))
}
