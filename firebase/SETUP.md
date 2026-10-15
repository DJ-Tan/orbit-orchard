# Orbit Orchard on Firebase: setup

Everything fits the free Spark plan. You need Node 20 or later for the deploy tool.

## 1. Firebase console

1. Go to https://console.firebase.google.com, click **Create a project**, and give it a name. Google Analytics is not needed.
2. **Build > Authentication > Get started > Sign-in method > Google**: switch it on, pick a support email, and click **Save**.
3. **Build > Firestore Database > Create database**: choose a location close to your players. It can't be changed later.
   For example, `nam5` (US), `eur3` (Europe) or `asia-southeast1` (Singapore). Then choose **Start in production mode**.
   The deploy step below replaces the default deny-all rules.
4. **Project settings (gear) > General > Your apps > Web (`</>`)**: register an app (any nickname, Hosting box optional).
   Copy the `firebaseConfig` values it shows.

## 2. Paste the config

- Copy `js/firebase-config.example.js` to `js/firebase-config.js` (the real file is gitignored, so your keys stay out of the repo). Put the values
  into it, replacing the empty placeholders.
- Put the project id into `firebase/.firebaserc` as `"default"`.

## 3. Sign-in on phones (redirect)

On mobile Safari, and when a popup is blocked, the game signs in by redirect. That only works when the sign-in handler lives on
the same domain as the game. On `<project-id>.web.app` and `<project-id>.firebaseapp.com`, the game uses the page's own domain
automatically. Google has to allow that address, once:

- Open https://console.cloud.google.com/apis/credentials for the same project. Open the OAuth client named
  **Web client (auto created by Google Service)**. Under **Authorized redirect URIs**, add
  `https://<project-id>.web.app/__/auth/handler` and click **Save**.

If you use a custom domain, connect it under **Hosting**. Add it under **Authentication > Settings > Authorized domains**, set
`authDomain` in `js/firebase-config.js` to it, and add `https://<your-domain>/__/auth/handler` to the same redirect URI list.

## 4. Build and deploy

From the project root:

```sh
sh firebase/build.sh
cd firebase
npx firebase-tools@15.31.0 login
npx firebase-tools@15.31.0 deploy --only hosting,firestore:rules
```

The site is then at `https://<project-id>.web.app`. Friends needs nothing else in the console: the same deploy publishes its
rules, and it needs no indexes. Run `sh firebase/build.sh` again before every deploy, because
`firebase/public/` is generated.

## Daily allowance

The free plan allows 20,000 writes (deletes included) and 50,000 reads a day, reset at midnight Pacific time. The game splits that
into allowance blocks so it can't run out, however many people play:

- A block lets one browser make 36 writes and 90 reads. The day has 400 blocks, and one player can claim at most 4 a day. In the
  worst case that is 15,200 writes and about 38,400 reads, leaving about 20% of the quota as headroom.
- Each document also has a daily write limit (save 100, friends 20, keys 10, pins 20, chal 40, sent 40, pub 20, each card 12).
- Feedback notes come out of the same allowance: each note is 1 write and 1 read, and a player can send at most 3 a day.
- When a player's blocks are used up, or the day's 400 are gone, the game keeps saving on the device and shows when it syncs again
  (after midnight Pacific, in the player's local time). It reconnects on its own after the reset.

To see today's usage, open **Firestore Database > Data > days**. The document named after today's day number holds `n`, the blocks
claimed so far (out of 400), and its `u` subcollection holds each player's `k` (out of 4). The day number counts Pacific days since
1 January 1970; on the site, `OrchardWeb.meter.today()` in the browser console prints it. Old `days` documents can be deleted at any
time.

To change the limits, for example after moving to the Blaze plan, edit both files and keep them in step, then rebuild and deploy
hosting and rules together:

- `js/backend-firebase.js`: `ALLOW` (`day` blocks, `user` blocks per player, `writes` and `reads` per block, `near`, the day count that
  slows saving to every 10 minutes) and `CAPS` (per-document daily writes).
- `firebase/firestore.rules`: `n <= 400` and `k <= 4` in `match /days/{day}`, and the caps passed to `counted(...)`.

Keep `day × (writes + 2)` and `day × (reads + 6)` about 20% under the daily quota you pay for. The daylight-time table in both files
covers 2026–2036; before 2037, raise `TO` in `dev/web/gen-dst.js`, run `node dev/web/gen-dst.js` and deploy.

Tabs left open from a build before this change can't save (the rules refuse writes without the daily counter) until they reload.

## Reading feedback

Players send notes from **Settings > Feedback**. They land in **Firestore Database > Data > feedback > (player's uid) > m**, one document
per note, named `<day>-<n>`: the Pacific day number (as in `days`) and 0, 1 or 2, so each player can send at most 3 a day. The rules
(`match /feedback/...` in `firebase/firestore.rules`, published by the same deploy) let a signed-in player create only their own notes for
today, never read, change or delete them; only you see them, in the console or with the Admin SDK. Each note has:

- `cat`: `bug`, `idea`, `praise` or `other`
- `msg`: the note, 10 to 1000 characters, with control, direction-override and zero-width characters removed
- `at`: when it was sent (server time); `u`: the player's uid (the same as the parent document's name)
- `info` (only if the player ticked "Include game info"): `ver`, `build` (`web`), `skin`, `worlds`, `stars`, `view` (`phone`, `tablet` or
  `desktop`) and `ua` (browser family only, such as `Firefox`). It never holds a name, email or friend code.

Treat a note's text as untrusted: read it as plain text, and don't paste it into anything that runs HTML or scripts. Old notes can be deleted
from the console at any time.

## Usernames

Players can pick a unique username in **Settings > Cloud save**. It needs nothing in the console: the same deploy publishes the rules.
Each username is a document in **Firestore Database > Data > names**, named by the lowercase username, holding `u` (the player's uid) and
`n` (the name as typed). The player's `pub` document holds the same name as `un` and the time of the last change as `ut`. The rules
(`validName`, `nameMove` and `match /names/{key}` in `firebase/firestore.rules`) allow 3–20 letters, digits and single inner underscores
starting with a letter, refuse a list of reserved names and a short blocklist (kept in step with `RESERVED` and `BLOCK` in `js/username.js`),
let each player hold one name, release the old name in the same write, and allow one change or removal every 7 days.

To take a name away, delete its `names` document and the `un` field of the owner's `pub` document in the console. To let a player change
again sooner, delete their `ut` field. Tabs open from a build before usernames can't update `pub` for a player who has one, until they reload.

## Optional: try it locally first

This needs Java 21. It never touches the live project:

```sh
sh firebase/build.sh
cd firebase
npx firebase-tools@15.31.0 emulators:start --only auth,firestore,hosting --project demo-orbit-orchard
```

Then open `http://127.0.0.1:5000/?emu=1`.
