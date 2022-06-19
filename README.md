# Portfolio Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/a3309f19-bbdc-485b-a3ae-e96be0836b6f/deploy-status)](https://app.netlify.com/sites/futureproof-portfolio-terry/deploys)

> This project will showcase all my projects and achievements while on the Al-Jazari Cohort including any interesting topics about myself.

## Usage

* The live website can be accessed: [HERE](https://futureproof-portfolio-terry.netlify.app/)

## Changelog

### netlify.toml
[x] Added netlify.toml to force redirect of netlify.app domain to https://weion.social.

### index.html
[x] Implemented WebP for browsers that support it.

[x] Implemented skill marquee feature to header via CSS.

[x] Refactored Header with `clip-path` making the arrowhead `div` redundant.

[x] Added `muted` argument to video tag to attempt to fix WebM/MP4 autoplay on prod.

[x] Tabs > Whitespace - need I say more?

[x] Fix Card positioning on mobile devices.

[x] Added Project 1.

[x] Removed Dummy Project 1.

[x] Added Netlify Status badges.

[x] Refactored Bootstrap 5 imports to use bundle instead of separate files.

[x] Added Comments where appropriate.

[x] Converted CSS to Bootstrap class flags for styling (i.e Cards and Header).

[x] Added titles to buttons for accessibility.

[x] Redesigned favicon so that it is easier to see in Tabs and Windows.

[x] Improved Hyperlink UX - Open in new Tab.

[x] Redesigned Website with new header and social icons through Bootstrap and CSS.

[x] Added content from the training week such as website projects.

[x] Implemented Bootstrap.

### main.css
[x] Optimised CSS file.

[x] Fixed defect with futureproof SVG logo button on Mozilla Firefox as `width` and `height` properties were not explictly defined per SVG spec.

[x] Optimised media queries to latest changes.

[x] Added Hover UX for Bootstrap cards.

[x] Added skill marquee feature to header.

[x] Refactored Header with `clip-path` making the arrowhead `div` redundant.

[x] Tabs > Whitespace - need I say more?

[x] Added Comments where appropriate.

[x] Cleaned up CSS utilising Bootstrap classes instead.

[x] Removed unneeded Media Query that was causing visual bug on iPhone SE and similar devices.

[x] Refactored H1 tag to get same effect as the previous implementation posed an accessability risk (e.g Screen Readers).

[x] Redesigned H1 Tag to use Horizontal Rule (centred underline) for desired efffect.

[x] Added Media Queries - Fixing Card scaling on large displays.

[x] Created `.disabled` id for Social Media buttons not currently in use.

[x] Redesigned Website with new header and social icons through Bootstrap and CSS.


### img/fp-logo.svg
[x] Added Anti-Aliasing to logo.

## TODO
[ ] **Design:** Implement marquee effect under header to showcase all programming / coding languages and concepts that I know, this will list multiple lines of text that are animated to move horizontally across the div.

## Bugs

[ ] **Accessibility Issue (🔴):**  At Div `social-icons-list` - Keyboard events work with <kbd>Enter</kbd> but not <kbd>Space</kbd>, and as anchor tags are being used this could confuse screen readers unless a new approach is taken.
