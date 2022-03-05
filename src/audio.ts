import { createAudioResource, StreamType } from "@discordjs/voice"
import { join } from "node:path"
import { Readable, Stream } from "stream"
import { buffer } from "stream/consumers"

export function getNameAudioByName(name: string) {
	let nameAudio
	if (name) {
		nameAudio = createAudioResource(join(__dirname, `/audios/${name}.ogg`))
	} else {
		nameAudio = createAudioResource(join(__dirname, `/audios/unknown.ogg`))
	}

	return nameAudio
}

export function getIntroAudio() {
	const mahaloukSound = createAudioResource(join(__dirname, "/audios/intro.ogg"), {
		inputType: StreamType.OggOpus,
	})

	return mahaloukSound
}
