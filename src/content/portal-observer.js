function checkSignInStatus() {
	const caption = document.getElementById("signin-caption");
	if (!caption) return;

	const text = caption.innerText || caption.textContent;

	if (text?.includes("You are signed in as")) {
		browser.runtime.sendMessage({ type: "PORTAL_AUTHENTICATED" });
	}
}

// Check immediately on load
checkSignInStatus();

// Set up a mutation observer to watch for DOM changes if the sign-in is done via AJAX/JS
const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		if (mutation.type === "childList" || mutation.type === "characterData") {
			checkSignInStatus();
		}
	}
});

observer.observe(document.body, {
	childList: true,
	subtree: true,
	characterData: true,
});
