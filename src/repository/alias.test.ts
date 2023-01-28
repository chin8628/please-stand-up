import { readFileSync, writeFileSync } from 'fs'
import { getAllAlias, saveAlias } from './alias'

jest.mock('fs')

describe('Alias Repository', () => {
	const aliases = { foo: 'bar' }

	beforeEach(() => {
		jest.mocked(readFileSync).mockReturnValue(JSON.stringify(aliases))
	})

	describe('Read', () => {
		it('should return alias info from the alias file', () => {
			const actual = getAllAlias()
			expect(actual).toEqual(aliases)
		})
	})

	describe('Write', () => {
		it('should save a new alias to aliases file', () => {
			saveAlias('test1', 'test2')

			expect(writeFileSync).toBeCalledWith(expect.anything(), JSON.stringify({ foo: 'bar', test1: 'test2' }))
		})

		it('should update a new alias on existed alias', () => {
			saveAlias('foo', 'test1')

			expect(writeFileSync).toBeCalledWith(expect.anything(), JSON.stringify({ foo: 'test1' }))
		})
	})
})
