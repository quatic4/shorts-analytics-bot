# Shorts Analytics Bot

A standalone Discord bot that posts automatic daily YouTube Shorts analytics and provides on-demand slash commands.

## V1 features

- `/setup` — choose the Discord channel for daily analytics
- `/connect` — authorize the YouTube channel through Google OAuth
- `/analytics` — latest Shorts analytics
- `/today` — latest complete day
- `/week` — last 7 complete days
- Automatic daily Shorts report
- Multi-server support
- Serverless Discord interactions (no always-on VPS)
- Private YouTube analytics via OAuth

## Architecture

Discord HTTP Interactions → Vercel Functions → YouTube Analytics API  
Vercel Cron → Daily report → Discord channel  
Upstash Redis → stores each Discord server's setup + encrypted-in-transit OAuth token data

## Important: what the daily report means

YouTube Analytics reporting can lag, so V1 reports the **latest complete day** rather than pretending partial real-time data is a finished day.

The API query is filtered to `creatorContentType=SHORTS`.

## Environment variables

Create these in Vercel:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `STATE_SECRET`
- `CRON_SECRET`
- `SETUP_SECRET`

Use long random values for `STATE_SECRET`, `CRON_SECRET`, and `SETUP_SECRET`.

## Phone-friendly setup order

### 1. Upload this repo to GitHub

Upload all files/folders from the ZIP into `quatic4/shorts-analytics-bot`.

### 2. Create a Discord application

In the Discord Developer Portal:

1. Create an application.
2. Open **Bot** and create/reset the bot token.
3. Save the token as `DISCORD_BOT_TOKEN`.
4. Under **General Information**, copy:
   - Application ID → `DISCORD_APPLICATION_ID`
   - Public Key → `DISCORD_PUBLIC_KEY`
5. Install the app to your Discord server with permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Use Application Commands

Do **not** put the bot token in GitHub.

### 3. Create an Upstash Redis database

Create a free Redis database in Upstash and copy:
- REST URL → `UPSTASH_REDIS_REST_URL`
- REST Token → `UPSTASH_REDIS_REST_TOKEN`

### 4. Create Google OAuth credentials

In Google Cloud:

1. Create/select a project.
2. Enable:
   - YouTube Analytics API
   - YouTube Data API v3
3. Configure the OAuth consent screen.
4. Create **OAuth 2.0 Client ID** for a Web application.
5. After the Vercel deployment exists, add:
   `https://YOUR-VERCEL-DOMAIN.vercel.app/api/oauth/callback`
   as an Authorized Redirect URI.
6. Put the client ID/secret into Vercel.

Set `GOOGLE_REDIRECT_URI` to that exact same callback URL.

### 5. Deploy to Vercel

Import `quatic4/shorts-analytics-bot` as a new Vercel project.

Add all environment variables.

The cron in `vercel.json` runs once daily at **14:00 UTC**.

### 6. Set Discord's Interactions Endpoint URL

After deployment, set this in Discord Developer Portal:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/interactions`

Discord will send a verification PING. The endpoint verifies Discord's Ed25519 signature.

### 7. Register slash commands

Because you may be setting this up from a phone, V1 includes a protected registration URL.

Add a random `SETUP_SECRET` in Vercel, then visit:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/register?secret=YOUR_SETUP_SECRET`

If successful, Discord returns the command JSON.

Afterward, you can delete `SETUP_SECRET` from Vercel if you want to disable the registration endpoint.

### 8. Set up your Discord server

Inside Discord:

1. Run `/setup` and select the channel where daily analytics should post.
2. Run `/connect`.
3. Tap the private Google authorization link.
4. Choose the YouTube account/channel.
5. Return to Discord.
6. Run `/analytics`.

## Security

- Never commit Discord, Google, Upstash, or Vercel secrets to GitHub.
- Discord requests are signature-verified.
- Google OAuth state is signed and expires after 15 minutes.
- `/connect` and `/setup` require Discord's Manage Server permission.
- Scheduled Discord messages use the bot token from Vercel environment variables.
- OAuth tokens are stored in Redis. For a larger public bot, add application-level token encryption and token revocation controls before broad distribution.

## Future V2 ideas

- Daily leaderboard across creators
- Multiple YouTube channels per server
- Custom report times/time zones
- Top-performing Short
- View/subscriber change percentages
- 30-day projections
- Personal creator accounts
- `/leaderboard`
- Weekly recap
- Milestone alerts
