import { Command } from 'commander';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { listAdapterNames } from '../../channels/registry';
import { listChannelInstances } from '../../config/store';
import { buildServiceLabel, buildLogPaths } from '../../channels/shared/adapter-helpers';

/**
 * Sync source to the mirror directory used by run.sh.
 * Ensures deployed services always run the latest code.
 */
function syncMirror(runShPath: string): void {
  const runShDir = path.dirname(runShPath);
  const sourceDir = path.resolve(runShDir, '..');
  const mirrorDir = path.join(os.homedir(), '.local/share/enconvo-telegram-adapter');

  try {
    execSync(
      `rsync -a --delete --exclude .git --exclude .claude "${sourceDir}/" "${mirrorDir}/"`,
      { stdio: 'pipe' },
    );
  } catch {
    // Non-fatal — run.sh will rsync on startup anyway
  }
}

const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library/LaunchAgents');

/**
 * Generate a launchd plist for a channel instance.
 */
export function generatePlist(
  channel: string,
  instanceName: string,
  runShPath: string,
): string {
  const label = buildServiceLabel(channel, instanceName);
  const logs = buildLogPaths(channel, instanceName);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${runShPath}</string>
        <string>channels</string>
        <string>login</string>
        <string>--channel</string>
        <string>${channel}</string>
        <string>--name</string>
        <string>${instanceName}</string>
        <string>-f</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>NetworkState</key>
        <true/>
    </dict>

    <key>StandardOutPath</key>
    <string>${logs.stdout}</string>

    <key>StandardErrorPath</key>
    <string>${logs.stderr}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>`;
}

export function registerDeploy(parent: Command): void {
  parent
    .command('deploy')
    .description('Generate and install launchd plists for channel instances')
    .option('--channel <name>', 'Deploy only a specific channel type')
    .option('--name <name>', 'Deploy only a specific instance')
    .option('--uninstall', 'Remove plists and unload services')
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (opts) => {
      const channelNames = opts.channel ? [opts.channel] : listAdapterNames();
      const runShPath = path.resolve(__dirname, '../../../scripts/run.sh');

      if (!fs.existsSync(runShPath)) {
        console.error(`run.sh not found at: ${runShPath}`);
        process.exit(1);
      }

      // Sync latest code to mirror before deploying
      if (!opts.dryRun && !opts.uninstall) {
        syncMirror(runShPath);
      }

      fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

      let count = 0;

      for (const channelName of channelNames) {
        const instances = listChannelInstances(channelName);
        const instanceNames = opts.name ? [opts.name] : Object.keys(instances);

        for (const instName of instanceNames) {
          const instConfig = instances[instName];
          if (!instConfig) {
            console.warn(`  Instance "${instName}" not found for channel "${channelName}", skipping`);
            continue;
          }

          if (!instConfig.enabled && !opts.uninstall) {
            console.log(`  ${channelName}/${instName}: disabled, skipping`);
            continue;
          }

          const label = buildServiceLabel(channelName, instName);
          const plistPath = path.join(LAUNCH_AGENTS_DIR, `${label}.plist`);

          if (opts.uninstall) {
            if (opts.dryRun) {
              console.log(`  [dry-run] Would uninstall: ${plistPath}`);
              count++;
              continue;
            }
            try {
              execSync(`launchctl bootout gui/${process.getuid?.()} ${plistPath} 2>/dev/null`, { stdio: 'pipe' });
            } catch {
              // Service may not be loaded
            }
            if (fs.existsSync(plistPath)) {
              fs.unlinkSync(plistPath);
              console.log(`  Removed: ${plistPath}`);
            } else {
              console.log(`  ${channelName}/${instName}: no plist found`);
            }
            count++;
            continue;
          }

          const plistContent = generatePlist(channelName, instName, runShPath);

          if (opts.dryRun) {
            console.log(`  [dry-run] Would write: ${plistPath}`);
            count++;
            continue;
          }

          // Unload existing service if present
          try {
            execSync(`launchctl bootout gui/${process.getuid?.()} ${plistPath} 2>/dev/null`, { stdio: 'pipe' });
          } catch {
            // Not loaded
          }

          fs.writeFileSync(plistPath, plistContent);
          console.log(`  Installed: ${plistPath}`);

          // Load the service
          try {
            execSync(`launchctl bootstrap gui/${process.getuid?.()} ${plistPath}`, { stdio: 'pipe' });
            console.log(`  Loaded: ${label}`);
          } catch (err) {
            console.warn(`  Warning: could not load ${label}: ${err}`);
          }

          count++;
        }
      }

      if (count === 0) {
        console.log('No instances found to deploy. Run: enconvo channels add');
      } else {
        const action = opts.uninstall ? 'uninstalled' : 'deployed';
        console.log(`\n${count} instance(s) ${action}.`);
      }
    });
}
