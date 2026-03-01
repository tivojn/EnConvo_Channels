import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerChannelsCommands } from '../commands/channels/index';
import { registerAgentsCommands } from '../commands/agents/index';
import { registerConfigCommands } from '../commands/config/index';
import { registerMessageCommands } from '../commands/message/index';
import { registerStatusCommand } from '../commands/status';
import { registerDoctorCommand } from '../commands/doctor';
import { registerHealthCommand } from '../commands/health';
import { registerSessionsCommand } from '../commands/sessions';
import { registerLogsCommand } from '../commands/logs';

function getCommandNames(program: Command): string[] {
  return program.commands.map((c) => c.name());
}

function getSubcommandNames(program: Command, parentName: string): string[] {
  const parent = program.commands.find((c) => c.name() === parentName);
  if (!parent) return [];
  return parent.commands.map((c) => c.name());
}

describe('CLI command registration', () => {
  let program: Command;

  it('registers all top-level commands', () => {
    program = new Command();
    program.name('enconvo').version('2.0.0');

    registerChannelsCommands(program);
    registerAgentsCommands(program);
    registerConfigCommands(program);
    registerMessageCommands(program);
    registerStatusCommand(program);
    registerDoctorCommand(program);
    registerHealthCommand(program);
    registerSessionsCommand(program);
    registerLogsCommand(program);

    const names = getCommandNames(program);
    expect(names).toContain('channels');
    expect(names).toContain('agents');
    expect(names).toContain('config');
    expect(names).toContain('message');
    expect(names).toContain('status');
    expect(names).toContain('doctor');
    expect(names).toContain('health');
    expect(names).toContain('sessions');
    expect(names).toContain('logs');
  });

  it('registers channels subcommands', () => {
    program = new Command();
    registerChannelsCommands(program);

    const subs = getSubcommandNames(program, 'channels');
    expect(subs).toContain('add');
    expect(subs).toContain('remove');
    expect(subs).toContain('list');
    expect(subs).toContain('login');
    expect(subs).toContain('logout');
    expect(subs).toContain('status');
    expect(subs).toContain('send');
  });

  it('registers agents subcommands', () => {
    program = new Command();
    registerAgentsCommands(program);

    const subs = getSubcommandNames(program, 'agents');
    expect(subs).toContain('list');
    expect(subs).toContain('add');
    expect(subs).toContain('delete');
    expect(subs).toContain('set-identity');
    expect(subs).toContain('sync');
    expect(subs).toContain('bindings');
    expect(subs).toContain('bind');
    expect(subs).toContain('unbind');
  });

  it('registers config subcommands', () => {
    program = new Command();
    registerConfigCommands(program);

    const subs = getSubcommandNames(program, 'config');
    expect(subs).toContain('get');
    expect(subs).toContain('set');
    expect(subs).toContain('unset');
    expect(subs).toContain('path');
  });

  it('registers message subcommands', () => {
    program = new Command();
    registerMessageCommands(program);

    const subs = getSubcommandNames(program, 'message');
    expect(subs).toContain('send');
    expect(subs).toContain('broadcast');
  });
});
