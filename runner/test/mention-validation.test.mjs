import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const runnerPath = resolve(import.meta.dirname, '..', 'src', 'index.mjs');
const agentUserId = 'U00000000';
const channelId = 'C00000000';
const messageTs = '1234567890.123456';
const permalink = `https://workspace.slack.com/archives/${channelId}/p1234567890123456`;

function fixture(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'reggie-runner-test-'));
  const configPath = join(directory, 'runtime.json');
  const statePath = join(directory, 'state.json');
  const eventPath = join(directory, 'event.json');
  writeFileSync(configPath, JSON.stringify({
    roleId: 'consultant',
    slack: {
      mode: 'computer-use',
      workspaceId: 'T00000000',
      agentDisplayName: 'Reggie Agent',
      agentUserId,
      permittedChannels: [{ id: channelId, name: 'test-channel' }],
    },
  }));
  writeFileSync(statePath, JSON.stringify({
    version: 1,
    channels: { [channelId]: { cursor: messageTs } },
    missions: {},
  }));
  writeFileSync(eventPath, JSON.stringify({
    channelId,
    permalink,
    threadPermalink: permalink,
    senderId: 'U11111111',
    mentionedUserId: agentUserId,
    text: 'Please check this request',
    mentionMatched: true,
    ...overrides,
  }));
  return { configPath, statePath, eventPath };
}

function claim(paths) {
  return spawnSync(process.execPath, [
    runnerPath,
    'claim',
    '--config', paths.configPath,
    '--state', paths.statePath,
    '--event', paths.eventPath,
  ], { encoding: 'utf8' });
}

test('accepts a verified member-link mention kept separately from message text', () => {
  const result = claim(fixture());
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { action: 'ignored', reason: 'already_seen', messageTs });
});

test('rejects a candidate that names a different mentioned member', () => {
  const result = claim(fixture({ mentionedUserId: 'U22222222' }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mentions a different Slack member/);
});

test('rejects a message authored by the configured Reggie member ID', () => {
  const result = claim(fixture({ senderId: agentUserId }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /authored by Reggie Agent/);
});

test('accepts a candidate for the matching workspace-specific Reggie identity', () => {
  const paths = fixture({ workspaceId: 'T22222222', mentionedUserId: 'U22222222' });
  writeFileSync(paths.configPath, JSON.stringify({
    roleId: 'consultant',
    slack: {
      mode: 'computer-use',
      workspaces: [
        {
          id: 'T11111111',
          agentUserId,
          permittedChannels: [{ id: 'C11111111', name: 'primary-channel' }],
        },
        {
          id: 'T22222222',
          agentUserId: 'U22222222',
          permittedChannels: [{ id: channelId, name: 'secondary-channel' }],
        },
      ],
    },
  }));
  const result = claim(paths);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { action: 'ignored', reason: 'already_seen', messageTs });
});

test('requires workspaceId when multiple Slack workspaces are configured', () => {
  const paths = fixture();
  writeFileSync(paths.configPath, JSON.stringify({
    roleId: 'consultant',
    slack: {
      mode: 'computer-use',
      workspaces: [
        {
          id: 'T11111111',
          agentUserId,
          permittedChannels: [{ id: 'C11111111', name: 'primary-channel' }],
        },
        {
          id: 'T22222222',
          agentUserId: 'U22222222',
          permittedChannels: [{ id: channelId, name: 'secondary-channel' }],
        },
      ],
    },
  }));
  const result = claim(paths);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /workspaceId is required/);
});

test('accepts thread-root context whose permalink matches the thread', () => {
  const result = claim(fixture({
    threadRoot: {
      permalink,
      senderId: 'U11111111',
      text: 'Original actionable request',
    },
  }));
  assert.equal(result.status, 0, result.stderr);
});

test('rejects thread-root context from a different Slack message', () => {
  const result = claim(fixture({
    threadRoot: {
      permalink: `https://workspace.slack.com/archives/${channelId}/p1234567891123456`,
      senderId: 'U11111111',
      text: 'Unrelated request',
    },
  }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must match the exact Slack thread permalink/);
});

test('rejects a thread reply without retained root context', () => {
  const result = claim(fixture({
    permalink: `https://workspace.slack.com/archives/${channelId}/p1234567891123456`,
  }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must include its thread-root request/);
});

test('resumes an awaiting mission from its original requester and thread', () => {
  const paths = fixture();
  const missionDirectory = join(paths.statePath, '..', 'mission');
  mkdirSync(missionDirectory);
  writeFileSync(join(missionDirectory, 'context.json'), JSON.stringify({
    roleId: 'consultant',
    roleInstructionPath: 'roles/consultant/AGENTS.md',
  }));
  const missionId = 'slack-test-mission';
  writeFileSync(paths.statePath, JSON.stringify({
    version: 1,
    channels: { [channelId]: { cursor: messageTs } },
    missions: {
      [missionId]: {
        id: missionId,
        channelId,
        senderId: 'U11111111',
        messageTs,
        threadPermalink: permalink,
        directory: missionDirectory,
        status: 'awaiting_owner_input',
        iteration: 1,
        iterations: [{ number: 1, state: 'awaiting_owner_input' }],
      },
    },
  }));
  const resumePermalink = `https://workspace.slack.com/archives/${channelId}/p1234567891123456?thread_ts=1234567890.123456`;
  writeFileSync(paths.eventPath, JSON.stringify({
    channelId,
    permalink: resumePermalink,
    threadPermalink: permalink,
    senderId: 'U11111111',
    mentionedUserId: agentUserId,
    text: 'Use the developer role and continue',
    mentionMatched: true,
  }));

  const result = spawnSync(process.execPath, [
    runnerPath,
    'resume',
    '--config', paths.configPath,
    '--state', paths.statePath,
    '--mission', missionId,
    '--event', paths.eventPath,
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    action: 'resumed',
    missionId,
    iteration: 2,
    roleId: 'consultant',
  });
  const state = JSON.parse(readFileSync(paths.statePath, 'utf8'));
  assert.equal(state.missions[missionId].status, 'queued');
  assert.equal(state.missions[missionId].iterations[1].feedbackMessageTs, '1234567891.123456');
});
