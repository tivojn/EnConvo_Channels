import { AttachmentBuilder, TextChannel, DMChannel, Message } from 'discord.js';

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
