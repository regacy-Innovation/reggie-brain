import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { App, LogLevel } from '@slack/bolt';
import { parse } from 'yaml';

type RegisteredProject = {
  id: string;
  local_path: string;
  origin: string;
  upstream_branch: string;
  development_push_branch: string;
  main_is_development_only: boolean;
};

type RegisteredRole = {
  id: string;
  instruction_path: string;
};

type Mission = {
  id: string;
  channelId: string;
  messageTs: string;
  threadTs: string;
  senderId: string;
  requestText: string;
  roleId: string;
  roleInstructionPath: string;
  projectId: string;
  brainSha: string;
};

const listenerDirectory = dirname(fileURLToPath(import.meta.url));
const defaultBrainPath = resolve(listenerDirectory, '..', '..');
dotenv.config({ path: join(defaultBrainPath, '.env') });
dotenv.config({ path: join(defaultBrainPath, 'listener', '.env') });

const brainPath = resolve(process.env.REGGIE_BRAIN_PATH || defaultBrainPath);
const permittedChannelId = requiredEnvironment('PERMITTED_SLACK_CHANNEL_ID');
const configuredRoleId = requiredEnvironment('REGGIE_ROLE');
const codexBin = process.env.CODEX_BIN || 'codex';
const stateRoot = resolve(process.env.REGGIE_STATE_ROOT || join(brainPath, 'runtime'));
const worktreeRoot = resolve(process.env.REGGIE_WORKTREE_ROOT || join(brainPath, 'worktrees'));
const projectCloneRoot = process.env.REGGIE_PROJECT_CLONE_ROOT?.trim()
  ? resolve(process.env.REGGIE_PROJECT_CLONE_ROOT)
  : null;

mkdirSync(stateRoot, { recursive: true });
mkdirSync(worktreeRoot, { recursive: true });

const database = new DatabaseSync(join(stateRoot, 'missions.sqlite'));
database.exec(`
  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    event_key TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL,
    message_ts TEXT NOT NULL,
    thread_ts TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    request_text TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_instruction_path TEXT NOT NULL,
    project_id TEXT NOT NULL,
    brain_sha TEXT NOT NULL,
    status TEXT NOT NULL,
    result_text TEXT,
    error_text TEXT,
    slack_delivery_state TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
  );
`);

const missionColumns = database.prepare('PRAGMA table_info(missions)').all() as Array<{ name: string }>;
if (!missionColumns.some(column => column.name === 'slack_delivery_state')) {
  database.exec("ALTER TABLE missions ADD COLUMN slack_delivery_state TEXT NOT NULL DEFAULT 'pending'");
}

const insertMission = database.prepare(`
  INSERT OR IGNORE INTO missions (
    id, event_key, channel_id, message_ts, thread_ts, sender_id, request_text,
    role_id, role_instruction_path, project_id, brain_sha, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)
`);

const app = new App({
  token: requiredEnvironment('SLACK_BOT_TOKEN'),
  appToken: requiredEnvironment('SLACK_APP_TOKEN'),
  signingSecret: requiredEnvironment('SLACK_SIGNING_SECRET'),
  socketMode: true,
  logLevel: LogLevel.INFO,
});

let isRunningMission = false;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function utcNow(): string {
  return new Date().toISOString();
}

function missionDateParts(): [string, string, string] {
  const isoDate = new Date().toISOString().slice(0, 10);
  return [isoDate.slice(0, 4), isoDate.slice(5, 7), isoDate.slice(8, 10)];
}

function loadProjects(): RegisteredProject[] {
  const value = parse(readFileSync(join(brainPath, 'config', 'projects.yml'), 'utf8')) as { projects?: RegisteredProject[] };
  if (!Array.isArray(value.projects)) throw new Error('config/projects.yml has no projects list');
  return value.projects;
}

function loadRoles(): RegisteredRole[] {
  const value = parse(readFileSync(join(brainPath, 'config', 'roles.yml'), 'utf8')) as { roles?: RegisteredRole[] };
  if (!Array.isArray(value.roles)) throw new Error('config/roles.yml has no roles list');
  return value.roles;
}

function selectedProject(projectId: string): RegisteredProject {
  const matches = loadProjects().filter(project => project.id === projectId);
  if (matches.length !== 1) throw new Error(`Project must match exactly one registered project: ${projectId}`);
  return matches[0];
}

function selectedRole(): RegisteredRole {
  const matches = loadRoles().filter(role => role.id === configuredRoleId);
  if (matches.length !== 1) throw new Error(`REGGIE_ROLE must match exactly one registered role: ${configuredRoleId}`);
  return matches[0];
}

function localProjectPath(project: RegisteredProject): string {
  return projectCloneRoot ? join(projectCloneRoot, project.id) : resolve(project.local_path);
}

function runCommand(command: string, argumentsList: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data.toString(); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.once('error', rejectPromise);
    child.once('close', code => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else rejectPromise(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function currentBrainSha(): Promise<string> {
  const result = await runCommand('git', ['rev-parse', 'HEAD'], brainPath);
  return result.stdout.trim();
}

async function assertCleanBrain(): Promise<void> {
  const result = await runCommand('git', ['status', '--porcelain'], brainPath);
  if (result.stdout.trim()) throw new Error('Reggie brain has local changes; commit or remove them before starting a mission');
}

async function syncBrain(): Promise<string> {
  await assertCleanBrain();
  const branch = await runCommand('git', ['branch', '--show-current'], brainPath);
  const branchName = branch.stdout.trim();
  if (!branchName) throw new Error('Reggie brain is not on a branch');
  if (branchName !== 'main') throw new Error(`Reggie brain must run on main, found ${branchName}`);
  await runCommand('git', ['fetch', 'origin', branchName], brainPath);
  await runCommand('git', ['merge', '--ff-only', `origin/${branchName}`], brainPath);
  return currentBrainSha();
}

function eventKey(channelId: string, messageTs: string): string {
  return createHash('sha256').update(`${channelId}:${messageTs}`).digest('hex');
}

function stripBotMention(text: string, botUserId: string): string {
  return text.replace(`<@${botUserId}>`, '').trim();
}

function parseProjectRequest(text: string): { projectId: string; requestText: string } | null {
  const separator = text.indexOf(' ');
  const projectToken = separator === -1 ? text : text.slice(0, separator);
  if (!projectToken.startsWith('project=')) return null;
  const projectId = projectToken.slice('project='.length).trim();
  const requestText = separator === -1 ? '' : text.slice(separator + 1).trim();
  if (!projectId || !requestText) return null;
  return { projectId, requestText };
}

function enqueueMission(mission: Mission): boolean {
  const result = insertMission.run(
    mission.id,
    eventKey(mission.channelId, mission.messageTs),
    mission.channelId,
    mission.messageTs,
    mission.threadTs,
    mission.senderId,
    mission.requestText,
    mission.roleId,
    mission.roleInstructionPath,
    mission.projectId,
    mission.brainSha,
    utcNow(),
  );
  return result.changes === 1;
}

function claimNextMission(): Mission | null {
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = database.prepare(`
      SELECT id, channel_id, message_ts, thread_ts, sender_id, request_text,
             role_id, role_instruction_path, project_id, brain_sha
      FROM missions
      WHERE status = 'queued'
      ORDER BY created_at
      LIMIT 1
    `).get() as Record<string, string> | undefined;
    if (!row) {
      database.exec('COMMIT');
      return null;
    }
    database.prepare(`UPDATE missions SET status = 'running', started_at = ? WHERE id = ?`).run(utcNow(), row.id);
    database.exec('COMMIT');
    return {
      id: row.id,
      channelId: row.channel_id,
      messageTs: row.message_ts,
      threadTs: row.thread_ts,
      senderId: row.sender_id,
      requestText: row.request_text,
      roleId: row.role_id,
      roleInstructionPath: row.role_instruction_path,
      projectId: row.project_id,
      brainSha: row.brain_sha,
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function terminalizeMission(id: string, status: 'succeeded' | 'failed', resultText: string, errorText?: string): void {
  database.prepare(`
    UPDATE missions
    SET status = ?, result_text = ?, error_text = ?, completed_at = ?
    WHERE id = ?
  `).run(status, resultText, errorText || null, utcNow(), id);
}

function setSlackDeliveryState(id: string, state: 'delivered' | 'failed'): void {
  database.prepare(`UPDATE missions SET slack_delivery_state = ? WHERE id = ?`).run(state, id);
}

async function createWorktree(mission: Mission, project: RegisteredProject): Promise<{ path: string; branch: string; startingRevision: string }> {
  const worktreePath = join(worktreeRoot, mission.id, project.id);
  const branch = `reggie/${mission.id}`;
  const clonePath = localProjectPath(project);
  mkdirSync(dirname(worktreePath), { recursive: true });
  const configuredOrigin = await runCommand('git', ['config', '--get', 'remote.origin.url'], clonePath);
  if (configuredOrigin.stdout.trim() !== project.origin) {
    throw new Error(`Registered origin does not match local clone for ${project.id}`);
  }
  await runCommand('git', ['fetch', 'origin', project.upstream_branch], clonePath);
  const revision = await runCommand('git', ['rev-parse', `origin/${project.upstream_branch}`], clonePath);
  await runCommand('git', ['worktree', 'add', '-b', branch, worktreePath, `origin/${project.upstream_branch}`], clonePath);
  return { path: worktreePath, branch, startingRevision: revision.stdout.trim() };
}

function missionDirectory(missionId: string): string {
  const [year, month, day] = missionDateParts();
  return join(brainPath, 'missions', year, month, day, missionId);
}

async function changedFiles(worktree: { path: string; startingRevision: string } | undefined): Promise<string[]> {
  if (!worktree) return [];
  const committed = await runCommand('git', ['diff', '--name-only', worktree.startingRevision], worktree.path);
  const untracked = await runCommand('git', ['ls-files', '--others', '--exclude-standard'], worktree.path);
  return [...new Set([...committed.stdout.split('\n'), ...untracked.stdout.split('\n')].map(value => value.trim()).filter(Boolean))];
}

function writeMissionBundle(mission: Mission, project: RegisteredProject, worktree: { path: string; branch: string; startingRevision: string } | undefined, status: string, result: string, files: string[]): string {
  const directory = missionDirectory(mission.id);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'request.md'), `${mission.requestText}\n`, 'utf8');
  writeFileSync(join(directory, 'context.json'), `${JSON.stringify({
    missionId: mission.id,
    channelId: mission.channelId,
    messageTs: mission.messageTs,
    threadTs: mission.threadTs,
    senderId: mission.senderId,
    brainSha: mission.brainSha,
    roleId: mission.roleId,
    roleInstructionPath: mission.roleInstructionPath,
    projectId: project.id,
    projectOrigin: project.origin,
    startingRevision: worktree?.startingRevision || null,
    worktreePath: worktree?.path || null,
    worktreeBranch: worktree?.branch || null,
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(directory, 'result.md'), `Status: ${status}\n\n${result}\n`, 'utf8');
  writeFileSync(join(directory, 'changed-files.txt'), files.length ? `${files.join('\n')}\n` : '', 'utf8');
  writeFileSync(join(directory, 'artifacts.md'), 'No local binary artifacts were recorded.\n', 'utf8');
  return directory;
}

async function publishMissionBundle(directory: string, missionId: string): Promise<string> {
  const pathInBrain = relative(brainPath, directory);
  await runCommand('git', ['add', '--', pathInBrain], brainPath);
  await runCommand('git', ['commit', '--only', '-m', `Record Reggie mission ${missionId}`, '--', pathInBrain], brainPath);
  await runCommand('git', ['push', 'origin', 'main'], brainPath);
  return currentBrainSha();
}

function codexPrompt(mission: Mission, project: RegisteredProject, worktree: { path: string; branch: string; startingRevision: string }): string {
  return [
    `Mission ID: ${mission.id}`,
    `Reggie brain: ${brainPath} at ${mission.brainSha}`,
    `Role: ${mission.roleId} (${mission.roleInstructionPath})`,
    `Registered project: ${project.id}`,
    `Project origin: ${project.origin}`,
    `Starting revision: ${worktree.startingRevision}`,
    `Development push branch: ${project.development_push_branch}`,
    `Worktree branch: ${worktree.branch}`,
    '',
    'Read the shared Reggie brain instructions, contracts, policies, and selected role instructions at the paths above before acting.',
    'Work only in this mission worktree. Follow the project instructions. Do not deploy to production. Reply in the language of the Slack request.',
    'Do not post to Slack; the local listener will report the terminal result.',
    '',
    'Slack request:',
    mission.requestText,
  ].join('\n');
}

function runCodex(mission: Mission, project: RegisteredProject, worktree: { path: string; branch: string; startingRevision: string }, resultPath: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(codexBin, [
      'exec',
      '-C', worktree.path,
      '--sandbox', 'workspace-write',
      '--output-last-message', resultPath,
      '--add-dir', brainPath,
      '-',
    ], {
      cwd: worktree.path,
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe'],
      env: { ...process.env, REGGIE_ROLE: mission.roleId },
    });
    let stderr = '';
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.once('error', rejectPromise);
    child.once('close', code => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`Codex exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(codexPrompt(mission, project, worktree));
  });
}

function boundedSlackText(text: string): string {
  return text.length <= 3_900 ? text : `${text.slice(0, 3_850)}\n\n[Result truncated in Slack; see mission record.]`;
}

async function executeMission(mission: Mission): Promise<void> {
  const project = selectedProject(mission.projectId);
  let worktree: { path: string; branch: string; startingRevision: string } | undefined;
  let result = '';
  let status: 'succeeded' | 'failed' = 'failed';
  let errorText: string | undefined;
  try {
    if (await currentBrainSha() !== mission.brainSha) throw new Error('Reggie brain revision changed after this mission was queued');
    worktree = await createWorktree(mission, project);
    const resultPath = join(stateRoot, `${mission.id}.last-message.md`);
    await runCodex(mission, project, worktree, resultPath);
    result = readFileSync(resultPath, 'utf8').trim() || 'Codex completed without a terminal message.';
    status = 'succeeded';
  } catch (error) {
    errorText = error instanceof Error ? error.message : String(error);
    result = `Mission failed before completion: ${errorText}`;
  }

  const files = await changedFiles(worktree).catch(() => []);
  const directory = writeMissionBundle(mission, project, worktree, status, result, files);
  try {
    await publishMissionBundle(directory, mission.id);
  } catch (error) {
    const publicationError = error instanceof Error ? error.message : String(error);
    status = 'failed';
    errorText = `Mission record publication failed: ${publicationError}`;
    result = `${result}\n\n${errorText}`;
    writeFileSync(join(directory, 'result.md'), `Status: ${status}\n\n${result}\n`, 'utf8');
  }
  terminalizeMission(mission.id, status, result, errorText);
  try {
    await app.client.chat.postMessage({
      channel: mission.channelId,
      thread_ts: mission.threadTs,
      text: boundedSlackText(result),
    });
    setSlackDeliveryState(mission.id, 'delivered');
  } catch (error) {
    setSlackDeliveryState(mission.id, 'failed');
    console.error(`[reggie-local-listener] Slack delivery failed for ${mission.id}:`, error);
  }
}

async function drainQueue(): Promise<void> {
  if (isRunningMission) return;
  isRunningMission = true;
  try {
    for (;;) {
      const mission = claimNextMission();
      if (!mission) return;
      await executeMission(mission);
    }
  } finally {
    isRunningMission = false;
  }
}

app.event('app_mention', async ({ event }) => {
  if (!event.channel || !event.ts || !event.user || event.bot_id) return;
  if (event.channel !== permittedChannelId) return;
  const auth = await app.client.auth.test();
  const botUserId = auth.user_id;
  if (!botUserId || !event.text.includes(`<@${botUserId}>`)) return;
  const requestText = stripBotMention(event.text, botUserId);
  if (!requestText) return;
  const parsedRequest = parseProjectRequest(requestText);
  if (!parsedRequest) {
    await app.client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts || event.ts,
      text: 'Start a coding request with `project=<registered-project-id>` followed by the request.',
    });
    return;
  }

  const brainSha = await syncBrain();
  const role = selectedRole();
  const project = selectedProject(parsedRequest.projectId);
  const mission: Mission = {
    id: randomUUID(),
    channelId: event.channel,
    messageTs: event.ts,
    threadTs: event.thread_ts || event.ts,
    senderId: event.user,
    requestText: parsedRequest.requestText,
    roleId: role.id,
    roleInstructionPath: role.instruction_path,
    projectId: project.id,
    brainSha,
  };
  if (enqueueMission(mission)) void drainQueue();
});

async function start(): Promise<void> {
  await app.start();
  console.log(`[reggie-local-listener] Socket Mode connected for ${permittedChannelId}`);
  await drainQueue();
}

void start();
