# Gmail API integration (one account)

Goal: authorize `gmail.modify` for one Gmail account, then run scripts on the droplet to list/search/label/archive/trash.

## Overview

Because the droplet is headless, do the **one-time OAuth login on your local machine** (with a browser), then copy the resulting token to the droplet.

We will create:
- `credentials.json` (downloaded from Google Cloud Console)
- `token.json` (generated after you approve access)

## 1) Create Google OAuth credentials

Google Cloud Console → create/select project → **Enable Gmail API**.

OAuth consent screen:
- User type: External (fine for personal Gmail)
- Add test user: the Gmail address you are authorizing

Credentials:
- Create Credentials → OAuth client ID → **Desktop app**
- Download JSON and save as `credentials.json`

## 2) Authorize locally

On your laptop:

```bash
cd integrations/gmail
npm init -y
npm i googleapis@^140
node auth.js --email gobuffs10@gmail.com
```

Follow the printed URL, approve, paste the code.

This writes `token.json`.

## 3) Copy secrets to the droplet

Copy `credentials.json` and `token.json` to the droplet into:

- `~/.openclaw/secrets/gmail/gobuffs10/credentials.json`
- `~/.openclaw/secrets/gmail/gobuffs10/token.json`

Lock perms:

```bash
chmod 700 ~/.openclaw/secrets/gmail/gobuffs10
chmod 600 ~/.openclaw/secrets/gmail/gobuffs10/*.json
```

## 4) Test on the droplet

```bash
cd /root/.openclaw/workspace/integrations/gmail
npm i googleapis@^140
node test.js --email gobuffs10@gmail.com
```

You should see profile + a small sample of inbox threads.
