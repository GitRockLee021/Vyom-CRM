// Reusable error hunter for Playwright.
//
// Attach it to any `page` and it will record every unruly thing that happens
// while that page is open, without asserting anything by itself:
//
//   - uncaught JavaScript exceptions (`pageerror`)
//   - console errors AND warnings
//   - failed / blocked network requests (requestfailed)
//   - every HTTP response with status >= 400 (4xx / 5xx / favicon 404 etc.)
//
// Every event is tagged with the URL that was on screen when it fired, so a
// failure can be traced straight back to the screen that caused it.
//
// Events that are known-beneign (e.g. no favicon has been shipped yet, or a
// `net::ERR_ABORTED` that is just React cancelling an in-flight fetch when the
// user navigates) go into the separate `infos` bucket and do NOT fail checks.
// Tune DEFAULT_IGNORE here if you want stricter behaviour.
export const DEFAULT_IGNORE = [
  { type: 'response', pattern: /\/favicon\.ico/i, reason: 'no favicon shipped yet' },
  { type: 'requestfailed', pattern: /net::ERR_ABORTED/i, reason: 'navigation aborts in-flight requests' },
];

export function createErrorHunter(page, { ignore = [...DEFAULT_IGNORE] } = {}) {
  const errors = [];
  const infos = [];

  function matchesList(item, list) {
    return list.some(({ type, pattern }) => type === item.type && pattern.test(item.text));
  }

  const record = (item) => {
    if (matchesList(item, ignore)) {
      infos.push({ ...item, ignored: true, reason: ignore.find((r) => r.type === item.type && r.pattern.test(item.text))?.reason });
      return;
    }
    errors.push(item);
  };

  const handlers = {
    pageerror: (err) => record({ type: 'pageerror', url: page.url(), text: String(err?.message || err).split('\n')[0] }),
    console: (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        record({ type: `console:${msg.type()}`, url: page.url(), text: msg.text(), location: msg.location()?.url || '' });
      }
    },
    requestfailed: (req) =>
      record({
        type: 'requestfailed',
        url: page.url(),
        text: `${req.url()} :: ${req.failure()?.errorText || 'failed'}`,
      }),
    response: (res) => {
      if (res.status() >= 400) {
        record({ type: `http:${res.status()}`, url: page.url(), text: `${res.request().method()} ${res.url()}` });
      }
    },
  };

  for (const [event, fn] of Object.entries(handlers)) page.on(event, fn);

  function detach() {
    for (const [event, fn] of Object.entries(handlers)) page.off(event, fn);
  }

  // Collapse all raw events down to distinct errors, each with the set of URLs
  // it appeared on — the compact shape that is easiest to skim or hand to an AI.
  function grouped() {
    const by = new Map();
    for (const e of errors) {
      const key = `${e.type}: ${e.text}`;
      if (!by.has(key)) by.set(key, { type: e.type, text: e.text, urls: new Set() });
      by.get(key).urls.add(e.url);
    }
    return [...by.values()].map((g) => ({ ...g, urls: [...g.urls] }));
  }

  function report() {
    const lines = [];
    const g = grouped();
    if (g.length === 0) {
      lines.push('No errors captured.');
      lines.push(`(${infos.length} known-beneign event(s) ignored.)`);
    } else {
      lines.push(`=== ${g.length} distinct error(s) across the app ===`);
      for (const e of g) {
        lines.push(`\n[${e.type}] ${e.text}`);
        lines.push(`    seen on: ${e.urls.join(', ')}`);
      }
    }
    return lines.join('\n');
  }

  return { errors, infos, detach, grouped, report };
}