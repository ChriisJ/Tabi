# Privacy Policy – Tabi

Last updated: 2026-10-20 · Applies to Tabi 0.5.0 and later · [Deutsche Fassung](DATENSCHUTZ.md)

**Summary:** Tabi does not send any data to the developer or to third parties. There is no telemetry, no analytics, no advertising, no network access and no remotely hosted code. All data stays in your browser and, only if you use sync, in the sync storage of **your own** browser account.

## Permissions

| Permission | Why Tabi needs it |
|---|---|
| `tabs` (shown as "Read your browsing history") | Read the addresses of open tabs so Tabi can recognize your template tabs after a browser restart, and offer "capture current session". Create, move and reopen tabs. Tabi does **not** read your browsing history itself. |
| `tabGroups` | Create, name, color and recognize native tab groups |
| `storage` | Save your template and settings, optionally sync them via your browser account |

Tabi has **no host permissions and no content scripts**. It cannot read or change the content of web pages.

## Data Tabi stores

| Data | Where | Purpose |
|---|---|---|
| Your template: profiles, window names, group names and colors, start URLs | browser storage (`storage.local`). If sync is on, also `storage.sync`, which is your own browser account. | Core functionality |
| Last seen URL of each managed tab, last seen group title | `storage.local`, this device only | Recognize your tabs after a restart, even after you navigated within them |
| Running profiles, protection on/off, device name, sync status | `storage.local` | Settings of this device |
| Runtime mapping and a debug log (max. 300 entries, may contain tab addresses) | `storage.session`, deleted when the browser restarts | Operation and troubleshooting |

- **Sync** uses the browser's built-in `chrome.storage.sync` of your own account. Only the template is synced. You can turn sync off per device.
- **Exports** create files on your computer that contain your template URLs. Tabi never uploads them.
- **Uninstalling** Tabi makes the browser delete all data stored by the extension.

## Data sharing

Tabi does not sell, transfer or share user data with anyone. It does not use data for purposes unrelated to its single purpose, and it does not use data to determine creditworthiness or for lending.

## Contact

Questions or issues: <https://github.com/ChriisJ/Tabi/issues>
