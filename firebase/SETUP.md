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

- Put the values into `js/firebase-config.js`, replacing the empty placeholders, and delete the `TODO` line.
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

The site is then at `https://<project-id>.web.app`. Run `sh firebase/build.sh` again before every deploy, because
`firebase/public/` is generated.

## Optional: try it locally first

This needs Java 21. It never touches the live project:

```sh
sh firebase/build.sh
cd firebase
npx firebase-tools@15.31.0 emulators:start --only auth,firestore,hosting --project demo-orbit-orchard
```

Then open `http://127.0.0.1:5000/?emu=1`.
