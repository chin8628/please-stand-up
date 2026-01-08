import { getVoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { getChannelId, setChannelId } from '../repository/botState'
import { QueueState, setQueueState } from '../repository/queueState'

/**
 * Disconnects the bot if it's the only member left in the channel.
 * @returns true if the bot was disconnected, false otherwise
 */
export const disconnectBotIfAlone = (prevState: VoiceState): boolean => {
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

	if (prevState.channel.members.size === 1 && getChannelId() === prevState.channelId) {
		getVoiceConnection(prevState.guild.id)?.destroy()
		logger.info('', 'Bot left the channel')

		setChannelId(null)
		setQueueState(QueueState.IDLE)

		return true
	}

	return false
}
