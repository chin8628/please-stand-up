import { readFileSync } from 'fs'
import { getAllAlias } from './alias'

jest.mock('fs')

describe('Alias Repository', () => {
	describe('Read', () => {
		const aliases = { foo: 'bar' }

		beforeEach(() => {
			jest.mocked(readFileSync).mockReturnValue(JSON.stringify(aliases))
		})

		it('should read alias info from the alias file', () => {
			const actual = getAllAlias()
			expect(actual).toEqual(aliases)
		})
	})
})
