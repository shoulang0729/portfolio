import { describe, it, expect } from 'vitest';
import { GLOSSARY } from '../src/glossary-data.js';
import { glossaryHTML } from '../src/glossary.js';

describe('GLOSSARY data', () => {
  it('各カテゴリが id/title と妥当な tab を持つ', () => {
    expect(GLOSSARY.length).toBeGreaterThan(0);
    for (const cat of GLOSSARY) {
      expect(typeof cat.id).toBe('string');
      expect(cat.id.length).toBeGreaterThan(0);
      expect(typeof cat.title).toBe('string');
      expect(cat.title.length).toBeGreaterThan(0);
      expect(['value', 'risk', 'both']).toContain(cat.tab);
      expect(Array.isArray(cat.terms)).toBe(true);
      expect(cat.terms.length).toBeGreaterThan(0);
    }
  });

  it('全用語が term/desc を非空で持つ', () => {
    for (const cat of GLOSSARY) {
      for (const t of cat.terms) {
        expect(typeof t.term).toBe('string');
        expect(t.term.trim().length).toBeGreaterThan(0);
        expect(typeof t.desc).toBe('string');
        expect(t.desc.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('カテゴリ id は一意', () => {
    const ids = GLOSSARY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('基本概念（both）が先頭にある', () => {
    expect(GLOSSARY[0].tab).toBe('both');
  });
});

describe('glossaryHTML(tab)', () => {
  it("value タブは both + value カテゴリのみを含む", () => {
    const html = glossaryHTML('value');
    const valueCats = GLOSSARY.filter((c) => c.tab === 'both' || c.tab === 'value');
    const riskOnly = GLOSSARY.filter((c) => c.tab === 'risk');
    for (const c of valueCats) expect(html).toContain(c.title);
    for (const c of riskOnly) expect(html).not.toContain(c.title);
  });

  it("risk タブは both + risk カテゴリのみを含む", () => {
    const html = glossaryHTML('risk');
    const riskCats = GLOSSARY.filter((c) => c.tab === 'both' || c.tab === 'risk');
    const valueOnly = GLOSSARY.filter((c) => c.tab === 'value');
    for (const c of riskCats) expect(html).toContain(c.title);
    for (const c of valueOnly) expect(html).not.toContain(c.title);
  });

  it('二段アコーディオン（外側 .gloss + 内側 .gloss-cat）で native details を使う', () => {
    const html = glossaryHTML('value');
    expect(html).toContain('<details class="gloss">');
    expect(html).toContain('<details class="gloss-cat">');
    expect(html).not.toContain('onclick');
  });
});
