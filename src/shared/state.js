export const PORTAL_URL = "http://172.16.0.254:8090/httpclient.html";
export const EXAM_INITIAL_URL = "https://buildit.iare.ac.in/";
export const PING_URL = "https://detectportal.firefox.com/success.txt";

export const state = {
	examTabId: null,
	portalTabId: null,
	lastExamUrl: EXAM_INITIAL_URL,
	isAuthenticated: false,
	hasInitialLogin: false,
};

export async function saveState() {
	await browser.storage.local.set({ extensionState: state });
}

export async function loadState() {
	const data = await browser.storage.local.get("extensionState");
	if (data.extensionState) {
		state.examTabId = data.extensionState.examTabId;
		state.portalTabId = data.extensionState.portalTabId;
		state.lastExamUrl = data.extensionState.lastExamUrl || EXAM_INITIAL_URL;
		state.isAuthenticated = data.extensionState.isAuthenticated || false;
		state.hasInitialLogin = data.extensionState.hasInitialLogin || false;
	}
}
