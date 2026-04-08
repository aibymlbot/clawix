import { describe, it, expect, vi } from 'vitest';
import { CommandService } from '../command.service.js';
import type { SessionCommand, SessionCommandContext } from '../session-command.js';

function makeCommand(name: string): SessionCommand {
  return {
    name,
    description: `Description for ${name}`,
    execute: vi.fn().mockResolvedValue({ text: `${name} executed` }),
  };
}

function makeContext(overrides?: Partial<SessionCommandContext>): SessionCommandContext {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    channelId: 'channel-1',
    senderId: 'sender-1',
    agentDefinitionId: 'agent-def-1',
    ...overrides,
  };
}

describe('CommandService', () => {
  describe('isCommand', () => {
    it('returns true for a registered command', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('/reset')).toBe(true);
    });

    it('returns true case-insensitively', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('/Reset')).toBe(true);
      expect(service.isCommand('/RESET')).toBe(true);
    });

    it('returns true with trailing whitespace', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('  /reset  ')).toBe(true);
    });

    it('returns false for unregistered command', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('/foo')).toBe(false);
    });

    it('returns false for non-command text', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('hello world')).toBe(false);
    });

    it('returns false for slash with space before command name', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('/ reset')).toBe(false);
    });

    it('returns false for empty string', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('')).toBe(false);
    });

    it('returns false for bare slash', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isCommand('/')).toBe(false);
    });
  });

  describe('isSlashPrefixed', () => {
    it('returns true for any slash-prefixed text', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isSlashPrefixed('/foo')).toBe(true);
      expect(service.isSlashPrefixed('/reset')).toBe(true);
      expect(service.isSlashPrefixed('/unknown')).toBe(true);
    });

    it('returns false for non-slash text', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isSlashPrefixed('hello')).toBe(false);
    });

    it('returns false for bare slash', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isSlashPrefixed('/')).toBe(false);
    });

    it('returns false for slash-space', () => {
      const service = new CommandService([makeCommand('reset')]);
      expect(service.isSlashPrefixed('/ reset')).toBe(false);
    });
  });

  describe('execute', () => {
    it('dispatches to the correct command', async () => {
      const reset = makeCommand('reset');
      const help = makeCommand('help');
      const service = new CommandService([reset, help]);
      const ctx = makeContext();

      const result = await service.execute('/reset', ctx);

      expect(result.text).toBe('reset executed');
      expect(reset.execute).toHaveBeenCalledWith(ctx);
      expect(help.execute).not.toHaveBeenCalled();
    });

    it('returns error for unknown command', async () => {
      const service = new CommandService([makeCommand('reset')]);
      const result = await service.execute('/foo', makeContext());

      expect(result.text).toContain('Unknown command');
      expect(result.text).toContain('/help');
    });

    it('dispatches case-insensitively', async () => {
      const reset = makeCommand('reset');
      const service = new CommandService([reset]);

      await service.execute('/RESET', makeContext());
      expect(reset.execute).toHaveBeenCalledOnce();
    });

    it('passes args to command when text has content after command name', async () => {
      const compact = makeCommand('compact');
      const service = new CommandService([compact]);
      const ctx = makeContext();

      await service.execute('/compact focus on key decisions', ctx);

      expect(compact.execute).toHaveBeenCalledWith({
        ...ctx,
        args: 'focus on key decisions',
      });
    });

    it('passes undefined args when command has no trailing text', async () => {
      const compact = makeCommand('compact');
      const service = new CommandService([compact]);
      const ctx = makeContext();

      await service.execute('/compact', ctx);

      expect(compact.execute).toHaveBeenCalledWith({
        ...ctx,
        args: undefined,
      });
    });

    it('trims whitespace from extracted args', async () => {
      const compact = makeCommand('compact');
      const service = new CommandService([compact]);
      const ctx = makeContext();

      await service.execute('/compact   keep it short   ', ctx);

      expect(compact.execute).toHaveBeenCalledWith({
        ...ctx,
        args: 'keep it short',
      });
    });

    it('passes undefined args when trailing text is only whitespace', async () => {
      const compact = makeCommand('compact');
      const service = new CommandService([compact]);
      const ctx = makeContext();

      await service.execute('/compact    ', ctx);

      expect(compact.execute).toHaveBeenCalledWith({
        ...ctx,
        args: undefined,
      });
    });
  });

  describe('getAll', () => {
    it('returns all registered commands', () => {
      const service = new CommandService([
        makeCommand('reset'),
        makeCommand('compact'),
        makeCommand('help'),
      ]);
      const all = service.getAll();

      expect(all).toHaveLength(3);
      expect(all.map((c) => c.name)).toEqual(['reset', 'compact', 'help']);
    });
  });
});
