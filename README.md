# Username Password Generator Chrome Extension

A Chrome browser extension that generates passwords based on the current website.

## Features

- 🚀 One-click generation of passwords based on the current website
- 📋 Automatic copying to clipboard
- 📧 Keep several email addresses, pick one from a dropdown and copy it
- ⚙️ Custom password generation rules
- 🔧 Real-time debugging functionality
- 🌐 Support for URL variable extraction

## Installation

go to web store search and install

## Usage

### Basic Usage
1. Click the extension icon in the browser toolbar
2. The extension generates a password and copies it to the clipboard
3. The password is displayed in the popup window. If your settings could not be read, or the page has no website domain, it says so and copies nothing

### Emails

Many sites want your email address in the username field. You can keep several addresses and choose one when you need it:

1. Open the settings page and use "Add Email" to add every address you use; "Remove" drops one
2. Mark one row as **Default** with its radio button
3. The popup then shows a dropdown with your addresses - the default one first and pre-selected - plus a copy button

Emails are deliberately not derived from the website: the same list is used everywhere. Removing every row clears the list.

### Custom Password Generation
1. Click the "Set Generation Rules" button in the popup window
2. Write your generation rules on the settings page; each box shows a copyable example you can adapt
3. Reference the current website with `{{domain}}` (the whole main domain) or with character indexes such as `{{1L}}` and `{{1_3U}}` - see Notes below for the full syntax

The extension derives the password and never stores it, so the rule is the only thing you need to remember.

### Debugging Function
1. Enter a function in the settings page and click the "Test Generation Rule" button
2. View the values of current variables and the generated password
3. Adjust the function based on the results

## Notes

- The extension requires the following permissions:
  - `activeTab` - To access current tab information
  - `clipboardWrite` - To write to clipboard
  - `storage` - To store settings information
- A generation rule is a text template, not JavaScript: it is expanded by string substitution, so a rule can never execute code
- References are written inside `{{ }}`: `{{domain}}` (the whole domain), `{{3L}}` (3rd character, lowercase), `{{-1U}}` (last character, uppercase) or a range like `{{1_3U}}`
- Indexing is 1-based: `1` is the first character and `-1` is the last; a range joins two indexes with `_` and is inclusive; the `U`/`L` suffix is optional
- An index beyond either end is clamped to the nearest character, so one rule works on short domains too (`{{1_3L}}` on `x` gives `x`)
- A reference that cannot be resolved at all (an unknown name, no domain available, or index `0`) is left in the output as written, so a broken rule is obvious instead of quietly producing a different password
- Arbitrary JavaScript is deliberately not supported: `Math.floor(3.7)` and the like stay literal text
- Settings are saved with `chrome.storage.sync`, so they follow your Chrome profile across devices; if syncing fails they are stored on the current device only and the settings page says so

## Development

```bash
npm install
npm test        # node:test, no extra test dependencies
npm run build   # writes a loadable extension to dist/
```

To try it, open `chrome://extensions`, enable Developer mode, choose "Load unpacked" and select the `dist/` folder.

## Changelog

### v1.2
- Multiple email addresses with one marked as default; pick and copy from a popup dropdown
- Settings go through `chrome.storage.sync` with an automatic local fallback
- Fix: failed clipboard writes no longer claim to have succeeded
- Fix: hosts without a public suffix (localhost, IPs, intranet names) no longer generate `null!@#` passwords
- Removed the unused content script and its `<all_urls>` permission

### v1.0
- Initial release
- Basic password generation functionality
- Custom function support
- Debugging functionality
- Username generation support