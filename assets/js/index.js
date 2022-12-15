// ────────────────────────────────────────────────────────────────────────────────
//
// Name: index.js
// Desc: Initialise main functions and helpers.
//
// ────────────────────────────────────────────────────────────────────────────────

"use strict";

document.addEventListener("DOMContentLoaded", function() {
	disableContextMenu();
});

// ─── Generate Meta Tags ──────────────────────────────────────────────────────
// Desc: Generate meta tags for SEO.
// ─────────────────────────────────────────────────────────────────── SEO ─────

const generateMetaTags = (title, description, imageUrl, platforms) => {
	// Create the title tag
	const titleTag = `<meta property="title" content="${title}" />`;
	const descriptionTag = `<meta property="description" content="${description}" />`;

	// Create an array to hold the meta tags for each platform
	const platformTags = [];

	// Loop through the platforms array and generate the appropriate meta tags for each platform
	platforms.forEach(platform => {
	  if (platform === 'facebook') {
		// Add the Facebook meta tags
		platformTags.push(`<meta property="og:type" content="website" />`);
		platformTags.push(`<meta property="og:url" content="https://weion.social/" />`);
		platformTags.push(`<meta property="og:title" content="${title}" />`);
		platformTags.push(`<meta property="og:description" content="${description}" />`);
		platformTags.push(`<meta property="og:image" content="${imageUrl}" />`);

	  } else if (platform === 'twitter') {
		// Add the Twitter meta tags
		platformTags.push(`<meta name="twitter:card" content="summary_large_image" />`);
		platformTags.push(`<meta name="twitter:url" content="https://weion.social/" />`);
		platformTags.push(`<meta name="twitter:title" content="${title}" />`);
		platformTags.push(`<meta name="twitter:description" content="${description}" />`);
		platformTags.push(`<meta name="twitter:image" content="${imageUrl}" />`);
	  }
	});

	// Return the meta tags as a string
	return `${titleTag}\n${descriptionTag}\n${platformTags.join('\n')}`;
}

const metaTags = generateMetaTags(
	'Terry Fallows | Software Engineer',
	'Welcome to my portfolio, I am currently looking for my next adventure in code, developing great software and squashing bugs.',
	'https://weion.social/assets/img/meta_img.webp',
	['facebook', 'twitter']
);

const lastMetaTag = document.querySelector('head > meta:last-of-type');
lastMetaTag.insertAdjacentHTML('afterend', metaTags);

// ─── Disable Context Menu ───────────────────────────────────────────────────────
// Desc: Disable context menu on right-click for Card IMG elements.
// ─────────────────────────────────────────────────────────────────────── UX ─────

function disableContextMenu() {
	const CARD_IMG = document.querySelectorAll(".disableContextMenu");
	CARD_IMG.forEach(element => {
		element.addEventListener("contextmenu", e => e.preventDefault());
	});
};
