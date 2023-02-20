import { Client, VoiceState } from 'discord.js'

export const isPleaseStandUp = (client: Client, state: VoiceState): boolean => client.user.id === state.member?.id
