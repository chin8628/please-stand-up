import { getVoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { getSpeakerPool, getSpeakers } from '../speakers'

/**
 * Checks if a Speaker should disconnect because it's the only member left in its channel.
 * Instead of disconnecting immediately, this now queues a disconnect event to avoid
 * race conditions with the speaker queue processor.
 * @returns true if a disconnect event should be queued, false otherwise
 */
export const shouldBotDisconnect = (prevState: VoiceState): boolean => {
	const speakerId = getSpeakerPool().getSpeakerIn(prevState.channelId)
	logger.info(
		'check to leave channel',
		JSON.stringify({
			speakerId,
			prevState: {
				memberSize: prevState.channel.members.size,
				channelId: prevState.channelId,
			},
		})
	)

	// A Speaker should disconnect if it's the only one left in the channel it occupies
	return prevState.channel.members.size === 1 && speakerId !== null
}

/**
 * Disconnects the Speaker that occupies the channel, freeing it for other channels.
 * This should only be called from the queue processor.
 */
export const disconnectChannelSpeaker = (guildId: string, channelId: string): void => {
	const speakerId = getSpeakerPool().leaveChannel(channelId)
	const connection = speakerId ? getVoiceConnection(guildId, speakerId) : undefined
	if (connection) {
		connection.destroy()
		logger.info('disconnectChannelSpeaker', `Speaker ${speakerId} left channel ${channelId}`)
	} else {
		logger.info('disconnectChannelSpeaker', `No Speaker connection to destroy for channel ${channelId}`)
	}
}

/**
 * Disconnects every Speaker in the guild.
 * @returns how many voice connections were destroyed
 */
export const disconnectBot = (guildId: string): number => {
	let destroyed = 0
	for (const speaker of getSpeakers()) {
		const connection = getVoiceConnection(guildId, speaker.id)
		if (connection) {
			connection.destroy()
			destroyed += 1
		}
	}
	getSpeakerPool().vacateAll()
	logger.info('disconnectBot', `Destroyed ${destroyed} Speaker connection(s)`)
	return destroyed
}
