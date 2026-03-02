/**
 * Strip a Telegram @username mention from text.
 * Returns trimmed result.
 */
export function stripTelegramMention(text: string, botUsername: string): string {
  return text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
}

/**
 * Strip a Discord <@userId> or <@!userId> mention from text.
 * Returns trimmed result.
 */
export function stripDiscordMention(text: string, botUserId: string): string {
  return text.replace(new RegExp(`<@!?${botUserId}>`, 'g'), '').trim();
}
