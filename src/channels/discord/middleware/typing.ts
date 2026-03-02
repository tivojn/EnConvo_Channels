import { TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { createTypingIndicator } from '../../../utils/typing-indicator';

type TypingChannel = TextChannel | DMChannel | NewsChannel;

export function startTypingIndicator(channel: TypingChannel): { stop: () => void } {
  // Discord resets typing after 10s, resend every 8s
  return createTypingIndicator(() => channel.sendTyping(), 8000);
}
