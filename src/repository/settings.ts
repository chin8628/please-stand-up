import * as fs from 'fs'
import * as path from 'path'
import logger from 'npmlog'
import { MAX_SPEECH_TEMPLATE_LETTERS } from './constants'

const SETTINGS_FILE_NAME = 'settings.json'
const SETTINGS_VERSION = 1

const defaultSettings = {
	version: SETTINGS_VERSION,
	aliases: {} as Record<string, string>,
	joinTemplate: '{name} เข้ามาจ้า',
	leaveTemplate: '{name} ออกไปแล้วจ้า',
}

export type Settings = typeof defaultSettings

const getSettingsPath = (): string => path.join(process.env.BOT_DATA_DIR || './data', SETTINGS_FILE_NAME)

const isTemplate = (template: unknown): template is string =>
	typeof template === 'string' && template.length <= MAX_SPEECH_TEMPLATE_LETTERS && template.includes('{name}')

const isAliases = (aliases: unknown): aliases is Record<string, string> => {
	if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) return false
	return Object.values(aliases).every((alias) => typeof alias === 'string')
}

const isSettings = (value: unknown): value is Settings => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false

	const settings = value as Partial<Settings>
	return (
		settings.version === SETTINGS_VERSION &&
		isAliases(settings.aliases) &&
		isTemplate(settings.joinTemplate) &&
		isTemplate(settings.leaveTemplate)
	)
}

const getDefaultSettings = (): Settings => ({
	...defaultSettings,
	aliases: {},
})

export const getSettings = (): Settings => {
	try {
		const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'))
		if (isSettings(settings)) return settings

		logger.warn('settings', 'Settings file is invalid. Using defaults.')
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			logger.warn('settings', `Could not read settings. Using defaults: ${error}`)
		}
	}

	return getDefaultSettings()
}

export const saveSettings = (settings: Settings): void => {
	const settingsPath = getSettingsPath()
	const settingsDirectory = path.dirname(settingsPath)
	const temporaryPath = `${settingsPath}.${process.pid}.tmp`

	fs.mkdirSync(settingsDirectory, { recursive: true })
	fs.writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
	fs.renameSync(temporaryPath, settingsPath)
}

export const updateSettings = (update: (settings: Settings) => Settings): Settings => {
	const updatedSettings = update(getSettings())
	if (!isSettings(updatedSettings)) {
		throw new Error('Attempted to save invalid settings')
	}

	saveSettings(updatedSettings)
	return updatedSettings
}

export const getAliases = (): Record<string, string> => getSettings().aliases

export const saveAlias = (user: string, alias: string): void => {
	updateSettings((settings) => ({
		...settings,
		aliases: {
			...settings.aliases,
			[user]: alias,
		},
	}))
}

export const getJoinTemplate = (): string => getSettings().joinTemplate

export const setJoinTemplate = (template: string): void => {
	updateSettings((settings) => ({ ...settings, joinTemplate: template }))
}

export const getLeaveTemplate = (): string => getSettings().leaveTemplate

export const setLeaveTemplate = (template: string): void => {
	updateSettings((settings) => ({ ...settings, leaveTemplate: template }))
}