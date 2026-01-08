import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { disconnectBotIfAlone } from '../helpers/disconnectBotIfAlone'
import { queueSpeaker, SpeakerQueueType } from '../speakerQueue'

export const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'is moved to AFK channel')

	// skip when there is 0 member in the channel after moving to afk
	if (prevState.channel.members.size === 0) return

	// disconnect when only the bot remains in channel
	if (disconnectBotIfAlone(prevState)) return
	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return

	queueSpeaker(SpeakerQueueType.Afk, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})
}
