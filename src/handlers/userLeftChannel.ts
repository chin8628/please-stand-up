import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userLeftChannel = (prevState: VoiceState) => {
	logger.info('', prevState.member.displayName, 'lefted a channel')

	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return
	// skip when only one member in channel
	if (prevState.channel.members.size === 1) return

	queueSpeaker(SpeakerQueueType.Left, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})
}
