import { describe, it, expect } from 'vitest';
import { getFollowUpStage } from './status';

describe('status.ts', () => {
  it('should be defined', () => {
    expect(getFollowUpStage).toBeDefined();
  });
});
