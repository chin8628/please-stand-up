import { getAliases, saveAlias as persistAlias } from './settings'

export const getAllAlias = (): Record<string, string> => getAliases()

export const saveAlias = (user: string, newAlias: string): void => {
	persistAlias(user, newAlias)
}
