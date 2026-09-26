import { describe, it, expect } from 'vitest';
import { validateAiEmailContent } from './validate-content';

describe('validateAiEmailContent', () => {
  it('accepts well-formed subject and body', () => {
    const result = validateAiEmailContent('Quick question about your team', 'Hi Jamie, thought this might be useful for your team.');
    expect(result.valid).toBe(true);
  });

  it('rejects an empty subject', () => {
    expect(validateAiEmailContent('', 'Hi Jamie, thought this might be useful.').valid).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(validateAiEmailContent('Quick question', '').valid).toBe(false);
  });

  it('rejects a body that is too short', () => {
    expect(validateAiEmailContent('Quick question', 'Hi.').valid).toBe(false);
  });

  it('rejects a body that is too long', () => {
    expect(validateAiEmailContent('Quick question', 'x'.repeat(5001)).valid).toBe(false);
  });

  it('rejects a subject with an unresolved placeholder', () => {
    expect(validateAiEmailContent('Hi {{first_name}}', 'A perfectly normal message body here.').valid).toBe(false);
  });

  it('rejects a body with an unresolved placeholder', () => {
    expect(validateAiEmailContent('Quick question', 'Hi {{first_name}}, thought this might be useful for you.').valid).toBe(false);
  });
});
