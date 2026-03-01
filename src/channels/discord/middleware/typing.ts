import { TextChannel, DMChannel, NewsChannel } from 'discord.js';

type TypingChannel = TextChannel | DMChannel | NewsChannel;

export function startTypingIndicator(channel: TypingChannel): { stop: () => void } {
  let running = true;

  const sendTyping = async () => {
    while (running) {
      try {
        await channel.sendTyping();
      } catch {
        running = false;
        break;
      }
      // Discord resets typing after 10s, resend every 8s
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  };

  sendTyping();

  return {
    stop: () => { running = false; },
  };
}
