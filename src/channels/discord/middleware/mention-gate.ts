import { Message, Client } from 'discord.js';

/**
 * Determines whether the bot should respond to a message.
 * 1. DMs (no guild) → always respond
 * 2. Bot @mentioned → respond
 * 3. Reply to bot's message → respond
 * 4. Command prefix (!reset, !status, !help) → respond
 * 5. Otherwise → ignore
 */
export async function shouldRespond(message: Message, client: Client): Promise<boolean> {
  // DMs: always respond
  if (!message.guild) return true;

  // Bot @mentioned
  if (client.user && message.mentions.has(client.user)) return true;

  // Reply to one of the bot's messages
  if (message.reference?.messageId) {
    try {
      const referenced = await message.channel.messages.fetch(message.reference.messageId);
      if (referenced.author.id === client.user?.id) return true;
    } catch {
      // Message may have been deleted
    }
  }

  // Command prefix
  if (/^!(reset|status|help)\b/i.test(message.content)) return true;

  return false;
}
