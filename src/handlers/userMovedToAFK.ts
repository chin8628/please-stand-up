import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'
import { getVoiceConnection } from '@discordjs/voice'

export const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'is moved to AFK channel')

	const voiceConnection = getVoiceConnection(prevState.guild.id)

	// skip when there is 0 member in the channel after moving to afk
	if (prevState.channel.members.size === 0) return
	// skip when there is 1 member in the channel after moving to afk, but that 1 user is bot
	if (prevState.channel.members.size === 1 && !!prevState.channel.members.get(process.env.DISCORD_APP_ID)) {
		voiceConnection.destroy()
		return
	}
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
