import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { processMinutes } from "./processMinutes";

describe("markdown to tex", async () => {
  let originalBunFile;
  beforeAll(() => {
    let originalBunFile = Bun.file;
    Bun.file = mock(() => ({
      text: async () => "- Action: Action 1\n- Action: Action 2",
    }));
  });
  afterAll(() => {
    Bun.file = originalBunFile;
  });

  test("markdown should convert to tex properly", async () => {
    let tex = await processMinutes({ file: "test.md" });
    expect(tex).toBe(
      String.raw`\begin{enumerate}\item\textbf{Action}\end{enumerate}`,
    );
  });
});
