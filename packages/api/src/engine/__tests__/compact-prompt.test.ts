import { describe, it, expect } from 'vitest';
import { buildConsolidationSystemPrompt, buildConsolidationUserPrompt } from '../compact-prompt.js';

describe('buildConsolidationSystemPrompt', () => {
  it('includes role description when no existing summary', () => {
    const prompt = buildConsolidationSystemPrompt('');
    expect(prompt).toContain('memory consolidation assistant');
    expect(prompt).toContain('No prior memory context');
  });

  it('includes existing summary when provided', () => {
    const prompt = buildConsolidationSystemPrompt('User was setting up a Node.js project');
    expect(prompt).toContain('memory consolidation assistant');
    expect(prompt).toContain('User was setting up a Node.js project');
    expect(prompt).not.toContain('No prior memory context');
  });
});

describe('buildConsolidationUserPrompt', () => {
  const sampleChunk = '[2026-01-01T00:00:00Z] user: Hello\n[2026-01-01T00:01:00Z] assistant: Hi';

  it('includes structured section guidelines', () => {
    const prompt = buildConsolidationUserPrompt(sampleChunk);
    expect(prompt).toContain('Primary Request & Intent');
    expect(prompt).toContain('Key Technical Context');
    expect(prompt).toContain('Files & Code');
    expect(prompt).toContain('Errors & Fixes');
    expect(prompt).toContain('Decisions Made');
    expect(prompt).toContain('Pending Tasks');
    expect(prompt).toContain('Current State');
  });

  it('includes the formatted chunk', () => {
    const prompt = buildConsolidationUserPrompt(sampleChunk);
    expect(prompt).toContain(sampleChunk);
  });

  it('includes history_entry guidance', () => {
    const prompt = buildConsolidationUserPrompt(sampleChunk);
    expect(prompt).toContain('history_entry');
    expect(prompt).toContain('concise');
  });

  it('appends custom instructions when provided', () => {
    const prompt = buildConsolidationUserPrompt(sampleChunk, 'focus on database decisions');
    expect(prompt).toContain('focus on database decisions');
  });

  it('does not include custom instructions block when not provided', () => {
    const prompt = buildConsolidationUserPrompt(sampleChunk);
    expect(prompt).not.toContain('Additional instructions');
  });

  it('does not include custom instructions block for undefined', () => {
    const prompt = buildConsolidationUserPrompt(sampleChunk, undefined);
    expect(prompt).not.toContain('Additional instructions');
  });
});
