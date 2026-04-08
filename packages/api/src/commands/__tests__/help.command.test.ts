import { describe, it, expect } from 'vitest';
import { HelpCommand } from '../help.command.js';
import type { SessionCommandContext } from '../session-command.js';

function makeContext(): SessionCommandContext {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    channelId: 'channel-1',
    senderId: 'sender-1',
    agentDefinitionId: 'agent-def-1',
  };
}

describe('HelpCommand', () => {
  function createCommand(): HelpCommand {
    const cmd = new HelpCommand();
    cmd.setCommandListGetter(() => [
      { name: 'reset', description: 'Start a fresh conversation' },
      { name: 'compact', description: 'Summarize conversation context' },
      { name: 'help', description: 'Show this help message' },
    ]);
    return cmd;
  }

  it('has the correct name and description', () => {
    const cmd = createCommand();
    expect(cmd.name).toBe('help');
    expect(cmd.description).toBeDefined();
  });

  it('lists all available commands', async () => {
    const cmd = createCommand();
    const result = await cmd.execute(makeContext());

    expect(result.text).toContain('Available commands:');
    expect(result.text).toContain('/reset');
    expect(result.text).toContain('/compact');
    expect(result.text).toContain('/help');
    expect(result.text).toContain('Start a fresh conversation');
    expect(result.text).toContain('Summarize conversation context');
  });

  it('returns empty list when no getter is set', async () => {
    const cmd = new HelpCommand();
    const result = await cmd.execute(makeContext());

    expect(result.text).toBe('Available commands:\n');
  });
});
