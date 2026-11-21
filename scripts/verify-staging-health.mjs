const commit = process.env.GITHUB_SHA;
const hosts = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(commit ?? "") || hosts.length === 0) {
  throw new Error("Expected GITHUB_SHA and one or more staging URLs");
}

async function verify(base) {
  const url = new URL("/api/health", base);
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const body = await response.json();
        if (
          body.status === "ok" &&
          body.db?.ok === true &&
          typeof body.commit === "string" &&
          body.commit.length >= 7 &&
          commit.startsWith(body.commit)
        ) {
          console.log(`${url.hostname} is healthy on ${body.commit}`);
          return;
        }
      }
    } catch {
      // A rollout can briefly interrupt reads. The check remains bounded.
    }
    if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`${url.hostname} did not report a healthy deployment of ${commit}`);
}

await Promise.all(hosts.map(verify));
