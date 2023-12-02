// ────────────────────────────────────────────────────────────────────────────────
//
// Name: index.js
// Desc: Initialise main functions and helpers.
//
// ────────────────────────────────────────────────────────────────────────────────

"use strict";

/**
 * @function generateMetaTags
 * @description Generates meta tags for SEO.
 * @param {string} title - The title to be used for the meta tags.
 * @param {string} description - The description to be used for the meta tags.
 * @param {string} imageUrl - The image URL to be used for the meta tags.
 * @param {Array<string>} platforms - The social media platforms for which to generate the appropriate meta tags.
 * @returns {string} - The meta tags as a string.
 */
const generateMetaTags = (title, description, imageUrl, platforms) => {
	const titleTag = `<meta property="title" content="${title}" />`;
	const descriptionTag = `<meta property="description" content="${description}" />`;

	const platformTags = [];

	for (let i = 0; i < platforms.length; i++) {
		const platform = platforms[i];

		if (platform === "facebook") {
			platformTags.push(
				`<meta property="og:type" content="website" />`,
				`<meta property="og:url" content="https://weion.dev/" />`,
				`<meta property="og:title" content="${title}" />`,
				`<meta property="og:description" content="${description}" />`,
				`<meta property="og:image" content="${imageUrl}" />`
			);
		} else if (platform === "twitter") {
			platformTags.push(
				`<meta name="twitter:card" content="summary_large_image" />`,
				`<meta name="twitter:url" content="https://weion.dev/" />`,
				`<meta name="twitter:title" content="${title}" />`,
				`<meta name="twitter:description" content="${description}" />`,
				`<meta name="twitter:image" content="${imageUrl}" />`
			);
		}
	}

	return `${titleTag}\n${descriptionTag}\n${platformTags.join("\n")}`;
};

const metaTags = generateMetaTags(
	'Terry Fallows | Software Engineer',
	'Welcome to my portfolio, I am a lover of all things code, currently enhancing STB UI/UX for customers at CommScope.',
	'https://weion.dev/assets/img/meta_img.webp',
	['facebook', 'twitter']
);

/**
 * @function disableContextMenu
 * @description Disables context menu on right-click for card IMG elements.
 */
const disableContextMenu = () => {
	const cardImg = document.querySelectorAll(".disableContextMenu");
	for (const img of cardImg) {
		img.addEventListener("contextmenu", e => e.preventDefault());
	}
};

document.addEventListener("DOMContentLoaded", () => {
	const lastMetaTag = document.querySelector('head > meta:last-of-type');
	if (lastMetaTag) {
		lastMetaTag.insertAdjacentHTML('afterend', metaTags);
	}
	disableContextMenu();
});