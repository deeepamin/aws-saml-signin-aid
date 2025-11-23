# AWS SAML Sign-in Aid

A Chrome extension that simplifies and enhances the login experience for AWS accounts via SAML 2.0.

## Why AWS SAML Sign-in Aid?

If you manage access to multiple AWS accounts and roles through a SAML Identity Provider (like Azure AD, Okta, or others), the standard AWS selection screen can be cumbersome. It often lacks search functionality, doesn't remember your frequently used roles, and doesn't handle session timeouts gracefully.

**AWS SAML Sign-in Aid** solves these problems by intercepting the SAML response and providing a modern, searchable, and feature-rich interface to manage your AWS logins.

## Key Features

### 🚀 Enhanced Login Interface
-   **Searchable List**: Instantly filter through hundreds of accounts and roles.
-   **Favorites**: Pin your most frequently used roles to the top for quick access.
-   **Clean UI**: A modern, responsive interface with Dark Mode support.

### 🔄 Smart Session Management
-   **Auto-Sync**: Automatically refreshes your SAML token in the background when it expires, so you're always ready to log in.
-   **Background Sync**: Performs the authentication flow in a background tab, keeping your workflow uninterrupted.
-   **Token Expiry Warning**: Visual indicators show when your SAML token is about to expire or has expired.

### 🔐 Multi-Session & Security
-   **Single-Session Mode (Default)**: Ensures a clean slate by logging you out of existing AWS sessions before signing into a new one. This prevents "stale session" errors.
-   **Multi-Session Support**: Optionally enable support for multiple simultaneous AWS console sessions.
-   **Sign Out of All Sessions**: A dedicated button (experimental) to securely clear all AWS-related cookies and log out of every active session at once.

### 🎨 Customization
-   **Name Cleaning**: Use Regular Expressions (Regex) to strip repetitive prefixes or suffixes from Account and Role names (e.g., remove `AWS-Reserved-SSO_`).
-   **Themes**: Choose between Light and Dark themes to match your system preference.

## Setup & Configuration

1.  **Install the Extension**.
2.  **Configure SAML URL**:
    -   Open the extension **Options** (right-click the icon -> Options).
    -   Enter your Identity Provider's generic SAML login URL (e.g., `https://myapps.microsoft.com/...`).
    -   This URL is used to initiate the authentication process.
3.  **Login**:
    -   Click the extension icon.
    -   Click the **Sync** button (refresh icon) to start the login flow.
    -   Once authenticated, your available AWS accounts and roles will appear in the popup.

## Options Explained

### Display Options
-   **Theme**: Toggle between Light and Dark mode.
-   **Token Expiry Warning**: Set how many minutes before actual expiry to show a warning (default: 5 mins).
-   **Clean Account/Role Names**: Enter Regex patterns to remove noise from names.
    -   *Example*: `^AWS-Reserved-SSO_` removes the common SSO prefix.

### Advanced Options
-   **Auto-sync on expiry**: If enabled, the extension will attempt to renew your SAML token automatically in the background.
-   **Sync in background**: Keeps the authentication tab invisible/unfocused during sync.
-   **Multi-Session Support**:
    -   **Enabled**: Allows you to open different roles in different tabs/windows without forcing a logout.
    -   **Disabled**: Forces a logout before every new login to prevent session conflicts.
    -   **Enable Sign Out of all sessions**: Adds a button to the popup to aggressively clear all AWS cookies and reload tabs.

## Permissions

This extension requires the following permissions to function:
-   `cookies`: To manage AWS session cookies for logout functionality.
-   `storage`: To save your settings and favorites.
-   `webRequest` / `webRequestBlocking`: To intercept the SAML response from your Identity Provider.
-   `https://*.aws.amazon.com/*`: To perform login actions and clear sessions on AWS domains.

---

_This extension is not affiliated with or endorsed by Amazon Web Services._