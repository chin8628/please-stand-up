import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../speakerQueue'
import logger from 'npmlog'

export const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'is moved to AFK channel')

	// skip when there is 0 member in the channel after moving to afk
	if (prevState.channel.members.size === 0) return
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
