import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { writeFile, unlink } from "fs/promises";
import path from "path";

const RUN_TIMEOUT_MS = 5000;

const TWO_SUM_TESTS = [
  { nums: [2, 7, 11, 15], target: 9, expected: [0, 1] },
  { nums: [3, 2, 4], target: 6, expected: [1, 2] },
  { nums: [3, 3], target: 6, expected: [0, 1] },
  { nums: [1, 5, 3, 7], target: 8, expected: [1, 3] },
];

function buildRunnerScript(userCode: string): string {
  const testsJson = JSON.stringify(TWO_SUM_TESTS);
  return `${userCode}

if __name__ == "__main__":
    import json
    tests = ${testsJson}
    results = []
    for t in tests:
        try:
            got = two_sum(t["nums"], t["target"])
            valid = isinstance(got, list) and len(got) == 2 and all(isinstance(x, int) and 0 <= x < len(t["nums"]) for x in got)
            sums_ok = valid and (t["nums"][got[0]] + t["nums"][got[1]] == t["target"])
            passed = valid and sums_ok
            err = None
            if not passed and valid:
                err = "Indices do not sum to target"
            elif not valid:
                err = "Return value must be a list of two indices"
            results.append({"nums": t["nums"], "target": t["target"], "expected": t["expected"], "got": list(got) if valid else None, "passed": passed, "error": err})
        except Exception as e:
            results.append({"nums": t["nums"], "target": t["target"], "expected": t["expected"], "got": None, "passed": False, "error": str(e)})
    out = {"passed": all(r["passed"] for r in results), "results": results}
    print(json.dumps(out))
`;
}

export async function POST(request: Request) {
  try {
    const { code } = (await request.json()) as { code?: string };
    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Missing or empty 'code' in body." }, { status: 400 });
    }

    const script = buildRunnerScript(code.trim());
    const tmpPath = path.join(tmpdir(), `two-sum-${Date.now()}-${Math.random().toString(36).slice(2)}.py`);
    await writeFile(tmpPath, script, "utf8");

    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const proc = spawn("python3", [tmpPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
      proc.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Run timed out (5s)."));
      }, RUN_TIMEOUT_MS);
      proc.on("close", (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, code });
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }).finally(() => unlink(tmpPath).catch(() => {}));

    if (result.code !== 0) {
      const errMsg = result.stderr.trim() || result.stdout.trim() || "Non-zero exit.";
      return NextResponse.json({
        passed: false,
        results: TWO_SUM_TESTS.map((t) => ({ ...t, got: null, passed: false, error: errMsg })),
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }

    try {
      const lastLine = result.stdout.trim().split("\n").filter(Boolean).pop() ?? "";
      const out = JSON.parse(lastLine) as { passed: boolean; results: { nums: number[]; target: number; expected: number[]; got: number[] | null; passed: boolean; error?: string }[] };
      return NextResponse.json({ passed: out.passed, results: out.results, stdout: result.stdout, stderr: result.stderr });
    } catch {
      return NextResponse.json({
        passed: false,
        results: TWO_SUM_TESTS.map((t) => ({ ...t, got: null, passed: false, error: result.stderr.trim() || "Invalid output from script." })),
        stdout: result.stdout,
        stderr: result.stderr,
      });
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      passed: false,
      results: TWO_SUM_TESTS.map((t) => ({ ...t, got: null, passed: false, error: err })),
      stdout: "",
      stderr: err,
    });
  }
}
