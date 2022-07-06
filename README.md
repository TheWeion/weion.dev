# Portfolio Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/a3309f19-bbdc-485b-a3ae-e96be0836b6f/deploy-status)](https://app.netlify.com/sites/futureproof-portfolio-terry/deploys)

> This project will showcase all my projects and achievements while on the Al-Jazari Cohort including any interesting topics about myself.

## Usage

* The live website can be accessed: [HERE](https://weion.social)

## Changelog

### assets/js/index.js

- [x] Refactored the code so the functions are executed when the DOM has loaded and not the entire page.

- [x] Refactored with a ForEach to iterate through the `disableContextMenu` class collection.

- [x] Initial Commit.

### netlify.toml

- [x] Added Cloudfront proxy link to `script-src` to allow for CSS optimisations.

- [x] Implemented post-processing and Search Engine Optimisations on Netlify - Updated CSP to allow media from cloudflare.

- [x] Removed URL from Feature-Policy path to fix error.

- [x] CSP 2: Electric Boogaloo (Reimplemented again).

- [x] Fixed CSP defect on Edge causing external SVGs being blocked on certain browsers.

- [x] Reimplemented CSP Header.

- [x] Implemented HTTP Security Headers.

- [x] Added netlify.toml to force redirect of netlify.app domain to https://weion.social.

### index.html

- [x] Added Meta tags.

- [x] Replaced `oncontextmenu` events with class `disableContextMenu` which links to index.js - Complies with CSP. 

- [x] Implemented ARIA roles to anchor buttons.

- [x] Updated `button` JS document calls to `anchor` tag `href` attributes for hyperlinks to comply with CSP.

- [x] Added `disablePictureInPicture` attribute to `<video>` tag.

- [x] Rerendered Project 1 video.

- [x] Added Project 2.

- [x] Removed Dummy Project 2.

- [x] Added Developer Stats section.

- [x] Implemented WebP for browsers that support it.

- [x] Implemented skill marquee feature to header via CSS.

- [x] Refactored Header with `clip-path` making the arrowhead `div` redundant.

- [x] Added `muted` argument to video tag to attempt to fix WebM/MP4 autoplay on prod.

- [x] Tabs > Whitespace - need I say more?

- [x] Fix Card positioning on mobile devices.

- [x] Added Project 1.

- [x] Removed Dummy Project 1.

- [x] Added Netlify Status badges.

- [x] Refactored Bootstrap 5 imports to use bundle instead of separate files.

- [x] Added Comments where appropriate.

- [x] Converted CSS to Bootstrap class flags for styling (i.e Cards and Header).

- [x] Added titles to buttons for accessibility.

- [x] Redesigned favicon so that it is easier to see in Tabs and Windows.

- [x] Improved Hyperlink UX - Open in new Tab.

- [x] Redesigned Website with new header and social icons through Bootstrap and CSS.

- [x] Added content from the training week such as website projects.

- [x] Implemented Bootstrap.

### assets/css/main.css

- [x] Implemented Media Query improvements for landscape mode on mobile devices.

- [x] Optimised CSS file.

- [x] Fixed defect with futureproof SVG logo button on Mozilla Firefox as `width` and `height` properties were not explictly defined per SVG spec.

- [x] Optimised media queries to latest changes.

- [x] Added Hover UX for Bootstrap cards.

- [x] Added skill marquee feature to header.

- [x] Refactored Header with `clip-path` making the arrowhead `div` redundant.

- [x] Tabs > Whitespace - need I say more?

- [x] Added Comments where appropriate.

- [x] Cleaned up CSS utilising Bootstrap classes instead.

- [x] Removed unneeded Media Query that was causing visual bug on iPhone SE and similar devices.

- [x] Refactored H1 tag to get same effect as the previous implementation posed an accessability risk (e.g Screen Readers).

- [x] Redesigned H1 Tag to use Horizontal Rule (centred underline) for desired efffect.

- [x] Added Media Queries - Fixing Card scaling on large displays.

- [x] Created `.disabled` id for Social Media buttons not currently in use.

- [x] Redesigned Website with new header and social icons through Bootstrap and CSS.


### img/fp-logo.svg

- [x] Added Anti-Aliasing to logo.

## TODO

- [ ] Get Netlify Deploy status badge from [@Tari38](https://github.com/Tari38) for project 2 to replace unofficial deploy badge using public API.

- [ ] Implement GitHub API to get total contributions across the year, or utilise React component for contribution calandar.

## Bugs

- [ ] **Accessibility Issue (🔴):**  At Div `social-icons-list` - Keyboard events work with <kbd>Enter</kbd> but not <kbd>Space</kbd>, and as anchor tags are being used this could confuse screen readers unless a new approach is taken.
