import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userJoinChannel = (newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'joined a channel')

	// skip when only one member in channel
	// if (newState.channel.members.size === 1) return
	// skip in limit member channel
	if (newState.channel.userLimit != 0) return
	// skip when try to join afk channel
	if (newState.guild.afkChannelId === newState.channelId) return

	queueSpeaker(SpeakerQueueType.Join, {
		guildId: newState.guild.id,
		channelId: newState.channelId,
		memberId: newState.member.id,
		displayName: newState.member.displayName,
		adapterCreator: newState.guild.voiceAdapterCreator,
	})
}
