import { getAllAlias, saveAlias } from './alias'
import { getAliases, saveAlias as persistAlias } from './settings'

jest.mock('./settings', () => ({
	getAliases: jest.fn(),
	saveAlias: jest.fn(),
}))

describe('Alias Repository', () => {
	const aliases = { foo: 'bar' }

	beforeEach(() => {
		jest.mocked(getAliases).mockReturnValue(aliases)
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

			expect(persistAlias).toHaveBeenCalledWith('test1', 'test2')
		})
	})
})
