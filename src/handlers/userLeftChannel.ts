import { getVoiceConnection } from '@discordjs/voice'
import { VoiceState } from 'discord.js'
import logger from 'npmlog'
import { getChannelId, setChannelId } from '../repository/botState'
import { QueueState, setQueueState } from '../repository/queueState'
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

	// skip and disconnect when only one member in channel
	if (prevState.channel.members.size === 0) return
	// disconnect when only one member in channel with a bot
	if (prevState.channel.members.size === 1 && getChannelId() === prevState.channelId) {
		setTimeout(() => {
			getVoiceConnection(prevState.guild.id).destroy()
			logger.info('', 'Bot left the channel')

			setChannelId(null)
			setQueueState(QueueState.IDLE)
		}, 5000)

		return
	}
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
