import { describe, it, expect } from 'vitest';
import { verifyEmailLocally } from './local-verify';

describe('local-verify.ts', () => {
  it('should be defined', () => {
    expect(verifyEmailLocally).toBeDefined();
  });
});
