import type { Operative, Project } from '@/types';
import projectsData from './projects.json';

/**
 * Operative profile shown in the HUD chrome and hero/dossier sections.
 *
 * @remarks
 * Single source of truth for the codename, real name, role, affiliation, and
 * status fields rendered in {@link TopChrome}, {@link HeroSection}, and
 * {@link DossierSection}. Edit values here rather than in the section
 * components.
 */
export const operative: Operative = {
  codename: 'WEION',
  realName: 'TERRY FALLOWS',
  role: 'SENIOR SOFTWARE ENGINEER',
  affiliation: 'VANTIVA',
  location: 'EARTH // SOL SYSTEM',
  timezone: 'UTC+01:00',
  status: 'ACTIVE',
  tagline:
    'Lover of all things code — currently enhancing STB and Healthcare UI/UX for the customers of Vantiva.',
};

/**
 * Long-form bio paragraph rendered in {@link DossierSection}.
 */
export const bio =
  'I have always been fascinated with technology and development in computing; there is so much potential to create marvels that have the potential to change our lives for the better. Coding is about solving one big problem and once I do, the feeling drives me to become better. Outside of work I love gaming, particularly tabletop role-playing games such as Dungeons and Dragons which I try to play every week — I also enjoy reading sci-fi novels while I am travelling.';

/**
 * Sign-off label rendered in {@link EofSection} (the END OF FILE banner).
 */
export const signoff = 'END OF FILE';

/**
 * Full skill list rendered as chips in {@link CapabilitiesSection}.
 *
 * @remarks
 * Order matters — items are rendered in array order. Newer / higher-priority
 * skills should be placed near the top.
 */
export const skills: string[] = [
  'JavaScript',
  'TypeScript',
  'React',
  'Android',
  'iOS',
  'Node.js',
  'Express',
  'C++',
  'C#',
  'XAML',
  'MVVM',
  'PowerShell',
  'Bash',
  'SSH',
  'WSL',
  'Hyper-V',
  'Ghidra',
  'Performance Benchmarking',
  'Raspberry Pi',
  'Git',
  'GitHub Pages',
  'Websockets',
  'RESTful API',
  'CORS',
  'OAuth',
  'JSON',
  'NoSQL',
  'SQL',
  'SASS',
  'CSS',
  'Regex',
  'SEO',
  'Web Components',
  'Server-Side Rendering',
  'Data Binding',
  'NPM',
  'Jekyll',
  'Heroku',
  'Browserify',
  'FTP',
  'SCP',
  'YAML',
  'TOML',
  'ESNext',
  'Continuous Integration',
  'OOP',
  'Procedural Programming',
];

/**
 * Subset of {@link skills} highlighted as "core" capabilities. Rendered with
 * an amber accent in {@link CapabilitiesSection}.
 */
export const coreSkills: string[] = [
  'JavaScript',
  'TypeScript',
  'React',
  'Android',
  'iOS',
  'PowerShell',
  'Bash',
  'Performance Benchmarking',
];

/**
 * Project entries rendered in {@link ArchiveSection}.
 *
 * @remarks
 * Sourced from `projects.json` alongside this file so non-developers can edit
 * project copy without touching TypeScript. The shape is validated against
 * the {@link Project} interface at import time.
 */
export const projects: Project[] = projectsData;

/**
 * Re-exports of WakaTime-derived telemetry data consumed by
 * {@link TelemetrySection}.
 *
 * @remarks
 * `wakatime.generated.ts` is **auto-generated and gitignored**. It is written
 * by `scripts/fetch-wakatime.mjs` during the `predev` / `prebuild` lifecycle
 * hook: with `WAKATIME_API_KEY` set it pulls real stats from the WakaTime
 * API, and without the key it writes placeholder data so builds never fail.
 * Re-exporting here keeps the rest of the app importing from a single
 * `@/data/portfolio` site rather than reaching into the generated file
 * directly. See `CLAUDE.md` for the full env-var setup.
 */
export {
  telemetryBars,
  telemetryHeatmap,
  telemetryTiles,
  telemetryYearTiles,
} from './wakatime.generated';

/**
 * External profile links rendered in the hero CTAs and {@link BottomChrome}.
 */
export const socials = {
  github: 'https://github.com/TheWeion',
  email: 'mailto:ianterryfallows@gmail.com',
} as const;
