// ────────────────────────────────────────────────────────────────────────────────
//
// Name: index.js
// Desc: Initialise main functions and helpers.
//
// ────────────────────────────────────────────────────────────────────────────────

"use strict";

window.onload = function() {
	disableContextMenu();
}

// ─── Disable Context Menu ───────────────────────────────────────────────────────
// Desc: Disable context menu on right-click for Card IMG elements.
// ─────────────────────────────────────────────────────────────────────── UX ─────

function disableContextMenu() {
	const CARD_IMG = document.querySelector(".disableContextMenu");
	CARD_IMG.addEventListener("contextmenu", e => e.preventDefault());
}
