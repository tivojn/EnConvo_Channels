#!/usr/bin/env -S npx tsx
import { Command } from 'commander';
import { registerChannelsCommands } from './commands/channels/index';
import { registerAgentsCommands } from './commands/agents/index';

const program = new Command();

program
  .name('enconvo')
  .description('EnConvo CLI — manage channels, agents, and more')
  .version('2.0.0');

registerChannelsCommands(program);
registerAgentsCommands(program);

program.parse();
