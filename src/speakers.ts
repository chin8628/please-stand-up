import { DiscordGatewayAdapterCreator } from '@discordjs/voice'
import { Client } from 'discord.js'
import { createSpeakerPool, SpeakerPool } from './speakerPool'

export type Speaker = {
	id: string
	tag: string
	client: Client
}

let speakers: Speaker[] = []
let pool: SpeakerPool | null = null

/** Registers the logged-in Speakers. The first one is the Primary Speaker. */
export const configureSpeakers = (list: Speaker[]): void => {
	speakers = list
	pool = createSpeakerPool(
		list.map((speaker) => speaker.id),
		(speakerId, guildId) => findSpeaker(speakerId)?.client.guilds.cache.has(guildId) ?? false
	)
}

const findSpeaker = (speakerId: string): Speaker | undefined => speakers.find((speaker) => speaker.id === speakerId)

export const getSpeakers = (): Speaker[] => speakers

export const getPrimarySpeaker = (): Speaker => {
	if (speakers.length === 0) throw new Error('Speakers are not configured; call configureSpeakers() first')
	return speakers[0]
}

export const getSpeakerPool = (): SpeakerPool => {
	if (!pool) throw new Error('Speakers are not configured; call configureSpeakers() first')
	return pool
}

export const isSpeakerId = (userId: string | null | undefined): boolean =>
	!!userId && speakers.some((speaker) => speaker.id === userId)

/** The voice adapter must come from the Speaker's own client; another client cannot join on its behalf. */
export const getAdapterCreator = (speakerId: string, guildId: string): DiscordGatewayAdapterCreator => {
	const guild = findSpeaker(speakerId)?.client.guilds.cache.get(guildId)
	if (!guild) throw new Error(`Speaker ${speakerId} is not in guild ${guildId}`)
	return guild.voiceAdapterCreator
}

export const describeSpeakers = () =>
	getSpeakerPool()
		.snapshot()
		.map(({ speakerId, channelId, busy }) => ({
			id: speakerId,
			tag: findSpeaker(speakerId)?.tag ?? speakerId,
			channelId,
			busy,
		}))
