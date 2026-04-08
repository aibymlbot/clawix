import { describe, expect, it, vi } from 'vitest';

import { UserRepository } from '../../db/user.repository.js';

describe('UserRepository.findByTelegramId', () => {
  it('returns user when telegramId exists', async () => {
    const mockUser = { id: 'user-1', telegramId: '123456', isActive: true };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
    };
    const repo = new UserRepository(prisma as never);

    const result = await repo.findByTelegramId('123456');

    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { telegramId: '123456' },
    });
  });

  it('returns null when telegramId not found', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const repo = new UserRepository(prisma as never);

    const result = await repo.findByTelegramId('999');

    expect(result).toBeNull();
  });
});
