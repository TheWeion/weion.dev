#!/usr/bin/env node
// Scheduled publishing for Pages CMS.
//
// Pages CMS commits straight to `main` and has no scheduling, so a save that
// sets a `publish_at` date is moved out of `main` into a pull request that is
// merged once that time arrives. Saves scheduled for the same minute share one
// PR. `.pages/scheduled.json` lists the pending PRs so the CMS can show them.
//
//   node scripts/scheduled-publish.mjs run             # the workflow's job
//   node scripts/scheduled-publish.mjs pending         # prints true/false
//   node scripts/scheduled-publish.mjs netlify-ignore  # Netlify `ignore` hook
//
// `run` is idempotent and works from the current state of `main` rather than
// the push that triggered it, so a dropped or cancelled run is caught up by
// the next push or cron tick. See `.github/workflows/scheduled-publish.yml`.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CONTENT_DIR = 'src/content';
const DASHBOARD = '.pages/scheduled.json';
const BRANCH_PREFIX = 'scheduled/';
const LABEL = 'scheduled-publish';
const MARKER_RE = /<!-- scheduled-publish-at: (\S+) -->/;
const BLOCKED_MARKER = '<!-- scheduled-publish-blocked -->';
// Every `"publish_at": "<value>"` pair. JSON strings can't hold raw quotes or
// newlines, so this can't match inside another value.
const PUBLISH_AT_RE = /("publish_at"\s*:\s*)"(?:[^"\\]|\\.)*"/g;

// --- content -----------------------------------------------------------------

/** Every non-empty `publish_at` string anywhere in a parsed JSON document. */
function collectPublishAt(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectPublishAt(item, out);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'publish_at') {
        if (typeof value === 'string' && value.trim() !== '') out.push(value.trim());
      } else {
        collectPublishAt(value, out);
      }
    }
  }
  return out;
}

function publishAtValues(text) {
  return text == null ? [] : collectPublishAt(JSON.parse(text));
}

/** The file with every `publish_at` blanked, leaving its formatting untouched. */
function blankPublishAt(text) {
  const blanked = text.replace(PUBLISH_AT_RE, '$1""');
  if (publishAtValues(blanked).length > 0) throw new Error('could not clear publish_at');
  return blanked;
}

function contentFiles() {
  return readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => `${CONTENT_DIR}/${name}`)
    .sort();
}

function hasPendingContent() {
  return contentFiles().some((path) => publishAtValues(readFileSync(path, 'utf8')).length > 0);
}

// --- time --------------------------------------------------------------------

/** Offset of `zone` from UTC, in ms, at instant `ms`. */
function zoneOffset(ms, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * Parses a CMS date (`YYYY-MM-DDTHH:mm`, or `YYYY-MM-DD` for midnight) as wall
 * time in `zone`. Values carrying their own offset (`...Z`, `...+01:00`) are
 * taken as-is. Returns epoch ms truncated to the minute.
 */
function parsePublishAt(value, zone) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  let ms;
  if (m) {
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    // Two passes so a time next to a DST change picks up the right offset.
    ms = wall - zoneOffset(wall, zone);
    ms = wall - zoneOffset(ms, zone);
  } else {
    ms = Date.parse(value);
  }
  if (Number.isNaN(ms)) throw new Error(`publish_at "${value}" is not a date`);
  return Math.floor(ms / 60_000) * 60_000;
}

function formatWhen(ms, zone) {
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(ms);
  return `${when} (${zone})`;
}

/** `scheduled/2026-11-01T09-00Z` — refs can't contain `:`. */
function branchFor(ms) {
  return `${BRANCH_PREFIX}${new Date(ms).toISOString().slice(0, 16).replace(':', '-')}Z`;
}

function timezone() {
  try {
    const zone = JSON.parse(readFileSync(`${CONTENT_DIR}/profile.json`, 'utf8')).operative.timezone;
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

// --- git ---------------------------------------------------------------------

function git(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
    ...options,
  });
}

/** File contents at `ref`, or `null` if it doesn't exist there. */
function show(ref, path, cwd) {
  const result = spawnSync('git', ['show', `${ref}:${path}`], { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

function remoteBranchExists(branch) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `origin/${branch}`]).status === 0;
}

class ConflictError extends Error {}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/**
 * Comparable form of a JSON value: keys sorted, and blank values ('', null,
 * []) dropped. Pages CMS reorders keys into field order and writes blanks
 * for empty fields (every item gains `"publish_at": ""`), none of which is a
 * real edit.
 */
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = canon(value[key]);
      if (!(v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0))) {
        out[key] = v;
      }
    }
    return out;
  }
  return value;
}

const key = (value) => JSON.stringify(canon(value));
const sameJson = (a, b) => key(a) === key(b);

/**
 * Three-way merge of parsed JSON. A value changed on only one side takes that
 * side, objects merge key by key, and lists merge item by item ({@link mergeList}).
 * When both sides changed the same value, `prefer` ('ours' or 'theirs') wins —
 * the newer CMS save, or the scheduled branch over main — so there is no such
 * thing as a content conflict. Pages CMS rewrites whole files in field order,
 * which is why this isn't line-based.
 */
function mergeJson(ours, base, theirs, prefer, path) {
  if (sameJson(theirs, base)) return ours;
  if (sameJson(ours, base) || sameJson(ours, theirs)) return theirs;
  if (isPlainObject(ours) && isPlainObject(base) && isPlainObject(theirs)) {
    const out = {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(ours)])) {
      const value = mergeJson(ours[key], base[key], theirs[key], prefer, `${path}.${key}`);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  if (Array.isArray(ours) && Array.isArray(base) && Array.isArray(theirs)) {
    return mergeList(ours, base, theirs, prefer, path);
  }
  console.log(
    `${path}: changed on both sides, keeping the ${prefer === 'theirs' ? 'newer save' : 'scheduled value'}`,
  );
  return prefer === 'theirs' ? theirs : ours;
}

/** Index in `b` matched to each item of `a` by a longest common subsequence (-1 = none). */
function matchItems(a, b) {
  const ka = a.map(key);
  const kb = b.map(key);
  const len = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      len[i][j] = ka[i] === kb[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    }
  }
  const match = new Array(a.length).fill(-1);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (ka[i] === kb[j]) match[i++] = j++;
    else if (len[i + 1][j] >= len[i][j + 1]) i++;
    else j++;
  }
  return match;
}

/** Share of fields two list items agree on (0–1); non-objects are 1 only when equal. */
function similarity(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) return sameJson(a, b) ? 1 : 0;
  const ca = canon(a);
  const cb = canon(b);
  const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  let same = 0;
  for (const k of keys) if (sameJson(ca[k], cb[k])) same++;
  return keys.size === 0 ? 1 : same / keys.size;
}

/** For each `base` item, the most similar unused `other` item (≥ half its fields), or -1. */
function pairUp(base, other) {
  const used = new Set();
  return base.map((item) => {
    let best = -1;
    let bestScore = 0.5;
    other.forEach((candidate, j) => {
      const score = used.has(j) ? 0 : similarity(item, candidate);
      if (score >= bestScore && (best === -1 || score > bestScore)) {
        best = j;
        bestScore = score;
      }
    });
    if (best >= 0) used.add(best);
    return best;
  });
}

/**
 * diff3 over list items: items untouched on both sides anchor the merge, and
 * each stretch between anchors takes whichever side changed it. A stretch
 * changed on both sides pairs each base item with its edited version on each
 * side by similarity, so an edit on one side and an insertion or removal on
 * the other both survive; the same item edited on both sides merges field by
 * field. Order follows the `prefer` side.
 */
function mergeList(ours, base, theirs, prefer, path) {
  const toOurs = matchItems(base, ours);
  const toTheirs = matchItems(base, theirs);
  const out = [];
  let b = 0;
  let o = 0;
  let t = 0;
  for (let i = 0; i <= base.length; i++) {
    const anchor = i === base.length || (toOurs[i] >= 0 && toTheirs[i] >= 0);
    if (!anchor) continue;
    const oEnd = i === base.length ? ours.length : toOurs[i];
    const tEnd = i === base.length ? theirs.length : toTheirs[i];
    const chunk = [ours.slice(o, oEnd), base.slice(b, i), theirs.slice(t, tEnd)];
    out.push(...mergeChunk(...chunk, prefer, path));
    // Anchors only match up to blanks and key order, so merge those too.
    if (i < base.length) out.push(mergeJson(ours[oEnd], base[i], theirs[tEnd], prefer, path));
    b = i + 1;
    o = oEnd + 1;
    t = tEnd + 1;
  }
  return out;
}

function mergeChunk(ours, base, theirs, prefer, path) {
  if (sameJson(theirs, base)) return ours;
  if (sameJson(ours, base) || sameJson(ours, theirs)) return theirs;
  const pairOurs = pairUp(base, ours);
  const pairTheirs = pairUp(base, theirs);
  const lead = prefer === 'theirs' ? theirs : ours;
  const pairLead = prefer === 'theirs' ? pairTheirs : pairOurs;
  const pairOther = prefer === 'theirs' ? pairOurs : pairTheirs;
  const other = prefer === 'theirs' ? ours : theirs;
  const out = [];
  lead.forEach((item, j) => {
    const bi = pairLead.indexOf(j);
    if (bi < 0) {
      out.push(item); // added on the lead side
      return;
    }
    const oj = pairOther[bi];
    if (oj < 0) {
      // Removed on the other side: honour that unless the lead side edited it.
      if (!sameJson(item, base[bi])) out.push(item);
      return;
    }
    const [mine, yours] = prefer === 'theirs' ? [other[oj], item] : [item, other[oj]];
    out.push(mergeJson(mine, base[bi], yours, prefer, path));
  });
  other.forEach((item, j) => {
    // Added on the other side.
    if (!pairOther.includes(j) && !out.some((x) => sameJson(x, item))) out.push(item);
  });
  return out;
}

/** {@link mergeJson} over file texts (`null` = missing), written as Pages CMS writes JSON. */
function mergeFile(ours, base, theirs, prefer, path) {
  if (ours === base) return theirs;
  if (theirs === base || theirs === ours) return ours;
  const parse = (text) => (text === null ? undefined : JSON.parse(text));
  const merged = mergeJson(parse(ours), parse(base), parse(theirs), prefer, path);
  if (merged === undefined) return null;
  if (sameJson(merged, parse(ours))) return ours;
  if (sameJson(merged, parse(theirs))) return theirs;
  return JSON.stringify(merged, null, 2);
}

/** Runs `fn(dir)` in a temporary worktree with `branch` checked out at `start`. */
async function withWorktree(branch, start, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'scheduled-branch-'));
  git(['worktree', 'add', '--quiet', '-B', branch, dir, start]);
  try {
    return await fn(dir);
  } finally {
    git(['worktree', 'remove', '--force', dir]);
  }
}

function changedBetween(from, to, cwd) {
  return git(['diff', '--name-only', from, to, '--', CONTENT_DIR], { cwd })
    .trim()
    .split('\n')
    .filter(Boolean);
}

/**
 * Merges `target` (main) into the branch checked out in `dir`, so its PR
 * holds only the scheduled edits and merges cleanly. Content files changed
 * on both sides are merged with {@link mergeFile}. Returns false if the
 * branch already contains `target`.
 */
function syncWithMain(dir, target) {
  if (
    spawnSync('git', ['merge-base', '--is-ancestor', target, 'HEAD'], { cwd: dir }).status === 0
  ) {
    return false;
  }
  const head = git(['rev-parse', 'HEAD'], { cwd: dir }).trim();
  const mergeBase = git(['merge-base', 'HEAD', target], { cwd: dir }).trim();
  spawnSync('git', ['merge', '--no-ff', '--no-commit', '--quiet', target], { cwd: dir });
  const ours = new Set(changedBetween(mergeBase, head, dir));
  for (const path of changedBetween(mergeBase, target, dir).filter((p) => ours.has(p))) {
    try {
      // The branch wins on a clash: its value is what's scheduled to go out.
      writeFile(
        dir,
        path,
        mergeFile(show(head, path), show(mergeBase, path), show(target, path), 'ours', path),
      );
    } catch (error) {
      spawnSync('git', ['merge', '--abort'], { cwd: dir });
      throw error;
    }
  }
  const unmerged = git(['diff', '--name-only', '--diff-filter=U'], { cwd: dir }).trim();
  if (unmerged) {
    spawnSync('git', ['merge', '--abort'], { cwd: dir });
    throw new ConflictError(`${unmerged.split('\n').join(', ')} conflict with main`);
  }
  git(['commit', '--quiet', '--no-edit', '-m', 'Merge main into this scheduled update'], {
    cwd: dir,
  });
  return true;
}

const CONFLICT_HELP =
  'Save that page again in the CMS so it no longer clashes (or with **Publish at** cleared to ' +
  'publish it now), or close this PR to cancel the earlier edit and schedule the new one on ' +
  'its own.';

/**
 * The newest version of `path` on `main` without a pending `publish_at` —
 * i.e. what the CMS save was made against. Usually the previous commit.
 */
function baseVersion(path) {
  const commits = git(['log', '--format=%H', 'origin/main', '--', path]).trim().split('\n');
  for (const sha of commits.slice(1)) {
    const text = show(sha, path);
    if (text === null || publishAtValues(text).length === 0) return text;
  }
  return null;
}

function writeFile(root, path, text) {
  const target = join(root, path);
  if (text === null) {
    rmSync(target, { force: true });
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  git(['add', '--all', '--', path], { cwd: root });
}

/** Commits staged changes; returns false if there was nothing to commit. */
function commit(root, message, author) {
  if (spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root }).status === 0) return false;
  git(['commit', '--quiet', '-m', message, ...(author ? ['--author', author] : [])], { cwd: root });
  return true;
}

// --- GitHub ------------------------------------------------------------------

const REPO = process.env.GITHUB_REPOSITORY;
const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';
const MERGE_METHOD = process.env.SCHEDULED_MERGE_METHOD || 'squash';

async function api(method, path, body) {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    error.status = res.status;
    throw error;
  }
  return res.status === 204 ? null : res.json();
}

/** Open scheduled-publish PRs from this repo, soonest first. */
async function scheduledPrs() {
  const prs = [];
  for (let page = 1; ; page++) {
    const batch = await api('GET', `/pulls?state=open&per_page=100&page=${page}`);
    prs.push(...batch);
    if (batch.length < 100) break;
  }
  return prs
    .filter((pr) => pr.head.repo?.full_name === REPO && pr.head.ref.startsWith(BRANCH_PREFIX))
    .map((pr) => ({ ...pr, publishAt: Date.parse(MARKER_RE.exec(pr.body ?? '')?.[1] ?? '') }))
    .filter((pr) => !Number.isNaN(pr.publishAt))
    .sort((a, b) => a.publishAt - b.publishAt);
}

async function ensureLabel() {
  try {
    await api('POST', '/labels', {
      name: LABEL,
      color: 'f5a623',
      description: 'Pages CMS edit waiting for its publish_at time',
    });
  } catch (error) {
    if (error.status !== 422) throw error; // 422: already exists
  }
}

async function commentOnce(number, marker, body) {
  const comments = await api('GET', `/issues/${number}/comments?per_page=100`);
  if (comments.some((c) => c.body?.includes(marker))) return;
  await api('POST', `/issues/${number}/comments`, { body: `${body}\n\n${marker}` });
}

function prBody(publishAt, zone, files) {
  return [
    `Scheduled content update — publishes **${formatWhen(publishAt, zone)}**.`,
    '',
    'Opened automatically because a Pages CMS save set **Publish at**. The ' +
      '`Scheduled publish` workflow merges this PR at that time. It checks every ' +
      '15 minutes, so the update can go out up to ~15 minutes late (longer if ' +
      'GitHub Actions is busy). Other saves scheduled for the same date and time ' +
      'are added to this PR.',
    '',
    '- **Preview:** use the Netlify deploy preview on this PR.',
    '- **Publish now:** merge this PR.',
    '- **Cancel:** close this PR.',
    '',
    '**Files**',
    ...files.map((file) => `- \`${file}\``),
    '',
    `<!-- scheduled-publish-at: ${new Date(publishAt).toISOString()} -->`,
  ].join('\n');
}

function escapeHtml(text) {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

/** The CMS "Scheduled updates" page, written the way Pages CMS writes JSON. */
function dashboard(prs, zone, now) {
  if (prs.length === 0) {
    return JSON.stringify(
      {
        status:
          '<p>No updates scheduled. Set <strong>Publish at</strong> on any page to schedule one.</p>',
      },
      null,
      2,
    );
  }
  const items = prs.map((pr) => {
    const link = `<a href="${escapeHtml(pr.html_url)}" target="_blank">#${pr.number}</a>`;
    const overdue = pr.publishAt <= now ? ' — <strong>overdue, see the PR</strong>' : '';
    return `<li><p>${link} · ${escapeHtml(formatWhen(pr.publishAt, zone))}${overdue}</p></li>`;
  });
  return JSON.stringify({ status: `<ul>${items.join('')}</ul>` }, null, 2);
}

function changedFiles(branch) {
  return git(['diff', '--name-only', `origin/main...origin/${branch}`])
    .trim()
    .split('\n')
    .filter(Boolean);
}

// --- run ---------------------------------------------------------------------

/** Merges every scheduled PR that is due. Returns how many were merged. */
async function publishDue(now) {
  let merged = 0;
  for (const pr of await scheduledPrs()) {
    if (pr.publishAt > now) continue;
    const branch = pr.head.ref;
    try {
      // Bring the branch up to date first so GitHub's line-based merge can't
      // trip over other edits made on main since it was scheduled.
      const synced = await withWorktree(branch, `origin/${branch}`, (dir) =>
        syncWithMain(dir, 'origin/main'),
      );
      if (synced) git(['push', '--quiet', 'origin', `${branch}:${branch}`]);
      const sha = git(['rev-parse', branch]).trim();
      for (let attempt = 1; ; attempt++) {
        try {
          await api('PUT', `/pulls/${pr.number}/merge`, {
            merge_method: MERGE_METHOD,
            commit_title: `${pr.title} (#${pr.number})`,
            sha,
          });
          break;
        } catch (error) {
          // Right after a push GitHub may still be computing mergeability.
          if (!synced || attempt === 5 || ![405, 409].includes(error.status)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      await api('DELETE', `/git/refs/heads/${branch}`).catch(() => {});
      console.log(`Published #${pr.number}`);
      merged++;
    } catch (error) {
      console.log(`::warning::Could not merge #${pr.number}: ${error.message}`);
      await commentOnce(
        pr.number,
        BLOCKED_MARKER,
        `⚠️ This was due to publish but couldn't be merged automatically: ${error.message}. ` +
          'Resolve it and merge by hand, or push a fix and the next scheduled run will retry.',
      );
    }
  }
  return merged;
}

/**
 * Moves every pending `publish_at` save on `main` into its scheduled PR (or,
 * if the time has already passed, simply clears the date so it goes live).
 * Returns whether site content on `main` changed.
 */
async function intercept(now, zone) {
  const held = [];
  for (const path of contentFiles()) {
    const after = readFileSync(path, 'utf8');
    const values = publishAtValues(after);
    if (values.length === 0) continue;
    // Several dates in one save: wait for the latest, so nothing goes early.
    const publishAt = Math.max(...values.map((v) => parsePublishAt(v, zone)));
    const [name, email] = git(['log', '-1', '--format=%an%x00%ae', 'origin/main', '--', path])
      .trim()
      .split('\0');
    held.push({
      path,
      publishAt,
      base: baseVersion(path),
      stripped: blankPublishAt(after),
      author: `${name} <${email}>`,
      subject: git(['log', '-1', '--format=%s', 'origin/main', '--', path]).trim(),
    });
  }
  if (held.length === 0) return false;

  const due = held.filter((h) => h.publishAt <= now);
  const later = held.filter((h) => h.publishAt > now);

  // 1. Take the held saves back off main; due ones just lose their date.
  for (const h of due) writeFile('.', h.path, h.stripped);
  for (const h of later) writeFile('.', h.path, h.base);
  const lines = [
    ...later.map((h) => `- ${h.path}: held until ${formatWhen(h.publishAt, zone)}`),
    ...due.map((h) => `- ${h.path}: publish_at already passed, publishing now`),
  ];
  commit('.', `chore(schedule): move scheduled CMS edits off main\n\n${lines.join('\n')}`);

  // 2. Re-apply each held save on its slot's branch, one PR per slot. New
  //    branches start from the commit above so their PRs diff against a main
  //    without the edit.
  const openPrs = await scheduledPrs();
  const slots = [];
  for (const [publishAt, saves] of Map.groupBy(later, (h) => h.publishAt)) {
    const branch = branchFor(publishAt);
    const pr = openPrs.find((p) => p.head.ref === branch);
    const reuse = Boolean(pr) && remoteBranchExists(branch);
    const main = git(['rev-parse', 'HEAD']).trim();
    await withWorktree(branch, reuse ? `origin/${branch}` : 'HEAD', async (dir) => {
      let path = '';
      try {
        // An existing branch first takes main (including the commit above),
        // so each save merges against the version it was made on.
        if (reuse) syncWithMain(dir, main);
        for (const h of saves) {
          path = h.path;
          const ours = show('HEAD', h.path, dir);
          // The newer save wins, so re-saving a scheduled field replaces it.
          writeFile(dir, h.path, mergeFile(ours, h.base, h.stripped, 'theirs', h.path));
          commit(dir, `${h.subject}\n\nScheduled for ${formatWhen(publishAt, zone)}.`, h.author);
        }
      } catch (error) {
        if (pr && error instanceof ConflictError) {
          await commentOnce(
            pr.number,
            `<!-- scheduled-publish-conflict:${path || 'main'}:${main} -->`,
            `⚠️ A Pages CMS save${path ? ` to \`${path}\`` : ''} scheduled for this time ` +
              `conflicts with this PR (${error.message}), so it is still on \`main\` and the ` +
              `site is not deploying. ${CONFLICT_HELP}`,
          );
        }
        throw error;
      }
    });
    slots.push({ publishAt, branch, pr, reuse });
  }

  // 3. One atomic push, so main never loses an edit its PR doesn't have.
  //    Branches without an open PR (cancelled slots) are overwritten.
  git([
    'push',
    '--quiet',
    '--atomic',
    'origin',
    'HEAD:main',
    ...slots.map((s) => `${s.reuse ? '' : '+'}${s.branch}:${s.branch}`),
  ]);
  git(['fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*']);

  for (const { publishAt, branch, pr } of slots) {
    const body = prBody(publishAt, zone, changedFiles(branch));
    if (pr) {
      await api('PATCH', `/pulls/${pr.number}`, { body });
      console.log(`Updated #${pr.number} (${branch})`);
    } else {
      await openPr(branch, publishAt, zone);
    }
  }
  return due.length > 0;
}

async function openPr(branch, publishAt, zone) {
  const title = `Scheduled publish: ${formatWhen(publishAt, zone)}`;
  const body = prBody(publishAt, zone, changedFiles(branch));
  let created;
  try {
    created = await api('POST', '/pulls', { title, body, head: branch, base: 'main' });
  } catch (error) {
    if (error.status === 403) {
      error.message +=
        ' — turn on Settings → Actions → General → "Allow GitHub Actions to create and approve' +
        ` pull requests". The edit is safe on ${branch}; the next run opens its PR.`;
    }
    throw error;
  }
  await api('POST', `/issues/${created.number}/labels`, { labels: [LABEL] });
  console.log(`Opened #${created.number} (${branch})`);
}

/**
 * Opens a PR for any scheduled branch that never got one — e.g. because PR
 * creation failed after the edit had already been moved off main. Branches
 * whose PR was closed (cancelled) are left alone.
 */
async function recoverOrphans(zone) {
  const owner = REPO.split('/')[0];
  const refs = git([
    'for-each-ref',
    '--format=%(refname:lstrip=3)',
    `refs/remotes/origin/${BRANCH_PREFIX}`,
  ])
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const branch of refs) {
    const m = /^scheduled\/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})Z$/.exec(branch);
    if (!m || changedFiles(branch).length === 0) continue;
    const prs = await api('GET', `/pulls?state=all&head=${owner}:${encodeURIComponent(branch)}`);
    if (prs.length > 0) continue;
    console.log(`Recovering ${branch}, which has no PR`);
    await openPr(branch, Date.parse(`${m[1]}:${m[2]}:00Z`), zone);
  }
}

async function run() {
  if (!REPO || !process.env.GH_TOKEN)
    throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required');
  const now = Date.now();
  await ensureLabel();

  git(['fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*', '--prune']);
  git(['checkout', '--quiet', '-B', 'main', 'origin/main']);
  const zone = timezone();
  // Clear main of held saves first, so due branches sync against clean content.
  const publishedNow = await intercept(now, zone);
  await recoverOrphans(zone);
  const published = await publishDue(now);

  git(['fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*', '--prune']);
  git(['checkout', '--quiet', '-B', 'main', 'origin/main']);
  writeFile('.', DASHBOARD, dashboard(await scheduledPrs(), zone, now));
  if (commit('.', 'chore(schedule): update Pages CMS scheduled updates list')) {
    git(['push', '--quiet', 'origin', 'HEAD:main']);
  }

  // Pushes made with GITHUB_TOKEN don't start other workflows, so nudge the
  // profile README rebuild ourselves when site content changed.
  if (published > 0 || publishedNow) {
    await api('POST', '/actions/workflows/notify-profile.yml/dispatches', { ref: 'main' }).catch(
      (error) => console.log(`::warning::Could not trigger notify-profile: ${error.message}`),
    );
  }
}

/**
 * Netlify `ignore` hook: exit 0 skips the build. Skips commits whose content
 * is still waiting to be moved into a scheduled PR (so it never goes live
 * early), and commits that only touch the CMS scheduled-updates list.
 */
function netlifyIgnore() {
  if (hasPendingContent()) {
    console.log(
      'Skipping build: src/content has a pending publish_at (scheduled-publish holds it).',
    );
    process.exit(0);
  }
  const { CACHED_COMMIT_REF: from, COMMIT_REF: to } = process.env;
  if (from && to && from !== to) {
    const result = spawnSync('git', ['diff', '--name-only', from, to], { encoding: 'utf8' });
    const changed = result.stdout?.trim().split('\n').filter(Boolean) ?? [];
    if (
      result.status === 0 &&
      changed.length > 0 &&
      changed.every((f) => f.startsWith('.pages/'))
    ) {
      console.log('Skipping build: only the Pages CMS scheduled-updates list changed.');
      process.exit(0);
    }
  }
  process.exit(1);
}

const command = process.argv[2];
if (command === 'run') {
  run().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exit(1);
  });
} else if (command === 'pending') {
  console.log(hasPendingContent() ? 'true' : 'false');
} else if (command === 'netlify-ignore') {
  netlifyIgnore();
} else {
  console.error('usage: scheduled-publish.mjs run | pending | netlify-ignore');
  process.exit(2);
}
