# Username Password Generator Chrome Extension

A Chrome browser extension that generates passwords based on the current website.

## Features

- 🚀 One-click generation of passwords based on the current website
- 📋 Automatic copying to clipboard
- 📧 Optional default email, one click to copy it for the username field
- ⚙️ Custom password generation rules
- 🔧 Real-time debugging functionality
- 🌐 Support for URL variable extraction

## Installation

go to web store search and install

## Usage

### Basic Usage
1. Click the extension icon in the browser toolbar
2. The extension will automatically generate a password and copy it to clipboard
3. The password will be displayed in the popup window

### Default Email

Many sites want your email address in the username field. Set it once and it is reused everywhere:

1. Open the settings page and fill in "Default Email"
2. The popup then shows a Default Email row with a copy button

The email is deliberately not derived from the website: it stays the same on every site. Clearing the field removes it.

### Custom Password Generation
1. Click the "Set Generation Rules" button in the popup window
2. Enter a password generation function in the settings page
3. Use the following available variables:
   - `{{domain}}` - Main domain name of the URL


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
- Supported in a rule: `{{domain}}`, `{{[domain][startIndex][endIndex][case]}}`, and a few `Math.*` calls with numeric arguments such as `Math.floor(3.7)`
- Arbitrary JavaScript is deliberately not supported
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
- Default email setting, copyable from the popup
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