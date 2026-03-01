import { Command } from 'commander';
import * as crypto from 'crypto';
import { listChannelInstances, loadGlobalConfig } from '../../config/store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse } from '../../services/response-parser';

export function registerMessageBroadcast(parent: Command): void {
  parent
    .command('broadcast')
    .description('Send a message to multiple targets')
    .requiredOption('--channel <channel>', 'Channel type (telegram, discord)')
    .requiredOption('--targets <ids>', 'Comma-separated chat/channel IDs')
    .requiredOption('--message <text>', 'Message text')
    .option('--name <name>', 'Instance name to use for sending')
    .option('--all-instances', 'Broadcast through all instances of the channel')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const config = loadGlobalConfig();
      const targets = opts.targets.split(',').map((t: string) => t.trim()).filter(Boolean);

      if (targets.length === 0) {
        console.error('No targets specified');
        process.exit(1);
      }

      // Resolve which instances to use
      const instances: Array<{ name: string; agent: string; token: string }> = [];

      if (opts.allInstances) {
        const allInstances = listChannelInstances(opts.channel);
        for (const [name, inst] of Object.entries(allInstances)) {
          if (inst.enabled && inst.agent) {
            instances.push({ name, agent: inst.agent, token: inst.token });
          }
        }
      } else if (opts.name) {
        const inst = listChannelInstances(opts.channel)[opts.name];
        if (!inst) {
          console.error(`Instance "${opts.name}" not found for channel "${opts.channel}"`);
          process.exit(1);
        }
        if (!inst.agent) {
          console.error(`Instance "${opts.name}" has no agent configured`);
          process.exit(1);
        }
        instances.push({ name: opts.name, agent: inst.agent, token: inst.token });
      } else {
        // Use the first enabled instance
        const allInstances = listChannelInstances(opts.channel);
        for (const [name, inst] of Object.entries(allInstances)) {
          if (inst.enabled && inst.agent) {
            instances.push({ name, agent: inst.agent, token: inst.token });
            break;
          }
        }
      }

      if (instances.length === 0) {
        console.error(`No enabled instances found for channel "${opts.channel}"`);
        process.exit(1);
      }

      const results: Array<{ target: string; instance: string; status: string; response?: string }> = [];

      for (const target of targets) {
        for (const inst of instances) {
          const sessionId = `broadcast-${opts.channel}-${target}-${crypto.randomUUID().slice(0, 8)}`;

          try {
            const response = await callEnConvo(opts.message, sessionId, inst.agent, {
              url: config.enconvo.url,
              timeoutMs: config.enconvo.timeoutMs,
            });

            const parsed = parseResponse(response);
            results.push({
              target,
              instance: inst.name,
              status: 'ok',
              response: parsed.text,
            });

            if (!opts.json) {
              console.log(`[${inst.name} → ${target}] ${parsed.text?.slice(0, 100) ?? '(empty)'}...`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ target, instance: inst.name, status: 'error', response: msg });
            if (!opts.json) {
              console.error(`[${inst.name} → ${target}] Error: ${msg}`);
            }
          }
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ broadcast: results }, null, 2));
      } else {
        const ok = results.filter(r => r.status === 'ok').length;
        const fail = results.filter(r => r.status === 'error').length;
        console.log(`\nBroadcast complete: ${ok} succeeded, ${fail} failed`);
      }
    });
}
