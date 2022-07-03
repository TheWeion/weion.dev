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

// ─── Disable Context Menu ───────────────────────────────────────────────────────
// 	Desc: Disable context menu on right-click for Card IMG elements.
// ─────────────────────────────────────────────────────────────────────── UX ─────

function disableContextMenu() {
	const CARD_IMG = document.querySelectorAll(".disableContextMenu");
	CARD_IMG.forEach(element => {
		element.addEventListener("contextmenu", e => e.preventDefault());
	});
};
