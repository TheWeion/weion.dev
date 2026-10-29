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
function show(ref, path) {
  const result = spawnSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

function remoteBranchExists(branch) {
  return spawnSync('git', ['rev-parse', '--verify', '--quiet', `origin/${branch}`]).status === 0;
}

/**
 * Three-way merge of one file's text, as `git merge-file` does it. Throws on
 * conflict so a clashing edit fails loudly instead of being dropped.
 */
function merge3(ours, base, theirs, path) {
  if (ours === base) return theirs;
  if (theirs === base || theirs === ours) return ours;
  const dir = mkdtempSync(join(tmpdir(), 'scheduled-publish-'));
  try {
    const files = { ours, base, theirs };
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text ?? '');
    const result = spawnSync(
      'git',
      ['merge-file', '-p', join(dir, 'ours'), join(dir, 'base'), join(dir, 'theirs')],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(
        `${path}: this edit conflicts with an earlier one scheduled for the same time`,
      );
    }
    return result.stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
    try {
      await api('PUT', `/pulls/${pr.number}/merge`, {
        merge_method: MERGE_METHOD,
        commit_title: `${pr.title} (#${pr.number})`,
        sha: pr.head.sha,
      });
      await api('DELETE', `/git/refs/heads/${pr.head.ref}`).catch(() => {});
      console.log(`Published #${pr.number}`);
      merged++;
    } catch (error) {
      console.log(`::warning::Could not merge #${pr.number}: ${error.message}`);
      await commentOnce(
        pr.number,
        BLOCKED_MARKER,
        `⚠️ This was due to publish but couldn't be merged automatically (\`${error.status}\`). ` +
          'Resolve the conflict or failing checks and merge it by hand, or push a fix and the ' +
          'next scheduled run will retry.',
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
    const worktree = mkdtempSync(join(tmpdir(), 'scheduled-branch-'));
    git([
      'worktree',
      'add',
      '--quiet',
      '-B',
      branch,
      worktree,
      reuse ? `origin/${branch}` : 'HEAD',
    ]);
    try {
      for (const h of saves) {
        const ours = show(branch, h.path);
        let merged;
        try {
          merged = merge3(ours, h.base, h.stripped, h.path);
        } catch (error) {
          if (pr) {
            await commentOnce(
              pr.number,
              `<!-- scheduled-publish-conflict:${h.path} -->`,
              `⚠️ A Pages CMS save to \`${h.path}\` scheduled for this time conflicts with ` +
                'an edit already in this PR, so it is still on `main` and the site is not ' +
                'deploying. Save that page again in the CMS so it no longer clashes (or with ' +
                '**Publish at** cleared to publish it now), or close this PR to cancel the ' +
                'earlier edit and schedule the new one on its own.',
            );
          }
          throw error;
        }
        writeFile(worktree, h.path, merged);
        commit(worktree, `${h.subject}\n\nScheduled for ${formatWhen(publishAt, zone)}.`, h.author);
      }
    } finally {
      git(['worktree', 'remove', '--force', worktree]);
    }
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
      const title = `Scheduled publish: ${formatWhen(publishAt, zone)}`;
      const created = await api('POST', '/pulls', { title, body, head: branch, base: 'main' });
      await api('POST', `/issues/${created.number}/labels`, { labels: [LABEL] });
      console.log(`Opened #${created.number} (${branch})`);
    }
  }
  return due.length > 0;
}

async function run() {
  if (!REPO || !process.env.GH_TOKEN)
    throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required');
  const now = Date.now();
  await ensureLabel();

  const published = await publishDue(now);

  git(['fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*', '--prune']);
  git(['checkout', '--quiet', '-B', 'main', 'origin/main']);
  const zone = timezone();
  const publishedNow = await intercept(now, zone);

  writeFile('.', DASHBOARD, dashboard(await scheduledPrs(), zone, now));
  if (commit('.', 'chore(schedule): update Pages CMS scheduled updates list')) {
    git(['push', '--quiet', 'origin', 'HEAD:main']);
  }

  // Pushes made with the default GITHUB_TOKEN don't start other workflows, so
  // nudge the profile README rebuild ourselves when site content changed.
  if ((published > 0 || publishedNow) && process.env.USING_APP_TOKEN !== 'true') {
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
