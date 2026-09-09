import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getSettings, saveAlias, setJoinTemplate } from './settings'

describe('settings repository', () => {
	let dataDirectory: string

	beforeEach(() => {
		dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'please-stand-up-'))
		process.env.BOT_DATA_DIR = dataDirectory
	})

	afterEach(() => {
		delete process.env.BOT_DATA_DIR
		fs.rmSync(dataDirectory, { recursive: true, force: true })
	})

	it('uses defaults when settings do not exist', () => {
		expect(getSettings()).toEqual({
			version: 1,
			aliases: {},
			joinTemplate: '{name} เข้ามาจ้า',
			leaveTemplate: '{name} ออกไปแล้วจ้า',
		})
	})

	it('uses defaults when settings are malformed', () => {
		fs.writeFileSync(path.join(dataDirectory, 'settings.json'), '{not json')

		expect(getSettings().aliases).toEqual({})
	})

	it('persists aliases and templates with a complete settings document', () => {
		saveAlias('member-1', 'New name')
		setJoinTemplate('Hello {name}')

		expect(getSettings()).toMatchObject({
			aliases: { 'member-1': 'New name' },
			joinTemplate: 'Hello {name}',
		})
		expect(fs.readdirSync(dataDirectory)).toEqual(['settings.json'])
	})
})