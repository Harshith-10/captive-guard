# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-04-29

### Added
- **Two-Tab Enforcement**: Restricts the browser to only two tabs: the Exam site and the Captive Portal.
- **Automatic Tab Management**: Closes unauthorized tabs and restores the required tabs if they are closed.
- **Captive Portal Monitoring**: Automatically detects network authentication state and switches focus to the portal when needed.
- **Session Persistence**: Remembers the last exam URL and authentication state across browser restarts.
- **Smart Reload**: Automatically reloads the exam tab upon the first successful network login to ensure the page is correctly loaded.
- **Security Hardening**: Prevents navigation away from the exam environment and maintains focus during active sessions.
