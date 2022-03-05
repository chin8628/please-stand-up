import fs from "fs"
import { join } from "node:path"

function getBase64ByName(name: string): string {
	const filepath = join(__dirname, `/../base64Audios/${name}.txt`)
	let base64text = fs.readFileSync(filepath, { encoding: "utf8" })

	return base64text
}

function convertBase64ToBinary(base64: string) {
	const byteCharacters = Buffer.from(base64, "base64").toString("binary")
	const bytes = new Uint8Array(byteCharacters.length)
	for (let i = 0; i < byteCharacters.length; i++) {
		bytes[i] = byteCharacters.charCodeAt(i)
	}
	return bytes
}

function main() {
	const name = process.argv.slice(2)[0]
	const base64text = getBase64ByName(name)
	const bin = convertBase64ToBinary(base64text)

	fs.writeFileSync(join(__dirname, `/../audios/${name}.ogg`), bin)
}

main()