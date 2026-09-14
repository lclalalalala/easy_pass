# Privacy Policy for Username Password Generator

Last updated: 2026-09-14

## Introduction

This Privacy Policy explains how Username Password Generator ("the Extension") collects, uses, and protects your information when you use our Chrome browser extension. We are committed to protecting your privacy and ensuring the security of your data.

## Information Collection

The Extension does not collect, track, or transmit any information about you to the developer. It does not monitor your browsing activity, collect your website usage data, or gather any information about the websites you visit.

The only information the Extension stores is the information you enter yourself on its settings page: your password and username generation rules, and an optional default email address.

## How Information is Stored

Your settings are stored using the Chrome Storage API, in the synchronized storage area (`chrome.storage.sync`).

If you are signed in to Chrome with sync enabled, Chrome will synchronize this data across the devices signed in to the same Google account, so your settings follow you. This synchronization is carried out by Chrome, not by the Extension, and is governed by Google's Chrome sync terms and privacy policy. If synchronization fails or is unavailable, the Extension falls back to storing your settings locally on the current device only.

If you do not want your settings (including the default email address, if you set one) to be synchronized, sign out of Chrome or disable sync.

## Information Transmission

The Extension itself does not send, transmit, or store your configured rules, your default email address, or your generated passwords to any server operated by the developer. All password generation and rule processing occurs locally on your device.

The only transfer of your settings off your device is the Chrome synchronization described above, which is performed by the browser under your own Google account.

## Permission Usage

The Extension requires the following permissions to function properly:

- **activeTab**: This permission allows the Extension to access the current tab's URL to suggest appropriate usernames and passwords based on the website you're visiting.
- **clipboardWrite**: This permission enables the Extension to copy generated usernames and passwords to your clipboard for convenient use.
- **storage**: This permission is used to store your password generation preferences, rules, and optional default email address.

The Extension does not request host permissions for any website, and it does not read, modify, or inject content into the pages you visit. These permissions are strictly limited to the core functionality of the Extension and are never used for any other purpose.

## Data Security

We take data security seriously. All information stored by the Extension is protected by Chrome's built-in security mechanisms. Generated passwords are never stored by the Extension: it only derives them from your rules on demand and copies them to your clipboard.

## User Control

You have full control over the information stored by the Extension. You can view, modify, or delete your password generation rules and your default email address at any time through the Extension's settings page; clearing the email field removes it. Uninstalling the Extension removes all associated data from your device.

## Updates to This Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We encourage you to review this Privacy Policy periodically.

## Contact

If you have any questions or concerns about this Privacy Policy or the Extension's privacy practices, please contact us at [Insert Contact Information].

## Consent

By using the Username Password Generator Extension, you consent to the collection and use of information in accordance with this Privacy Policy.