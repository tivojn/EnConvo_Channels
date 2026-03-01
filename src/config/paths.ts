import * as path from 'path';
import * as os from 'os';

export const ENCONVO_CLI_DIR = path.join(os.homedir(), '.enconvo_cli');
export const ENCONVO_CLI_CONFIG_PATH = path.join(ENCONVO_CLI_DIR, 'config.json');
