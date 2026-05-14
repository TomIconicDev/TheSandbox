# Gmail Swipe Cleaner

An iPhone-friendly GitHub Pages web app that connects to Gmail with Google OAuth, scans message sender metadata, groups emails by sender, then lets you:

- swipe right / tap to archive all emails from that sender
- swipe left / tap to move all emails from that sender to Gmail Bin
- filter sender cards
- scan by Gmail search query, for example `older_than:5y -is:starred`

## Safety model

This starter app intentionally does **not** call Gmail's permanent `batchDelete` endpoint.

The "Move to Bin" action uses `users.messages.batchModify` to add the `TRASH` label and remove `INBOX`, so it behaves more like Gmail's normal delete flow.

## Google Cloud setup

1. Open Google Cloud Console.
2. Create a project.
3. Enable the Gmail API.
4. Configure OAuth consent.
5. Create an OAuth Client ID.
6. Application type: **Web application**.
7. Add Authorized JavaScript origins:
   - local dev: `http://localhost:5173`
   - GitHub Pages: `https://YOUR_GITHUB_USERNAME.github.io`
8. Copy the Web Client ID.
9. Paste it into the app.

## Local dev

```bash
npm install
npm run dev
```

Open the local Vite URL on your computer or iPhone on the same network.

## Deploy to GitHub Pages

This Vite config assumes the repo is called:

```text
gmail-swipe-cleaner
```

If you rename the repo, update `base` in `vite.config.js` and the manifest path in `index.html`.

Build:

```bash
npm run build
```

Deploy `dist/` using GitHub Pages, or add your preferred Pages workflow.

## Recommended first scan queries

Start small:

```text
category:promotions older_than:1y
```

Then:

```text
older_than:5y -is:starred
```

To scan everything except chats:

```text
-in:chats
```

Set max messages to `0` for all, but test with 500 or 5000 first.
