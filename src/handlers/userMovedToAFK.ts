import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import { queueSpeaker, SpeakerQueueType } from '../SpeakerQueue'
import logger from 'npmlog'

export const userMovedToAFKHandler = (prevState: VoiceState, newState: VoiceState) => {
	logger.info('', newState.member.displayName, 'is moved to AFK channel')

	const voiceConnection = getVoiceConnection(newState.guild.id)

	if (!voiceConnection || prevState.channel?.id) {
		joinVoiceChannel({
			channelId: prevState.channel.id,
			guildId: prevState.guild.id,
			adapterCreator: prevState.guild.voiceAdapterCreator,
			selfMute: false,
			selfDeaf: false,
		})
	}

	queueSpeaker(prevState.guild, newState.member, SpeakerQueueType.Afk)
}
