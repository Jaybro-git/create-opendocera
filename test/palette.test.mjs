import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, derivePalette, isHex, normalizeHex } from "../lib/palette.mjs";
import { renderConfig, toPackageName, toTitle } from "../lib/project.mjs";

test("normalizes hex input", () => {
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("b4512f"), "#B4512F");
  assert.ok(isHex("#2F6FED"));
  assert.ok(!isHex("blue"));
  assert.ok(!isHex("#12345"));
});

test("default brand color keeps its value and lands near the shipped palette", () => {
  const p = derivePalette("#B4512F");
  assert.equal(p.brand, "#B4512F");
  assert.equal(p.adjusted, false);
  assert.ok(contrast(p.brand, "#ffffff") >= 4.5);
  assert.ok(contrast(p.bright, "#0a0c11") >= 4.5);
});

for (const color of ["#2F6FED", "#FFD400", "#00FF88", "#FFFFFF", "#000000", "#7C3AED", "#E11D48"]) {
  test(`palette for ${color} meets the contrast rules`, () => {
    const p = derivePalette(color);
    for (const v of [p.deep, p.brand, p.bright, p.neutral]) assert.match(v, /^#[0-9A-F]{6}$/);
    assert.ok(contrast(p.brand, "#ffffff") >= 4.5, `brand ${p.brand}`);
    assert.ok(contrast(p.bright, "#0a0c11") >= 4.5, `bright ${p.bright}`);
  });
}

test("light colors are darkened and flagged", () => {
  const p = derivePalette("#FFD400");
  assert.equal(p.adjusted, true);
  assert.notEqual(p.brand, "#FFD400");
});

test("names", () => {
  assert.equal(toTitle("my-cool_docs"), "My Cool Docs");
  assert.equal(toPackageName("Nimbus Docs!"), "nimbus-docs");
  assert.equal(toPackageName("***"), "docs");
});

test("rendered config is valid object source with escaped strings", () => {
  const src = renderConfig({
    name: 'Ac"me',
    github: "",
    palette: derivePalette("#2F6FED"),
    groups: ["Get started"],
    ctaHref: "/docs/intro",
  });
  assert.ok(src.startsWith("export const docsConfig: DocsConfig = {"));
  assert.ok(src.includes('name: "Ac\\"me"'));
  assert.ok(!src.includes("GitHub"));
  // Strip the type annotation and evaluate the object to prove it parses.
  const obj = new Function(`return (${src.replace("export const docsConfig: DocsConfig = ", "").replace(/;\s*$/, "")})`)();
  assert.equal(obj.title, 'Ac"me docs');
  assert.equal(obj.theme.grainient.color2, obj.theme.palette.brand);
});
