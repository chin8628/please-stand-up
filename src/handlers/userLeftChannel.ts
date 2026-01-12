import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { shouldBotDisconnect } from '../helpers/disconnectBotIfAlone'
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

	// Queue disconnect event if bot is the only one left (don't disconnect immediately)
	const botShouldDisconnect = shouldBotDisconnect(prevState)

	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return
	// skip AFK
	if (prevState.guild.afkChannelId === prevState.channelId) return

	// Queue the leave event first
	queueSpeaker(SpeakerQueueType.Left, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})

	// Then queue disconnect if needed (will be processed after the leave announcement)
	if (botShouldDisconnect) {
		queueSpeaker(SpeakerQueueType.Disconnect, {
			guildId: prevState.guild.id,
			channelId: prevState.channelId,
			memberId: '',
			displayName: '',
			adapterCreator: prevState.guild.voiceAdapterCreator,
		})
	}
}
