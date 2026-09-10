import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const brainPath = resolve(import.meta.dirname, '..', '..');
const defaultConfigPath = join(brainPath, 'config', 'runtime.local.json');
const defaultStatePath = join(brainPath, 'runtime', 'poll-state.json');

function usage() {
  throw new Error('Usage: bootstrap [--workspace <id>] --channel <id> --permalink <url> | claim --event <file> | next | start --mission <id> | resume --mission <id> --event <file> | record-update --mission <id> --phase <acknowledged|progress|plan_changed|completed> --message-id <id> --delivery-state <state> --summary-file <file> | complete --mission <id> --status <status> --summary-file <file> --delivery-state <state> | evaluate --mission <id> --event <file> --outcome <approved|revision_requested>');
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
  if (config?.slack?.mode !== 'computer-use') throw new Error('Local runtime configuration must use computer-use Slack mode');
  const configuredWorkspaces = Array.isArray(config.slack.workspaces)
    ? config.slack.workspaces
    : [{
        id: config.slack.workspaceId,
        name: config.slack.workspaceName,
        agentDisplayName: config.slack.agentDisplayName,
        agentUserId: config.slack.agentUserId,
        permittedChannels: config.slack.permittedChannels,
      }];
  if (configuredWorkspaces.length === 0) throw new Error('Local runtime configuration must define at least one Slack workspace');
  const workspaceIds = new Set();
  for (const workspace of configuredWorkspaces) {
    if (typeof workspace?.id !== 'string' || !workspace.id || typeof workspace.agentUserId !== 'string' || !workspace.agentUserId || !Array.isArray(workspace.permittedChannels) || workspace.permittedChannels.length === 0) {
      throw new Error('Every Slack workspace must define an ID, Reggie member ID, and at least one permitted channel');
    }
    if (workspaceIds.has(workspace.id)) throw new Error(`Slack workspace is configured more than once: ${workspace.id}`);
    workspaceIds.add(workspace.id);
  }
  config.slack.workspaces = configuredWorkspaces;
  return config;
}

function selectedRole(config) {
  if (typeof config?.roleId !== 'string' || !config.roleId.trim()) {
    throw new Error('Local runtime configuration must define roleId');
  }
  const lines = readFileSync(join(brainPath, 'config', 'roles.yml'), 'utf8').split('\n');
  const roles = [];
  let currentRole = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- id:')) {
      currentRole = { id: trimmed.slice('- id:'.length).trim() };
      roles.push(currentRole);
    } else if (currentRole && trimmed.startsWith('instruction_path:')) {
      currentRole.instructionPath = trimmed.slice('instruction_path:'.length).trim();
    }
  }
  const matches = roles.filter(role => role.id === config.roleId && typeof role.instructionPath === 'string');
  if (matches.length !== 1) {
    throw new Error(`roleId must match exactly one registered role: ${config.roleId}`);
  }
  return matches[0];
}

function slackPermalinkParts(permalink) {
  let url;
  try {
    url = new URL(permalink);
  } catch {
    throw new Error('Slack permalink must be a valid URL');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const archivesIndex = segments.indexOf('archives');
  const channelId = segments[archivesIndex + 1];
  const messagePart = segments[archivesIndex + 2];
  const digits = messagePart?.startsWith('p') ? messagePart.slice(1) : '';
  if (archivesIndex === -1 || !channelId || digits.length !== 16 || !isDigits(digits)) {
    throw new Error('Slack permalink must contain a 16-digit message timestamp');
  }
  return { channelId, timestamp: `${digits.slice(0, 10)}.${digits.slice(10)}` };
}

function isDigits(value) {
  if (!value) return false;
  for (const character of value) {
    if (character < '0' || character > '9') return false;
  }
  return true;
}

function timestampKey(timestamp) {
  const [seconds, fraction = ''] = timestamp.split('.');
  if (!isDigits(seconds) || (fraction && !isDigits(fraction))) throw new Error(`Invalid Slack timestamp: ${timestamp}`);
  return `${seconds.padStart(16, '0')}.${fraction.padEnd(6, '0').slice(0, 6)}`;
}

function permittedChannel(config, channelId, workspaceId) {
  if (config.slack.workspaces.length > 1 && !workspaceId) {
    throw new Error('workspaceId is required when multiple Slack workspaces are configured');
  }
  const matches = config.slack.workspaces.flatMap(workspace => {
    if (workspaceId && workspace.id !== workspaceId) return [];
    return workspace.permittedChannels
      .filter(channel => channel?.id === channelId)
      .map(channel => ({ workspace, channel }));
  });
  if (matches.length !== 1) throw new Error(`Channel is not explicitly permitted: ${channelId}`);
  return matches[0];
}

function missionId(workspaceId, channelId, timestamp) {
  const digest = createHash('sha256').update(`${workspaceId}:${channelId}:${timestamp}`).digest('hex').slice(0, 12);
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

function currentBrainSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: brainPath, encoding: 'utf8' }).trim();
}

function writeMissionBundle(mission, config) {
  const [year, month, day] = dateParts();
  const directory = join(brainPath, 'missions', year, month, day, mission.id);
  mkdirSync(directory, { recursive: true });
  const threadRootSection = mission.threadRoot
    ? `\n## Thread root request\n\n- Root permalink: ${mission.threadRoot.permalink}\n- Root sender: ${mission.threadRoot.senderId}\n\n${mission.threadRoot.text}\n`
    : '';
  writeFileSync(join(directory, 'request.md'), `# Slack request\n\n- Channel: ${mission.channelId}\n- Message permalink: ${mission.permalink}\n- Thread permalink: ${mission.threadPermalink}\n- Sender: ${mission.senderId}\n- Reggie mention verified: yes\n\n## Triggering message\n\n${mission.text}\n${threadRootSection}`);
  writeJsonAtomically(join(directory, 'context.json'), {
    missionId: mission.id,
    ingress: 'computer-use',
    brainSha: currentBrainSha(),
    roleId: mission.roleId,
    roleInstructionPath: mission.roleInstructionPath,
    workspaceId: mission.workspaceId,
    channelId: mission.channelId,
    channelName: mission.channelName,
    messageTs: mission.messageTs,
    threadPermalink: mission.threadPermalink,
    createdAt: mission.createdAt,
  });
  writeFileSync(join(directory, 'changed-files.txt'), '');
  writeFileSync(join(directory, 'artifacts.md'), '# Artifacts\n\nNone.\n');
  writeFileSync(join(directory, 'updates.md'), '# Mission updates\n');
  return directory;
}

function bootstrap(values) {
  const configPath = resolve(values.get('config') || defaultConfigPath);
  const statePath = resolve(values.get('state') || defaultStatePath);
  const config = loadConfig(configPath);
  const channelId = required(values, 'channel');
  const workspaceId = values.get('workspace');
  permittedChannel(config, channelId, workspaceId);
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
  const role = selectedRole(config);
  const event = readJson(resolve(required(values, 'event')), 'candidate event');
  if (!event?.mentionMatched || typeof event.text !== 'string' || !event.text.trim()) {
    throw new Error('Candidate event must contain message text and a verified explicit Reggie mention');
  }
  for (const property of ['channelId', 'permalink', 'threadPermalink', 'senderId', 'mentionedUserId']) {
    if (typeof event[property] !== 'string' || !event[property]) throw new Error(`Candidate event is missing ${property}`);
  }
  const permitted = permittedChannel(config, event.channelId, event.workspaceId);
  if (event.mentionedUserId !== permitted.workspace.agentUserId) {
    throw new Error('Candidate event mentions a different Slack member');
  }
  if (event.senderId === permitted.workspace.agentUserId) {
    throw new Error('Candidate event was authored by Reggie Agent');
  }
  const channel = permitted.channel;
  const messagePermalink = slackPermalinkParts(event.permalink);
  const threadPermalink = slackPermalinkParts(event.threadPermalink);
  if (messagePermalink.channelId !== event.channelId || threadPermalink.channelId !== event.channelId) {
    throw new Error('Message and thread permalinks must belong to the permitted channel');
  }
  const messageTs = messagePermalink.timestamp;
  let threadRoot = null;
  if (event.threadRoot !== undefined) {
    for (const property of ['permalink', 'senderId', 'text']) {
      if (typeof event.threadRoot?.[property] !== 'string' || !event.threadRoot[property].trim()) {
        throw new Error(`Candidate thread root is missing ${property}`);
      }
    }
    const rootPermalink = slackPermalinkParts(event.threadRoot.permalink);
    if (rootPermalink.channelId !== event.channelId || rootPermalink.timestamp !== threadPermalink.timestamp) {
      throw new Error('Candidate thread root must match the exact Slack thread permalink');
    }
    threadRoot = {
      permalink: event.threadRoot.permalink,
      senderId: event.threadRoot.senderId,
      text: event.threadRoot.text.trim(),
    };
  }
  if (messageTs !== threadPermalink.timestamp && !threadRoot) {
    throw new Error('Candidate thread reply must include its thread-root request');
  }
  const state = loadState(statePath);
  const cursor = state.channels[event.channelId]?.cursor;
  if (!cursor) throw new Error(`Channel has not been bootstrapped: ${event.channelId}`);
  if (timestampKey(messageTs) <= timestampKey(cursor)) return { action: 'ignored', reason: 'already_seen', messageTs };
  const id = missionId(permitted.workspace.id, event.channelId, messageTs);
  if (state.missions[id]) return { action: 'ignored', reason: 'already_claimed', missionId: id };
  const mission = {
    id,
    workspaceId: permitted.workspace.id,
    channelId: event.channelId,
    channelName: channel.name,
    messageTs,
    permalink: event.permalink,
    threadPermalink: event.threadPermalink,
    senderId: event.senderId,
    roleId: role.id,
    roleInstructionPath: role.instructionPath,
    text: event.text.trim(),
    threadRoot,
    status: 'queued',
    deliveryState: 'pending',
    iteration: 1,
    iterations: [{ number: 1, requestMessageTs: messageTs, state: 'queued' }],
    createdAt: new Date().toISOString(),
  };
  const directory = writeMissionBundle(mission, config);
  state.channels[event.channelId] = { cursor: messageTs, bootstrappedAt: state.channels[event.channelId].bootstrappedAt };
  state.missions[id] = { ...mission, directory };
  writeJsonAtomically(statePath, state);
  return { action: 'claimed', missionId: id, directory };
}

function next(values) {
  const statePath = resolve(values.get('state') || defaultStatePath);
  const state = loadState(statePath);
  const queued = Object.values(state.missions)
    .filter(mission => mission.status === 'queued')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return { action: 'next', missions: queued };
}

function start(values) {
  const statePath = resolve(values.get('state') || defaultStatePath);
  const state = loadState(statePath);
  const id = required(values, 'mission');
  const mission = state.missions[id];
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  if (mission.status !== 'queued') throw new Error(`Mission is not queued: ${id}`);
  mission.status = 'in_progress';
  mission.startedAt = new Date().toISOString();
  const currentIteration = mission.iterations?.find(iteration => iteration.number === mission.iteration);
  if (currentIteration) currentIteration.state = 'in_progress';
  writeJsonAtomically(statePath, state);
  return { action: 'started', missionId: id, iteration: mission.iteration };
}

function resume(values) {
  const configPath = resolve(values.get('config') || defaultConfigPath);
  const statePath = resolve(values.get('state') || defaultStatePath);
  const config = loadConfig(configPath);
  const role = selectedRole(config);
  const state = loadState(statePath);
  const id = required(values, 'mission');
  const mission = state.missions[id];
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  if (mission.status !== 'awaiting_owner_input') {
    throw new Error(`Mission is not awaiting owner input: ${id}`);
  }
  const event = readJson(resolve(required(values, 'event')), 'resume event');
  if (!event?.mentionMatched || typeof event.text !== 'string' || !event.text.trim()) {
    throw new Error('Resume event must contain message text and a verified explicit Reggie mention');
  }
  for (const property of ['channelId', 'permalink', 'threadPermalink', 'senderId', 'mentionedUserId']) {
    if (typeof event[property] !== 'string' || !event[property]) throw new Error(`Resume event is missing ${property}`);
  }
  if (event.channelId !== mission.channelId || event.senderId !== mission.senderId) {
    throw new Error('Resume event must come from the original requester in the mission channel');
  }
  const permitted = permittedChannel(config, event.channelId, event.workspaceId || mission.workspaceId);
  if (mission.workspaceId && permitted.workspace.id !== mission.workspaceId) throw new Error('Resume event must come from the original mission workspace');
  if (event.mentionedUserId !== permitted.workspace.agentUserId || event.senderId === permitted.workspace.agentUserId) {
    throw new Error('Resume event must be an explicit mention from another sender');
  }
  const messagePermalink = slackPermalinkParts(event.permalink);
  const threadPermalink = slackPermalinkParts(event.threadPermalink);
  const missionThread = slackPermalinkParts(mission.threadPermalink);
  if (messagePermalink.channelId !== mission.channelId || threadPermalink.channelId !== missionThread.channelId || threadPermalink.timestamp !== missionThread.timestamp) {
    throw new Error('Resume event must be in the original mission thread');
  }
  if (timestampKey(messagePermalink.timestamp) <= timestampKey(mission.messageTs)) {
    throw new Error('Resume event must be newer than the mission trigger');
  }

  const resumedAt = new Date().toISOString();
  const nextIteration = (mission.iteration || 1) + 1;
  mission.roleId = role.id;
  mission.roleInstructionPath = role.instructionPath;
  mission.status = 'queued';
  mission.iteration = nextIteration;
  mission.lastFeedbackTs = messagePermalink.timestamp;
  mission.iterations = mission.iterations || [];
  mission.iterations.push({ number: nextIteration, feedbackMessageTs: messagePermalink.timestamp, state: 'queued' });
  mission.resumptions = mission.resumptions || [];
  mission.resumptions.push({ messageTs: messagePermalink.timestamp, roleId: role.id, resumedAt });
  writeFileSync(join(mission.directory, `iteration-${nextIteration}-feedback.md`), `# Owner input\n\n- Message permalink: ${event.permalink}\n- Resumed role: ${role.id}\n- Resumed: ${resumedAt}\n\n${event.text.trim()}\n`);

  const contextPath = join(mission.directory, 'context.json');
  const context = readJson(contextPath, 'mission context');
  context.roleId = role.id;
  context.roleInstructionPath = role.instructionPath;
  context.resumedAt = resumedAt;
  writeJsonAtomically(contextPath, context);

  const cursor = state.channels[mission.channelId]?.cursor;
  if (!cursor || timestampKey(messagePermalink.timestamp) > timestampKey(cursor)) {
    state.channels[mission.channelId] = { cursor: messagePermalink.timestamp, bootstrappedAt: state.channels[mission.channelId]?.bootstrappedAt };
  }
  writeJsonAtomically(statePath, state);
  return { action: 'resumed', missionId: id, iteration: nextIteration, roleId: role.id };
}

function recordUpdate(values) {
  const statePath = resolve(values.get('state') || defaultStatePath);
  const state = loadState(statePath);
  const id = required(values, 'mission');
  const mission = state.missions[id];
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  const phase = required(values, 'phase');
  if (!['acknowledged', 'progress', 'plan_changed', 'completed'].includes(phase)) {
    throw new Error(`Unsupported update phase: ${phase}`);
  }
  const messageId = required(values, 'message-id');
  const deliveryState = required(values, 'delivery-state');
  const summary = readFileSync(resolve(required(values, 'summary-file')), 'utf8').trim();
  const recordedAt = new Date().toISOString();
  const update = { phase, messageId, deliveryState, recordedAt };
  mission.updates = mission.updates || [];
  mission.updates.push(update);
  appendFileSync(join(mission.directory, 'updates.md'), `\n## ${phase}\n\n- Slack message: ${messageId}\n- Delivery: ${deliveryState}\n- Recorded: ${recordedAt}\n\n${summary}\n`);
  writeJsonAtomically(statePath, state);
  return { action: 'update_recorded', missionId: id, phase, messageId, deliveryState };
}

function complete(values) {
  const statePath = resolve(values.get('state') || defaultStatePath);
  const state = loadState(statePath);
  const id = required(values, 'mission');
  const mission = state.missions[id];
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  if (mission.status !== 'in_progress') throw new Error(`Mission is not in progress: ${id}`);
  const status = required(values, 'status');
  if (!['awaiting_evaluation', 'failed', 'cancelled', 'awaiting_owner_input'].includes(status)) {
    throw new Error(`Unsupported terminal status: ${status}`);
  }
  const deliveryState = required(values, 'delivery-state');
  const summary = readFileSync(resolve(required(values, 'summary-file')), 'utf8').trim();
  mission.status = status;
  mission.deliveryState = deliveryState;
  mission.completedAt = new Date().toISOString();
  const currentIteration = mission.iterations?.find(iteration => iteration.number === mission.iteration);
  if (currentIteration) currentIteration.state = status;
  if (status === 'awaiting_evaluation') mission.evaluationRequestedAt = mission.completedAt;
  writeFileSync(join(mission.directory, 'result.md'), `# Execution result\n\n- Status: ${status}\n- Slack delivery: ${deliveryState}\n- Completed: ${mission.completedAt}\n\n${summary}\n`);
  writeJsonAtomically(statePath, state);
  return { action: 'completed', missionId: id, status, deliveryState };
}

function evaluate(values) {
  const configPath = resolve(values.get('config') || defaultConfigPath);
  const statePath = resolve(values.get('state') || defaultStatePath);
  const config = loadConfig(configPath);
  const state = loadState(statePath);
  const id = required(values, 'mission');
  const mission = state.missions[id];
  if (!mission) throw new Error(`Unknown mission: ${id}`);
  if (mission.status !== 'awaiting_evaluation') throw new Error(`Mission is not awaiting evaluation: ${id}`);
  const outcome = required(values, 'outcome');
  if (!['approved', 'revision_requested'].includes(outcome)) throw new Error(`Unsupported evaluation outcome: ${outcome}`);
  const event = readJson(resolve(required(values, 'event')), 'evaluation event');
  if (!event?.mentionMatched || typeof event.text !== 'string' || !event.text.trim()) {
    throw new Error('Evaluation event must contain message text and a verified explicit Reggie mention');
  }
  for (const property of ['channelId', 'permalink', 'threadPermalink', 'senderId', 'mentionedUserId']) {
    if (typeof event[property] !== 'string' || !event[property]) throw new Error(`Evaluation event is missing ${property}`);
  }
  if (event.channelId !== mission.channelId || event.senderId !== mission.senderId) throw new Error('Evaluation must come from the original requester in the mission channel');
  const permitted = permittedChannel(config, event.channelId, event.workspaceId || mission.workspaceId);
  if (mission.workspaceId && permitted.workspace.id !== mission.workspaceId) throw new Error('Evaluation must come from the original mission workspace');
  if (event.mentionedUserId !== permitted.workspace.agentUserId) throw new Error('Evaluation mentions a different Slack member');
  if (event.senderId === permitted.workspace.agentUserId) throw new Error('Evaluation event was authored by Reggie Agent');
  const messagePermalink = slackPermalinkParts(event.permalink);
  const threadPermalink = slackPermalinkParts(event.threadPermalink);
  const missionThread = slackPermalinkParts(mission.threadPermalink);
  if (messagePermalink.channelId !== mission.channelId || threadPermalink.channelId !== missionThread.channelId || threadPermalink.timestamp !== missionThread.timestamp) {
    throw new Error('Evaluation must be in the original mission thread');
  }
  const previousMessageTs = mission.lastFeedbackTs || mission.messageTs;
  if (timestampKey(messagePermalink.timestamp) <= timestampKey(previousMessageTs)) {
    throw new Error('Evaluation must be newer than the previous mission message');
  }
  const evaluatedAt = new Date().toISOString();
  mission.lastFeedbackTs = messagePermalink.timestamp;
  const currentIteration = mission.iteration || 1;
  const evaluation = { iteration: currentIteration, outcome, messageTs: messagePermalink.timestamp, senderId: event.senderId, evaluatedAt };
  mission.evaluation = evaluation;
  mission.evaluations = mission.evaluations || [];
  mission.evaluations.push(evaluation);
  writeFileSync(join(mission.directory, `iteration-${currentIteration}-evaluation.md`), `# User evaluation\n\n- Iteration: ${currentIteration}\n- Outcome: ${outcome}\n- Message permalink: ${event.permalink}\n- Evaluated: ${evaluatedAt}\n\n${event.text.trim()}\n`);
  const activeIteration = mission.iterations?.find(iteration => iteration.number === currentIteration);
  if (activeIteration) activeIteration.state = outcome;
  if (outcome === 'approved') {
    mission.status = 'succeeded';
    mission.completedAt = evaluatedAt;
  } else {
    const nextIteration = (mission.iteration || 1) + 1;
    mission.iteration = nextIteration;
    mission.status = 'queued';
    mission.iterations = mission.iterations || [];
    mission.iterations.push({ number: nextIteration, feedbackMessageTs: messagePermalink.timestamp, state: 'queued' });
    writeFileSync(join(mission.directory, `iteration-${nextIteration}-feedback.md`), `# Revision feedback\n\n${event.text.trim()}\n`);
  }
  const cursor = state.channels[mission.channelId]?.cursor;
  if (!cursor || timestampKey(messagePermalink.timestamp) > timestampKey(cursor)) {
    state.channels[mission.channelId] = { cursor: messagePermalink.timestamp, bootstrappedAt: state.channels[mission.channelId]?.bootstrappedAt };
  }
  writeJsonAtomically(statePath, state);
  return { action: outcome === 'approved' ? 'approved' : 'revision_queued', missionId: id, iteration: mission.iteration };
}

try {
  const [command, ...argumentsList] = process.argv.slice(2);
  const values = parseArguments(argumentsList);
  let result;
  if (command === 'bootstrap') result = bootstrap(values);
  else if (command === 'claim') result = claim(values);
  else if (command === 'next') result = next(values);
  else if (command === 'start') result = start(values);
  else if (command === 'resume') result = resume(values);
  else if (command === 'record-update') result = recordUpdate(values);
  else if (command === 'complete') result = complete(values);
  else if (command === 'evaluate') result = evaluate(values);
  else usage();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
