import { AttachmentBuilder, TextChannel, DMChannel, Message } from 'discord.js';
import { ChannelIO } from '../../../services/handler-core';
import { startTypingIndicator } from '../middleware/typing';
import { DISCORD_MAX_LENGTH } from '../../../utils/message-splitter';

export async function sendFile(
  target: Message | TextChannel | DMChannel,
  filePath: string,
): Promise<void> {
  const attachment = new AttachmentBuilder(filePath);
  if ('channel' in target && 'reply' in target) {
    await (target as Message).reply({ files: [attachment] });
  } else {
    await (target as TextChannel | DMChannel).send({ files: [attachment] });
  }
}

/** Shared ChannelIO factory for Discord — used by both message and media handlers. */
export function createDiscordIO(message: Message): ChannelIO {
  return {
    maxMessageLength: DISCORD_MAX_LENGTH,
    sendText: async (text: string) => { await message.reply(text); },
    sendFile: async (filePath: string) => { await sendFile(message, filePath); },
    startTyping: () => startTypingIndicator(message.channel as TextChannel),
  };
}
