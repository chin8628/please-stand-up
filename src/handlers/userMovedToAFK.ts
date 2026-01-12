import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { shouldBotDisconnect } from '../helpers/disconnectBotIfAlone'
import { queueSpeaker, SpeakerQueueType } from '../speakerQueue'

export const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'is moved to AFK channel')

	// skip when there is 0 member in the channel after moving to afk
	if (prevState.channel.members.size === 0) return

	// Check if bot should disconnect (don't disconnect immediately)
	const botShouldDisconnect = shouldBotDisconnect(prevState)

	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return

	// Queue the AFK event first
	queueSpeaker(SpeakerQueueType.Afk, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})

	// Then queue disconnect if needed (will be processed after the AFK announcement)
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
