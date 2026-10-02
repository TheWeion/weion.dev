import type { Experience, Operative, Project } from '@/types';
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
  role: 'SEEKING SENIOR SOFTWARE ENGINEER / FRONTEND DEVELOPER ROLES',
  affiliation: null,
  location: 'EARTH // SOL SYSTEM',
  timezone: 'UTC+01:00',
  status: 'AVAILABLE',
  tagline:
    'Lover of all things code — currently seeking my next adventure in software engineering. I am a full-stack developer with a passion for building performant, accessible, and maintainable web applications.',
};

/**
 * Long-form bio paragraph rendered in {@link DossierSection}.
 */
export const bio =
  'I have always been fascinated with technology and development in computing; there is so much potential to create marvels that have the potential to change our lives for the better. Coding is about solving one big problem and once I do, the feeling drives me to become better. Outside of work I love gaming, particularly tabletop role-playing games such as Dungeons and Dragons which I try to play every week — I also enjoy reading sci-fi novels while I am travelling.';

/**
 * Employment and training history rendered as the SERVICE RECORD timeline in
 * {@link DossierSection}.
 *
 * @remarks
 * Newest first — rendered in array order. Copied by hand from the LinkedIn
 * Experience section (no public API exposes profile positions). Optional
 * `location`, `summary`, and `skills` fill the record modal. Dates are `YYYY-MM`; `end: null`
 * means ongoing.
 */
export const experience: Experience[] = [
  {
    org: 'VANTIVA',
    role: 'SENIOR SOFTWARE ENGINEER',
    start: '2025-09',
    end: '2026-10',
    location: 'SHIPLEY, UK · REMOTE',
    summary: [
      'In my role, I contributed to the development of innovative software solutions, including the HomeSight app for care homes. I collaborated with a diverse agile team, focusing on enhancing user experience and ensuring effective communication with stakeholders. My work on TV products further honed my skills in managing projects under tight deadlines and confidentiality agreements.',
    ],
    skills: ['JavaScript', 'TypeScript'],
  },
  {
    org: 'VANTIVA',
    role: 'SOFTWARE ENGINEER',
    start: '2024-01',
    end: '2025-09',
    location: 'SHIPLEY, UK · REMOTE',
    summary: [
      'In my role as a Software Engineer at Vantiva, I contributed to a globally distributed agile team, focusing on delivering innovative solutions for clients. I played a key role in enhancing the set-top box UI stack and developed applications for Android, iOS, and TV platforms. My work aimed to improve user engagement and streamline the viewing experience for customers.',
    ],
    skills: ['JavaScript', 'TypeScript'],
  },
  {
    org: 'COMMSCOPE',
    role: 'SOFTWARE ENGINEER',
    start: '2023-02',
    end: '2024-01',
    location: 'SHIPLEY, UK · REMOTE',
    summary: [
      'I work with a large, global agile team on TV set-top boxes for a major IPTV and broadcasting company in Australia. Utilising a bespoke JavaScript framework to develop and refactor the user interface codebase to enhance the user experience for our customers.',
    ],
    skills: ['JavaScript', 'CSS'],
  },
  {
    org: 'LA FOSSE ACADEMY',
    role: 'SOFTWARE ASSOCIATE',
    start: '2022-08',
    end: '2022-12',
    location: 'LONDON, UK · REMOTE',
    summary: [
      'Certificate of Course Completion at futureproof. This certificate confirms that I have completed my 13-week intensive training at futureproof where I studied the main areas of web development, including JavaScript, HTML/CSS, Databases, and Python and applied that knowledge to our group projects to make great software that follows best practice.',
    ],
    skills: ['Software Development', 'Agile Methodologies', 'JavaScript', 'HTML/CSS', 'Python'],
  },
  {
    org: 'LA FOSSE ACADEMY',
    role: 'TECH TRAINEE',
    start: '2022-05',
    end: '2022-08',
    location: 'LONDON, UK · REMOTE',
    summary: [
      'As a Tech Trainee at futureproof, I undertook a 13-week training scheme that developed my software engineering skills, preparing me for a career in the tech industry.',
      'Through this experience, I gained demonstrative experience with web development using languages like JavaScript, HTML/CSS, and Python, as well as databases like PostgreSQL and MongoDB. I also used testing suites like Jest, pytest, and Enzyme across multiple coding languages during my projects.',
      'In addition, I worked within a group to produce a total of 4 projects using industry-standard coding and project management practices. This included working as part of a team to ensure that deadlines were met to a professional standard. Overall, this role provided me with the experience and skills necessary to start my career in the tech industry.',
    ],
    skills: [
      'JavaScript',
      'HTML/CSS',
      'Python',
      'PostgreSQL',
      'MongoDB',
      'Jest',
      'pytest',
      'Enzyme',
    ],
  },
  {
    org: 'BT',
    role: 'CUSTOMER CARE ADVISOR',
    start: '2022-03',
    end: '2022-05',
    location: 'ACCRINGTON, UK · HYBRID',
  },
  {
    org: 'BT',
    role: 'RESOURCE SCHEDULING ANALYST (SECONDED)',
    start: '2021-06',
    end: '2022-03',
    location: 'ACCRINGTON, UK · REMOTE',
    summary: [
      'As a Seconded Resource Scheduling Analyst at BT, I was responsible for managing the schedules of agents in multiple call centers. My main goal was to ensure that service levels were stable and met the needs of customers and the business.',
      "In this role, I gained experience with scheduling and forecasting using industry-standard WFM tools like NICE IEX. I also developed advanced Excel skills, which were essential for conducting analysis and reporting, as well as implementing automation principles to improve efficiency within our team's workflow.",
      'In addition, I had to communicate with employees from all lines of business, including Heads of. This required excellent communication skills and the ability to work effectively with people at all levels of the organization. Overall, this role allowed me to develop a wide range of skills and gain valuable experience in the field of resource scheduling.',
    ],
    skills: ['NICE IEX', 'Microsoft Excel', 'Forecasting', 'Automation'],
  },
  {
    org: 'BT',
    role: 'CUSTOMER CARE ADVISOR',
    start: '2020-01',
    end: '2021-06',
    location: 'ACCRINGTON, UK · REMOTE',
    skills: ['Problem Solving', 'Microsoft Excel'],
  },
  {
    org: 'BT',
    role: 'CASE MANAGER',
    start: '2019-08',
    end: '2020-01',
    location: 'ACCRINGTON, UK · ON-SITE',
    summary: [
      'As a Case Manager at BT, I was responsible for managing and supporting customers who had complex issues with their Fibre to the Premise (FTTP) services. In this role, I relied on the interpersonal skills I had developed over my tenure to provide a personal touch to my interactions with customers.',
      "I also had to have a thorough knowledge of the backend systems used by BT and Openreach to investigate the status of orders and fix any discrepancies. This involved communicating with backend teams and correcting data integrity issues myself to ensure that BT's customers received their services and were kept up-to-date.",
      'To keep in contact with my customers and keep them updated, I used an IP phone. I also tracked their complaints and ensured that they were resolved and fed back according to BT and Ofcom policy, showing that we took their issues seriously. Overall, this role allowed me to utilize my skills and knowledge to help customers with their FTTP services.',
    ],
    skills: ['Analytical Skills', 'Data Integrity'],
  },
  {
    org: 'BT',
    role: 'CUSTOMER CARE ADVISOR',
    start: '2019-07',
    end: '2019-08',
    location: 'ACCRINGTON, UK · ON-SITE',
    summary: [
      'As a Customer Care Advisor at BT, I was responsible for servicing customers in the Fibre to the Premise (FTTP) space during their order journey. My main focus was on providing a personal service to the customer and managing their expectations.',
      'To fulfil this role, I was trained to use new tools and utilize my pre-existing knowledge of order management and data integrity to ensure that orders were processed correctly in our back-end systems and matched all of our databases.',
      "Unlike FTTC Customer Care, this role involved both inbound and outbound/offline communication with customers and suppliers during jeopardy periods and to repair orders and deal with customer complaints. This allowed me to gain experience in technical knowledge of Openreach's network in regards to FTTP and Copper provision/faults, as well as strengthening my skills in data integrity and administration.",
      'In addition, this role required me to have conflict resolution skills, particularly in high-stress situations that affected both the customer and the business. I also gained experience with Oracle and CRM systems, including the use of workarounds to do my job effectively. Overall, this role provided me with a wide range of skills and experience in customer care.',
    ],
    skills: ['Problem Solving', 'Conflict Resolution', 'Oracle', 'CRM'],
  },
  {
    org: 'BT',
    role: 'CASE MANAGER',
    start: '2019-06',
    end: '2019-07',
    location: 'ACCRINGTON, UK · ON-SITE',
    summary: [
      "As a Case Manager at BT, I was responsible for handling cases where the company's customers were experiencing lengthy delays or needed a direct point of contact with a team dedicated to their case. This often required extensive investigation to come to the right resolution.",
      "To fulfill this role, I utilized outbound and offline communication with customers and suppliers, strengthening my technical knowledge of Openreach's network in regards to FTTC and Copper provision/faults. This role also required critical thinking skills to fact-find and investigate various backend systems to ensure that I was doing the right thing by the customer and the business.",
      "Overall, this role provided me with experience in outbound and offline communication, as well as a deeper understanding of Openreach's network and the critical thinking skills needed to effectively handle complex cases.",
    ],
    skills: ['Analytical Skills', 'Critical Thinking'],
  },
  {
    org: 'BT',
    role: 'CUSTOMER CARE ADVISOR',
    start: '2018-01',
    end: '2019-06',
    location: 'ACCRINGTON, UK · ON-SITE',
    summary: [
      "As a Customer Care Advisor at BT, I was responsible for servicing customers during their order journey, ensuring that they got and remained connected to the company's services. My main focus was on providing a personal service to the customer and managing their expectations.",
      "To fulfill this role, I gained experience in inbound, outbound, and offline communication with customers and suppliers. I also developed technical knowledge of Openreach's network in regards to FTTC and Copper provision/faults.",
      "Overall, this role provided me with experience in various forms of communication and a deeper understanding of Openreach's network, allowing me to effectively support customers during their order journey.",
    ],
  },
  {
    org: 'FREELANCE',
    role: 'WEB DEVELOPER',
    start: '2017-03',
    end: '2017-10',
    location: 'BURNLEY, UK · REMOTE',
    summary: [
      'As a Freelance Web Developer, I aided in designing and developing an E-commerce website to handle grocery shopping orders. I used HTML5, JavaScript, and CSS3 to design and code the website, while adhering to the W3C standards. I also utilized web-hooks and open-source APIs to find product and stock information. This role further developed my coding skills and taught me how to work with customers to produce a functional and professional looking website.',
    ],
    skills: ['HTML5', 'JavaScript', 'CSS3'],
  },
];

/**
 * Formal education rendered as the EDUCATION timeline in {@link DossierSection},
 * below the service record. Same shape and ordering rules as {@link experience}.
 */
export const education: Experience[] = [
  { org: 'OPEN UNIVERSITY', role: 'SOFTWARE ENGINEERING & COMPUTING', start: '2020', end: null },
];

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
  'Figma',
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
  'Figma',
];

/**
 * Project entries rendered in {@link ArchiveSection}.
 *
 * @remarks
 * Sourced from `projects.json` alongside this file so non-developers can edit
 * project copy without touching TypeScript. The shape is type-checked against
 * the {@link Project} interface at build time by `tsc`.
 */
export const projects: Project[] = projectsData;

/**
 * External profile links rendered in the hero CTAs and {@link BottomChrome}.
 */
export const socials = {
  github: 'https://github.com/TheWeion',
  linkedin: 'https://www.linkedin.com/in/terryfallows/',
  email: 'mailto:ianterryfallows@gmail.com',
} as const;
