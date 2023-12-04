// ────────────────────────────────────────────────────────────────────────────────
//
// Name: index.js
// Desc: Initialise main functions and helpers.
//
// ────────────────────────────────────────────────────────────────────────────────

"use strict";

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
	disableContextMenu();
});