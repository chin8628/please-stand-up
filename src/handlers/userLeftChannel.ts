import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { disconnectBotIfAlone } from '../helpers/disconnectBotIfAlone'
import { SpeakerQueueType, queueSpeaker } from '../speakerQueue'

export const userLeftChannel = (prevState: VoiceState) => {
	logger.info(
		'leave a channel',
		JSON.stringify({
			displayName: prevState.member.displayName,
			channel: prevState.channel.name,
			membersSize: prevState.channel.members.size,
		})
	)

	// skip when channel is empty
	if (prevState.channel.members.size === 0) return

	// disconnect when only the bot remains in channel
	if (disconnectBotIfAlone(prevState)) return
	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return
	// skip AFK
	if (prevState.guild.afkChannelId === prevState.channelId) return

	queueSpeaker(SpeakerQueueType.Left, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})
}
