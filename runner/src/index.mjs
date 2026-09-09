import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const brainPath = resolve(import.meta.dirname, '..', '..');
const defaultConfigPath = join(brainPath, 'config', 'runtime.local.json');
const defaultStatePath = join(brainPath, 'runtime', 'poll-state.json');

function usage() {
  throw new Error('Usage: bootstrap --channel <id> --permalink <url> | claim --event <file> | complete --mission <id> --status <status> --summary-file <file> --delivery-state <state>');
}

function parseArguments(argumentsList) {
  const values = new Map();
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith('--')) continue;
    const value = argumentsList[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    values.set(argument.slice(2), value);
    index += 1;
  }
  return values;
}

function required(values, name) {
  const value = values.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${label} at ${filePath}: ${error.message}`);
  }
}

function writeJsonAtomically(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, filePath);
}

function loadState(statePath) {
  if (!existsSync(statePath)) return { version: 1, channels: {}, missions: {} };
  const state = readJson(statePath, 'poll state');
  if (state?.version !== 1 || typeof state.channels !== 'object' || typeof state.missions !== 'object') {
    throw new Error('Poll state has an unsupported structure');
  }
  return state;
}

function loadConfig(configPath) {
  const config = readJson(configPath, 'local runtime configuration');
  const channels = config?.slack?.permittedChannels;
  if (config?.slack?.mode !== 'computer-use' || !Array.isArray(channels) || channels.length === 0) {
    throw new Error('Local runtime configuration must define computer-use Slack channels');
  }
  return config;
}

function slackPermalinkParts(permalink) {
  const match = /\/archives\/([^/]+)\/p(\d{16})(?:$|[?#/])/.exec(permalink);
  if (!match) throw new Error('Slack permalink must contain a 16-digit message timestamp');
  return { channelId: match[1], timestamp: `${match[2].slice(0, 10)}.${match[2].slice(10)}` };
}

function timestampKey(timestamp) {
  const [seconds, fraction = ''] = timestamp.split('.');
  if (!/^\d+$/.test(seconds) || !/^\d*$/.test(fraction)) throw new Error(`Invalid Slack timestamp: ${timestamp}`);
  return `${seconds.padStart(16, '0')}.${fraction.padEnd(6, '0').slice(0, 6)}`;
}

function permittedChannel(config, channelId) {
  const matches = config.slack.permittedChannels.filter(channel => channel?.id === channelId);
  if (matches.length !== 1) throw new Error(`Channel is not explicitly permitted: ${channelId}`);
  return matches[0];
}

function missionId(channelId, timestamp) {
  const digest = createHash('sha256').update(`${channelId}:${timestamp}`).digest('hex').slice(0, 12);
  return `slack-${timestamp.replace('.', '-')}-${digest}`;
}

function dateParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const values = Object.fromEntries(formatter.formatToParts(new Date())
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return [values.year, values.month, values.day];
}

function writeMissionBundle(mission, config) {
  const [year, month, day] = dateParts();
  const directory = join(brainPath, 'missions', year, month, day, mission.id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'request.md'), `# Slack request\n\n- Channel: ${mission.channelId}\n- Message permalink: ${mission.permalink}\n- Thread permalink: ${mission.threadPermalink}\n- Sender: ${mission.senderId}\n- Reggie mention verified: yes\n\n${mission.text}\n`);
  writeJsonAtomically(join(directory, 'context.json'), {
    missionId: mission.id,
    ingress: 'computer-use',
    workspaceId: config.slack.workspaceId,
    channelId: mission.channelId,
    channelName: mission.channelName,
    messageTs: mission.messageTs,
    threadPermalink: mission.threadPermalink,
    createdAt: mission.createdAt,
  });
  writeFileSync(join(directory, 'changed-files.txt'), '');
  writeFileSync(join(directory, 'artifacts.md'), '# Artifacts\n\nNone.\n');
  return directory;
}

function bootstrap(values) {
  const configPath = resolve(values.get('config') || defaultConfigPath);
  const statePath = resolve(values.get('state') || defaultStatePath);
  const config = loadConfig(configPath);
  const channelId = required(values, 'channel');
  permittedChannel(config, channelId);
  const permalink = slackPermalinkParts(required(values, 'permalink'));
  if (permalink.channelId !== channelId) throw new Error('Bootstrap permalink does not belong to the configured channel');
  const timestamp = permalink.timestamp;
  const state = loadState(statePath);
  state.channels[channelId] = { cursor: timestamp, bootstrappedAt: new Date().toISOString() };
  writeJsonAtomically(statePath, state);
  return { action: 'bootstrapped', channelId, cursor: timestamp };
}

function claim(values) {
  const configPath = resolve(values.get('config') || defaultConfigPath);
  const statePath = resolve(values.get('state') || defaultStatePath);
  const config = loadConfig(configPath);
  const event = readJson(resolve(required(values, 'event')), 'candidate event');
  const visibleMention = `@${config.slack.agentDisplayName}`;
  if (!event?.mentionMatched || typeof event.text !== 'string' || !event.text.includes(visibleMention)) {
    throw new Error('Candidate event must contain message text and an explicit verified Reggie mention');
  }
  for (const property of ['channelId', 'permalink', 'threadPermalink', 'senderId']) {
    if (typeof event[property] !== 'string' || !event[property]) throw new Error(`Candidate event is missing ${property}`);
  }
  if (event.senderId === config.slack.agentDisplayName) {
    throw new Error('Candidate event was authored by Reggie Agent');
  }
  const channel = permittedChannel(config, event.channelId);
  const messagePermalink = slackPermalinkParts(event.permalink);
  const threadPermalink = slackPermalinkParts(event.threadPermalink);
  if (messagePermalink.channelId !== event.channelId || threadPermalink.channelId !== event.channelId) {
    throw new Error('Message and thread permalinks must belong to the permitted channel');
  }
  const messageTs = messagePermalink.timestamp;
  const state = loadState(statePath);
  const cursor = state.channels[event.channelId]?.cursor;
  if (!cursor) throw new Error(`Channel has not been bootstrapped: ${event.channelId}`);
  if (timestampKey(messageTs) <= timestampKey(cursor)) return { action: 'ignored', reason: 'already_seen', messageTs };
  const id = missionId(event.channelId, messageTs);
  if (state.missions[id]) return { action: 'ignored', reason: 'already_claimed', missionId: id };
  const mission = {
    id,
    channelId: event.channelId,
    channelName: channel.name,
    messageTs,
    permalink: event.permalink,
    threadPermalink: event.threadPermalink,
    senderId: event.senderId,
    text: event.text.trim(),
    status: 'queued',
    deliveryState: 'pending',
    createdAt: new Date().toISOString(),
  };
  const directory = writeMissionBundle(mission, config);
  state.channels[event.channelId] = { cursor: messageTs, bootstrappedAt: state.channels[event.channelId].bootstrappedAt };
  state.missions[id] = { ...mission, directory };
  writeJsonAtomically(statePath, state);
  return { action: 'claimed', missionId: id, directory };
}

function complete(values) {
  const statePath = resolve(values.get('state') || defaultStatePath);
  const state = loadState(statePath);
  const id = required(values, 'mission');
  const mission = state.missions[id];
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  const status = required(values, 'status');
  if (!['succeeded', 'failed', 'cancelled', 'awaiting_owner_input'].includes(status)) {
    throw new Error(`Unsupported terminal status: ${status}`);
  }
  const deliveryState = required(values, 'delivery-state');
  const summary = readFileSync(resolve(required(values, 'summary-file')), 'utf8').trim();
  mission.status = status;
  mission.deliveryState = deliveryState;
  mission.completedAt = new Date().toISOString();
  writeFileSync(join(mission.directory, 'result.md'), `# Terminal result\n\n- Status: ${status}\n- Slack delivery: ${deliveryState}\n- Completed: ${mission.completedAt}\n\n${summary}\n`);
  writeJsonAtomically(statePath, state);
  return { action: 'completed', missionId: id, status, deliveryState };
}

try {
  const [command, ...argumentsList] = process.argv.slice(2);
  const values = parseArguments(argumentsList);
  let result;
  if (command === 'bootstrap') result = bootstrap(values);
  else if (command === 'claim') result = claim(values);
  else if (command === 'complete') result = complete(values);
  else usage();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
