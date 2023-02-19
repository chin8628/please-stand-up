import { joinVoiceChannel, VoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userLeftChannel = (botConnection: VoiceConnection, prevState: VoiceState) => {
	logger.info('', prevState.member.displayName, 'lefted a channel')

	// skip in limit member channel
	if (prevState.channel.userLimit != 0) return
	// skip when only one member in channel
	if (prevState.channel.members.size === 0) {
		if (botConnection) {
			botConnection.destroy()
		}
		return
	}

	if (!botConnection || prevState.channel?.id) {
		botConnection = joinVoiceChannel({
			channelId: prevState.channel.id,
			guildId: prevState.guild.id,
			adapterCreator: prevState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(botConnection, prevState.member, SpeakerQueueType.Left)
}
