<div align="center">
  <img src="icon.png" width="128" height="128" alt="TopIt Icon" />
  <h1>TopIt for Gmail: Send Emails to Top</h1>
</div>

**TopIt** is a lightweight Chrome Extension that adds a **"Send to Top"** button directly to the Gmail toolbar. It works by snoozing emails for just 1 minute so they reappear at the top of your inbox almost instantly.

## Features

- 🚀 **Send to Top**: Adds a **TopIt** button next to the native "Snooze" button in both the inbox view and inside open emails.
- ⚡ **Instant Action**: Automatically snoozes the email to the current time + 1 minute (rounded up).
- 🎨 **Native Look & Feel**: The custom button mimics Gmail's style and automatically syncs with Gmail's theme/density updates.
- 🛡️ **Privacy Focused**: No data collection, no tracking. Runs entirely locally in your browser.

## How it Works

The extension injects a script that:
1. Locates Gmail's native snooze button.
2. Injects a custom **TopIt** icon alongside it.
3. When clicked, it automates the sequence to:
    - Open the native Snooze menu.
    - Select "Pick date & time".
    - Input the current date and (Current Time + 1 Min).
    - Save the dialog.

It uses robust input simulation to ensure Gmail's internal validation accepts the programmatically entered time.

## Installation

### From Source (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the **`src`** folder inside this project.

## Privacy Policy

This extension does not collect, store, or transmit any user data. All operations are performed locally on the active Gmail tab to automate user UI interactions.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve the extension.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Google LLC or Gmail. It is an independent open-source project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
