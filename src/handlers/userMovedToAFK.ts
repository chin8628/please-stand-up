import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'is moved to AFK channel')

	queueSpeaker(SpeakerQueueType.Afk, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})
}
