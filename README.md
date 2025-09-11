# Username Password Generator Chrome Extension

A Chrome browser extension that generates passwords based on the current website.

## Features

- 🚀 One-click generation of passwords based on the current website
- 📋 Automatic copying to clipboard
- ⚙️ Custom password generation functions
- 🔧 Real-time debugging functionality
- 🌐 Support for URL variable extraction

## Installation

go to web store search and install

## Usage

### Basic Usage
1. Click the extension icon in the browser toolbar
2. The extension will automatically generate a password and copy it to clipboard
3. The password will be displayed in the popup window

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
- Custom functions must return a string
- All JavaScript built-in features can be used in functions
- The extension uses secure string replacement and expression evaluation methods to execute user-defined password generation functions
- Basic mathematical operations and variable substitution are supported, but functionality is relatively limited to ensure security

## Changelog

### v1.0
- Initial release
- Basic password generation functionality
- Custom function support
- Debugging functionality
- Username generation support