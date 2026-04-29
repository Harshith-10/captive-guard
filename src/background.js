import {
	EXAM_INITIAL_URL,
	loadState,
	PING_URL,
	PORTAL_URL,
	saveState,
	state,
} from "./shared/state.js";

// Global state to prevent infinite loops during programmatic tab creations
let systemTabOperationsCount = 0;
let isInitializing = false;

// Initialize the allowed tabs
async function initTabs() {
	if (isInitializing) return;
	isInitializing = true;

	try {
		await loadState();

	const allTabs = await browser.tabs.query({});

	let foundPortalTab = null;
	let foundExamTab = null;

	// Identify if we already have the required tabs
	for (const tab of allTabs) {
		const url = tab.url || tab.pendingUrl || "";
		const isPortalUrl = url.includes("172.16.0.254");
		const isExamUrl = url.includes("buildit.iare.ac.in");

		if (isPortalUrl && !foundPortalTab) {
			foundPortalTab = tab;
			state.portalTabId = tab.id;
		} else if (isExamUrl && !foundExamTab) {
			foundExamTab = tab;
			state.examTabId = tab.id;
		}
	}

	systemTabOperationsCount++;
	try {
		// Create missing tabs FIRST so we don't accidentally reach 0 tabs
		if (!foundPortalTab) {
			const portalTab = await browser.tabs.create({
				url: PORTAL_URL,
				active: !state.isAuthenticated,
			});
			state.portalTabId = portalTab.id;
		}

		if (!foundExamTab) {
			const urlToLoad = state.lastExamUrl || EXAM_INITIAL_URL;
			const examTab = await browser.tabs.create({
				url: urlToLoad,
				active: state.isAuthenticated,
			});
			state.examTabId = examTab.id;
		}
	} finally {
		systemTabOperationsCount--;
	}

	await saveState();

	// Now, safely close any tab that isn't our designated portal or exam tab
	for (const tab of allTabs) {
		if (tab.id !== state.portalTabId && tab.id !== state.examTabId) {
			try {
				await browser.tabs.remove(tab.id);
			} catch (e) {
				console.log("Failed to remove tab", e);
			}
		}
	}
	} finally {
		isInitializing = false;
	}
}

// Ensure tabs exist and limit to exactly 2
browser.tabs.onCreated.addListener(async (tab) => {
	// Ignore if we are programmatically creating our own system tabs
	if (systemTabOperationsCount > 0) return;

	if (tab.id === state.portalTabId || tab.id === state.examTabId) return;

	// Close any unauthorized tabs immediately
	try {
		await browser.tabs.remove(tab.id);
	} catch (e) {
		console.log("Failed to remove unauthorized tab", e);
	}
});

// Enforce active tab based on authentication state
browser.tabs.onActivated.addListener(async (activeInfo) => {
	if (!state.portalTabId || !state.examTabId) return;
	const targetTabId = state.isAuthenticated
		? state.examTabId
		: state.portalTabId;

	if (targetTabId && activeInfo.tabId !== targetTabId) {
		// If the activated tab is not the target tab, switch back
		await browser.tabs.update(targetTabId, { active: true });
	}
});

// Reopen tabs if they are closed
browser.tabs.onRemoved.addListener(async (tabId) => {
	if (tabId === state.portalTabId) {
		systemTabOperationsCount++;
		try {
			const newTab = await browser.tabs.create({
				url: PORTAL_URL,
				active: !state.isAuthenticated,
			});
			state.portalTabId = newTab.id;
			await saveState();
		} finally {
			systemTabOperationsCount--;
		}
	} else if (tabId === state.examTabId) {
		systemTabOperationsCount++;
		try {
			const newTab = await browser.tabs.create({
				url: state.lastExamUrl,
				active: state.isAuthenticated,
			});
			state.examTabId = newTab.id;
			await saveState();
		} finally {
			systemTabOperationsCount--;
		}
	}
});

// Track exam tab URL and redirect if it goes to portal while mid-exam
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, _) => {
	if (tabId === state.examTabId && changeInfo.url) {
		if (changeInfo.url.includes("172.16.0.254")) {
			// Exam tab got redirected to portal (likely session timeout)
			// Revert exam tab to its last known URL and focus the actual portal tab
			await browser.tabs.update(state.examTabId, { url: state.lastExamUrl });
			await browser.tabs.update(state.portalTabId, { active: true });
			state.isAuthenticated = false;
		} else {
			// Valid navigation within the exam tab, update last known state
			state.lastExamUrl = changeInfo.url;
			await saveState();
		}
	}
});

// Captive portal API updates (Firefox specific)
browser.captivePortal.onStateChanged.addListener(async (portalState) => {
	console.log("Captive portal state changed to:", portalState);
	if (portalState === "unlocked_portal" || portalState === "not_captive") {
		// Relying on content script and polling to confirm fully
		checkInternet();
	} else if (portalState === "locked_portal") {
		state.isAuthenticated = false;
		await browser.tabs.update(state.portalTabId, { active: true });
	}
});

// Periodic ping to check internet
async function checkInternet() {
	try {
		const res = await fetch(PING_URL, { cache: "no-store" });
		const text = await res.text();
		if (text.trim() === "success") {
			if (!state.isAuthenticated) {
				state.isAuthenticated = true;
				// Switch back to exam tab
				await browser.tabs.update(state.examTabId, { active: true });
				await saveState();
			}
		} else {
			handleDisconnect();
		}
	} catch (err) {
		handleDisconnect();
		console.log(err);
	}
}

async function handleDisconnect() {
	state.isAuthenticated = false;
	if (state.portalTabId) {
		await browser.tabs.update(state.portalTabId, { active: true });
	}
	await saveState();
}

// Interval setup
setInterval(checkInternet, 5000);

// Listen for messages from the portal content script
browser.runtime.onMessage.addListener(async (message) => {
	if (message.type === "PORTAL_AUTHENTICATED") {
		console.log("Portal authenticated via DOM check");
		state.isAuthenticated = true;
		await browser.tabs.update(state.examTabId, { active: true });
		await saveState();
	}
});

// Run startup
browser.runtime.onStartup.addListener(async () => {
	await loadState();
	initTabs();
});

browser.runtime.onInstalled.addListener(() => {
	initTabs();
});
