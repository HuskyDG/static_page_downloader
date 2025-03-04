# Static Page Downloader

Static Page Downloader is a Chrome extension that processes the current webpage by inlining external resources—such as images, CSS (including @import rules), inline styles, and even iframe content—and then downloads a fully self-contained, static HTML version of the page. It also removes JavaScript and inline event handlers, decodes mis-encoded text, and generates a dynamic filename based on the page URL.

## Features

- **Resource Inlining:** Converts external images, stylesheets, and other assets into Base64 data URIs.
- **CSS Processing:** Inlines CSS `@import` rules and fixes relative URLs.
- **Iframe Support:** Attempts to inline content from iframes.
- **Cleanup:** Removes all `<script>` tags and inline event handlers for a fully static page.
- **Text Decoding:** Fixes mis-encoded text and ensures proper UTF-8 rendering.
- **Dynamic Filenames:** Generates a filename based on the current page's hostname and pathname (e.g., `static_page_facebook_com_messages_t_120849479174.html`).

## Installation

1. **Clone or Download:**  
   Clone this repository or download the extension files.

2. **Load Unpacked Extension:**  
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top right corner).
   - Click **Load unpacked** and select the folder containing the extension files.

## Usage

1. Navigate to the webpage you want to save as a static HTML file.
2. Click the extension icon in the Chrome toolbar.
3. The extension will process the page (inlining resources, removing scripts, etc.) and automatically trigger a download of the static HTML file.
4. The downloaded file will have a name generated based on the current URL.

## Files

- **`manifest.json`**  
  Contains the extension's metadata, permissions (like `"activeTab"` and `"scripting"`), and references to the background and content scripts.

- **`background.js`**  
  A service worker that listens for icon clicks and injects the content script into the active tab.

- **`content.js`**  
  The main script that processes the page, inlines resources, fixes text encoding issues, and triggers the download.

- **Icon Files:**  
  - `icon.svg` (and generated PNG versions such as `icon-16.png`, `icon-48.png`, `icon-128.png`)  
    These files are used as the extension icon in the Chrome toolbar.

## Development

- This extension is built using [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/).
- It uses modern JavaScript (async/await, fetch API) to process and inline external resources.
- Contributions, bug reports, and feature requests are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Acknowledgments

- Inspired by various static page saving tools and browser automation techniques.
- Special thanks to the Chrome extension documentation and community for support.
