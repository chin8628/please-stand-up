import { joinVoiceChannel, VoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userJoinChannel = (botConnection: VoiceConnection, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'joined a channel')

	// skip when only one member in channel
	if (newState.channel.members.size === 1) return
	// skip in limit member channel
	if (newState.channel.userLimit != 0) return
	// skip when try to join afk channel
	if (newState.guild.afkChannelId === newState.channelId) return
	// skip & disconnect from channel when no one else
	if (newState.channel.members.size === 0) {
		if (botConnection) {
			botConnection.destroy()
		}
		return
	}

	if (!botConnection || newState.channel?.id) {
		botConnection = joinVoiceChannel({
			channelId: newState.channel.id,
			guildId: newState.guild.id,
			adapterCreator: newState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(botConnection, newState.member, SpeakerQueueType.Join)
}
