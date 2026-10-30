import type { Associate, Experience, Operative, Project } from '@/types';
import educationData from '../content/education.json';
import experienceData from '../content/experience.json';
import profileData from '../content/profile.json';
import projectsData from '../content/projects.json';
import skillsData from '../content/skills.json';
import { isValidTimeZone } from '../lib/timezone';

// Content lives in `src/content/*.json` and is edited through Pages CMS
// (`.pages.yml`). The CMS writes whatever the form holds — empty strings for
// cleared fields, `[]` for emptied lists — so everything is validated and
// normalized here. A malformed file throws at module load, which fails
// `yarn build` (vite.config.ts imports this module) instead of deploying a
// broken page.
//
// The JSON imports are relative rather than `@/content/...` because
// vite.config.ts loads this module before its own alias config applies.

type Json = Record<string, unknown>;

/** Throws a build-failing error pointing at the offending content path. */
function fail(path: string, expected: string): never {
  throw new Error(`[content] ${path}: expected ${expected}`);
}

function obj(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'an object');
  return value as Json;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'a list');
  return value;
}

function str(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'a non-empty string');
  return value;
}

/** Optional string — `undefined`, `null`, and `''` all mean "absent". */
function optStr(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return str(value, path);
}

/** Optional list of strings — blank entries are dropped, `[]` means "absent". */
function optStrList(value: unknown, path: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = arr(value, path)
    .filter((item) => item !== '' && item !== null)
    .map((item, i) => str(item, `${path}[${i}]`));
  return list.length > 0 ? list : undefined;
}

function strList(value: unknown, path: string): string[] {
  return optStrList(value, path) ?? [];
}

/**
 * Email address as a `mailto:` href. The CMS stores the bare address; a
 * leading `mailto:` is tolerated so older content keeps working.
 */
function mailto(value: unknown, path: string): string {
  const address = str(value, path)
    .trim()
    .replace(/^mailto:/i, '');
  if (!/^[^\s@]+@[^\s@]+$/.test(address)) fail(path, `an email address, got "${address}"`);
  return `mailto:${address}`;
}

/** IANA timezone name, validated against the build runtime's `Intl` data. */
function timeZone(value: unknown, path: string): string {
  const zone = str(value, path).trim();
  if (!isValidTimeZone(zone)) fail(path, `an IANA timezone (e.g. Europe/London), got "${zone}"`);
  return zone;
}

const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

function date(value: unknown, path: string): string {
  const s = str(value, path);
  if (!DATE_RE.test(s)) fail(path, `YYYY or YYYY-MM, got "${s}"`);
  return s;
}

function toExperience(value: unknown, path: string): Experience {
  const e = obj(value, path);
  const end = optStr(e.end, `${path}.end`);
  return {
    org: str(e.org, `${path}.org`),
    role: str(e.role, `${path}.role`),
    start: date(e.start, `${path}.start`),
    end: end === undefined ? null : date(end, `${path}.end`),
    location: optStr(e.location, `${path}.location`),
    summary: optStrList(e.summary, `${path}.summary`),
    skills: optStrList(e.skills, `${path}.skills`),
  };
}

function toProject(value: unknown, path: string): Project {
  const p = obj(value, path);
  const preview = p.preview == null ? undefined : obj(p.preview, `${path}.preview`);
  const webm = optStr(preview?.webm, `${path}.preview.webm`);
  const mp4 = optStr(preview?.mp4, `${path}.preview.mp4`);
  if (Boolean(webm) !== Boolean(mp4)) fail(`${path}.preview`, 'both webm and mp4, or neither');
  return {
    id: str(p.id, `${path}.id`),
    name: str(p.name, `${path}.name`),
    codename: str(p.codename, `${path}.codename`),
    summary: str(p.summary, `${path}.summary`),
    stack: strList(p.stack, `${path}.stack`),
    live: optStr(p.live, `${path}.live`) ?? '',
    fe: optStr(p.fe, `${path}.fe`) ?? '',
    be: optStr(p.be, `${path}.be`) ?? '',
    ...(webm && mp4 ? { preview: { webm, mp4 } } : {}),
  };
}

/**
 * Fails the build if a `publish_at` date is still set. Every CMS page has one
 * for scheduled publishing; `scripts/scheduled-publish.mjs` clears it as it
 * moves the save into its scheduled PR, so a value reaching a build means that
 * hand-off hasn't happened yet. Netlify's `ignore` hook normally skips that
 * build — this is the backstop that keeps the edit from going live early.
 */
function assertNotScheduled(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      assertNotScheduled(item, `${path}[${i}]`);
    });
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}${path.endsWith('.json') ? '#' : '.'}${key}`;
      if (key === 'publish_at' && typeof child === 'string' && child.trim() !== '') {
        throw new Error(
          `[content] ${childPath}: "${child}" is scheduled; the scheduled-publish workflow ` +
            'has not moved it into its PR yet',
        );
      }
      assertNotScheduled(child, childPath);
    }
  }
}

for (const [file, data] of Object.entries({
  'education.json': educationData,
  'experience.json': experienceData,
  'profile.json': profileData,
  'projects.json': projectsData,
  'skills.json': skillsData,
})) {
  assertNotScheduled(data, file);
}

const profile = obj(profileData, 'profile.json');
const operativeData = obj(profile.operative, 'profile.json#operative');
const socialsData = obj(profile.socials, 'profile.json#socials');
const skillGroups = obj(skillsData, 'skills.json');

/**
 * Operative profile shown in the HUD chrome and hero/dossier sections.
 *
 * @remarks
 * Single source of truth for the codename, real name, role, affiliation,
 * status, and focus fields rendered in {@link TopChrome}, {@link HeroSection},
 * and {@link DossierSection}. Edited via Pages CMS → `src/content/profile.json`.
 * Also read by `vite.config.ts` to build the page's meta tags.
 */
export const operative: Operative = {
  codename: str(operativeData.codename, 'profile.json#operative.codename'),
  realName: str(operativeData.realName, 'profile.json#operative.realName'),
  role: str(operativeData.role, 'profile.json#operative.role'),
  affiliation: optStr(operativeData.affiliation, 'profile.json#operative.affiliation') ?? null,
  location: str(operativeData.location, 'profile.json#operative.location'),
  timezone: timeZone(operativeData.timezone, 'profile.json#operative.timezone'),
  status: str(operativeData.status, 'profile.json#operative.status'),
  focus: optStr(operativeData.focus, 'profile.json#operative.focus') ?? null,
  tagline: str(operativeData.tagline, 'profile.json#operative.tagline'),
};

/**
 * Long-form bio paragraph rendered in {@link DossierSection}.
 */
export const bio = str(profile.bio, 'profile.json#bio');

/**
 * Rows of the KNOWN ASSOCIATES panel in {@link DossierSection}, in display
 * order. A missing or empty list hides the panel.
 */
export const associates: Associate[] = (
  profile.associates == null ? [] : arr(profile.associates, 'profile.json#associates')
).map((value, i) => {
  const path = `profile.json#associates[${i}]`;
  const a = obj(value, path);
  const detail = optStr(a.detail, `${path}.detail`);
  return { label: str(a.label, `${path}.label`), ...(detail ? { detail } : {}) };
});

/**
 * Employment and training history rendered as the SERVICE RECORD timeline in
 * {@link DossierSection}.
 *
 * @remarks
 * Newest first — rendered in array order. Copied by hand from the LinkedIn
 * Experience section (no public API exposes profile positions). Optional
 * `location`, `summary`, and `skills` fill the record modal. Dates are
 * `YYYY-MM`; an empty `end` means ongoing (`null`). Edited via Pages CMS →
 * `src/content/experience.json`.
 */
export const experience: Experience[] = arr(experienceData, 'experience.json').map((e, i) =>
  toExperience(e, `experience.json[${i}]`),
);

/**
 * Formal education rendered as the EDUCATION timeline in {@link DossierSection},
 * below the service record. Same shape and ordering rules as {@link experience}.
 */
export const education: Experience[] = arr(educationData, 'education.json').map((e, i) =>
  toExperience(e, `education.json[${i}]`),
);

/**
 * Sign-off label rendered in {@link EofSection} (the END OF FILE banner).
 */
export const signoff = str(profile.signoff, 'profile.json#signoff');

/**
 * Full skill list rendered as chips in {@link CapabilitiesSection}.
 *
 * @remarks
 * Order matters — items are rendered in array order. Newer / higher-priority
 * skills should be placed near the top.
 */
export const skills: string[] = strList(skillGroups.skills, 'skills.json#skills');

/**
 * Subset of {@link skills} highlighted as "core" capabilities. Rendered with
 * an amber accent in {@link CapabilitiesSection}.
 */
export const coreSkills: string[] = strList(skillGroups.coreSkills, 'skills.json#coreSkills');

/**
 * Project entries rendered in {@link ArchiveSection}.
 *
 * @remarks
 * Edited via Pages CMS → `src/content/projects.json`. Missing link fields are
 * normalized to `''` (which hides that link), and `preview` is dropped unless
 * both video sources are set.
 */
export const projects: Project[] = arr(projectsData, 'projects.json').map((p, i) =>
  toProject(p, `projects.json[${i}]`),
);

/**
 * External profile links rendered in the hero CTAs and {@link BottomChrome}.
 */
export const socials = {
  github: str(socialsData.github, 'profile.json#socials.github'),
  linkedin: str(socialsData.linkedin, 'profile.json#socials.linkedin'),
  /** `mailto:` href built from the bare address stored in the CMS. */
  email: mailto(socialsData.email, 'profile.json#socials.email'),
} as const;
