import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
