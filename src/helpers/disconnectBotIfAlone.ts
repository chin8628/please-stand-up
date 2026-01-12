import { getVoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { getChannelId, setChannelId } from '../repository/botState'

/**
 * Checks if the bot should disconnect because it's the only member left in the channel.
 * Instead of disconnecting immediately, this now queues a disconnect event to avoid
 * race conditions with the speaker queue processor.
 * @returns true if a disconnect event should be queued, false otherwise
 */
export const shouldBotDisconnect = (prevState: VoiceState): boolean => {
	logger.info(
		'check to leave channel',
		JSON.stringify({
			botInChannel: getVoiceConnection(prevState.guild.id) ? true : false,
			channelId: getChannelId(),
			prevState: {
				memberSize: prevState.channel.members.size,
				channelId: prevState.channelId,
			},
		})
	)

	// Bot should disconnect if it's the only one left and it's in the same channel
	return prevState.channel.members.size === 1 && getChannelId() === prevState.channelId
}

/**
 * Actually disconnects the bot from the voice channel.
 * This should only be called from the queue processor.
 */
export const disconnectBot = (guildId: string): void => {
	const connection = getVoiceConnection(guildId)
	if (connection) {
		connection.destroy()
		logger.info('disconnectBot', 'Bot left the channel')
		setChannelId(null)
	} else {
		logger.info('disconnectBot', 'No voice connection to destroy')
	}
}
