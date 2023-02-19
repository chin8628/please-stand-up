import { getVoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userLeftChannel = (prevState: VoiceState) => {
	logger.info('', prevState.member.displayName, 'lefted a channel')

	const voiceConnection = getVoiceConnection(prevState.guild.id)

	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return
	// skip when only one member in channel
	if (prevState.channel.members.size === 0) {
		return
	}

	if (prevState.channel.members.size === 1 && !!prevState.channel.members.get(process.env.DISCORD_APP_ID)) {
		voiceConnection.destroy()
		return
	}

	queueSpeaker(SpeakerQueueType.Left, {
		guildId: prevState.guild.id,
		channelId: prevState.channelId,
		memberId: prevState.member.id,
		displayName: prevState.member.displayName,
		adapterCreator: prevState.guild.voiceAdapterCreator,
	})
}
