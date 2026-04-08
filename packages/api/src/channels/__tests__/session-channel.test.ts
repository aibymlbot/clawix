import { describe, expect, it, vi } from 'vitest';

import { SessionManagerService } from '../../engine/session-manager.service.js';

describe('SessionManagerService — channel-aware getOrCreate', () => {
  function makeService(overrides: { findFirst?: unknown; create?: unknown }) {
    const sessionRepo = {
      create: vi.fn().mockResolvedValue(overrides.create ?? { id: 'new-session' }),
    };
    const prisma = {
      session: {
        findFirst: vi.fn().mockResolvedValue(overrides.findFirst ?? null),
      },
      sessionMessage: {},
    };
    return {
      service: new SessionManagerService(sessionRepo as never, prisma as never),
      sessionRepo,
      prisma,
    };
  }

  it('finds existing active session by userId + channelId + agentDefinitionId', async () => {
    const existingSession = {
      id: 'existing-session',
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
      channelId: 'channel-1',
      isActive: true,
    };
    const { service, prisma } = makeService({ findFirst: existingSession });

    const result = await service.getOrCreate({
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
      channelId: 'channel-1',
    });

    expect(result).toEqual(existingSession);
    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        agentDefinitionId: 'agent-1',
        channelId: 'channel-1',
        isActive: true,
      },
    });
  });

  it('creates new session when no active session found for channel', async () => {
    const newSession = {
      id: 'new-session',
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
      channelId: 'channel-1',
    };
    const { service, sessionRepo, prisma } = makeService({
      findFirst: null,
      create: newSession,
    });

    const result = await service.getOrCreate({
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
      channelId: 'channel-1',
    });

    expect(result).toEqual(newSession);
    expect(prisma.session.findFirst).toHaveBeenCalled();
    expect(sessionRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
      channelId: 'channel-1',
    });
  });

  it('falls back to original behavior when channelId is not provided', async () => {
    const newSession = { id: 'new-session' };
    const { service, sessionRepo, prisma } = makeService({ create: newSession });

    const result = await service.getOrCreate({
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
    });

    expect(result).toEqual(newSession);
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
    expect(sessionRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      agentDefinitionId: 'agent-1',
    });
  });
});
