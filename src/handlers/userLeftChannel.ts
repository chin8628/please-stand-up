import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice'
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

	if (!voiceConnection || prevState.channel?.id) {
		joinVoiceChannel({
			channelId: prevState.channel.id,
			guildId: prevState.guild.id,
			adapterCreator: prevState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(prevState.guild, prevState.member, SpeakerQueueType.Left)
}
