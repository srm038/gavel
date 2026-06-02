import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import path from "path";

const tmpDir = "/tmp/rnr-cli-" + Date.now();

const write = (name: string, content: string) =>
  Bun.write(`${tmpDir}/${name}`, content);

const run = async (...args: string[]) => {
  const proc = Bun.spawnSync(["bun", "render.ts", ...args], {
    cwd: import.meta.dirname,
    env: { ...process.env },
  });
  return {
    out: proc.stdout.toString(),
    err: proc.stderr.toString(),
    code: proc.exitCode,
  };
};

const valid = `
title: T
type: minutes
date: 2025-01-01
meeting_type: R
call_to_order:
  time: "10:00"
  by: Chair
`;

const invalid = `
title: Bad
type: minutes
date: 2025-01-01
meeting_type: R
`;

beforeAll(() => Bun.spawnSync(["mkdir", "-p", tmpDir]));
afterAll(() => Bun.spawnSync(["rm", "-rf", tmpDir]));

describe("render CLI", () => {
  test("no args — prints usage and exits 1", async () => {
    const { err, code } = await run();
    expect(code).toBe(1);
    expect(err).toContain("Usage:");
  });

  test("valid minutes — writes .md and .pdf", async () => {
    await write("m.yml", valid);
    const { out, err, code } = await run(`${tmpDir}/m.yml`);
    expect(code).toBe(0);
    expect(out).toContain("m.md");
    expect(out).toContain("m.pdf");
    const md = await Bun.file(`${tmpDir}/m.md`).text();
    expect(md).toContain("# T");
    expect(md).toContain("**MINUTES**");
  });

  test("non-.yml file skipped", async () => {
    await write("x.txt", "hello");
    const { out } = await run(`${tmpDir}/x.txt`);
    expect(out).toBe("");
  });

  test("non-existent file — error", async () => {
    const { err } = await run(`${tmpDir}/nope.yml`);
    expect(err).toContain("✗");
  });

  test("glob matches .yml files", async () => {
    await write("a.yml", valid);
    await write("b.yml", valid);
    const { out } = await run(`${tmpDir}/*.yml`);
    expect(out).toContain("a.yml");
    expect(out).toContain("b.yml");
  });

  test("invalid document — schema warning", async () => {
    await write("bad.yml", invalid);
    const { err } = await run(`${tmpDir}/bad.yml`);
    expect(err).toContain("⚠");
    expect(err).toContain("call_to_order");
  });
});
