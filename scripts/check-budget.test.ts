import { describe, expect, it } from 'vitest';
import { scriptsInHtml, staticImports } from './check-budget.mjs';

describe('scriptsInHtml', () => {
  it('finds module scripts, island URLs and inline scripts but not JSON-LD', () => {
    const html = `
      <script type="module" src="/_astro/page.js"></script>
      <astro-island component-url="/_astro/Editor.js" renderer-url="/_astro/client.js"></astro-island>
      <script>(()=>{console.log(1)})()</script>
      <script type="application/ld+json">{"@type":"WebSite"}</script>`;
    const { urls, inline } = scriptsInHtml(html);
    expect(urls.sort()).toEqual(['/_astro/Editor.js', '/_astro/client.js', '/_astro/page.js']);
    expect(inline).toEqual(['(()=>{console.log(1)})()']);
  });
});

describe('staticImports', () => {
  it('follows static imports and re-exports in minified code', () => {
    const code = 'import{a as b}from"./chunk.js";import"./side.js";export{c}from"./re.js";const x=1;';
    expect(staticImports(code).sort()).toEqual(['./chunk.js', './re.js', './side.js']);
  });

  it('ignores dynamic import()', () => {
    expect(staticImports('const p=()=>import("./pdf.js");')).toEqual([]);
  });
});
