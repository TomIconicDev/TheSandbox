# Gmail Swipe Cleaner — root static version

This version is designed for uploading from your phone directly into the **root of a GitHub repo**.

No Vite.  
No React build.  
No `npm install`.  
No `dist` folder.

Upload these files directly into the root of your repo:

```text
index.html
styles.css
app.js
gmail.js
manifest.webmanifest
favicon.svg
README.md
```

## GitHub Pages setup

1. Open your GitHub repo.
2. Upload all files into the repo root.
3. Go to **Settings > Pages**.
4. Source: **Deploy from a branch**.
5. Branch: `main`.
6. Folder: `/ root`.
7. Save.

Your app should load at:

```text
https://YOUR_USERNAME.github.io/
```

if the repo is named:

```text
YOUR_USERNAME.github.io
```

or:

```text
https://YOUR_USERNAME.github.io/REPO_NAME/
```

if this is a normal project repo.

## Google Cloud OAuth setup

1. Go to Google Cloud Console.
2. Create/select a project.
3. Enable the **Gmail API**.
4. Configure OAuth consent.
5. Create OAuth Client ID.
6. Choose **Web application**.
7. Add authorised JavaScript origin:
   - `https://YOUR_USERNAME.github.io`

Do not include the repo path in the origin. Origins only include scheme + domain.

Example:

```text
https://tomiconicdev.github.io
```

Then copy the Web Client ID into the app.

## Recommended first queries

```text
category:promotions older_than:1y
older_than:5y -is:starred
from:noreply older_than:2y
-in:chats
```

Start with Max Messages set to 1000 before scanning everything.
