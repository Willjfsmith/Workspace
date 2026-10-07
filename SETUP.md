# Lead workspace: setup

The app runs as a website on GitHub Pages and saves to your own Firebase project.
You sign in with Google, and each Google account can only see its own entries.

It takes about 20 minutes. You need a Google account and this GitHub repository. You don't need to install anything or use a command line.

## What's in this repository

| File | What it does |
|---|---|
| `index.html` | The app. It's your Claude artifact, with the Claude-only parts swapped for Firebase. |
| `firebase-bridge.js` | Connects the app to Firebase: sign-in, saving, photo uploads and downloads. |
| `firebase-config.js` | **You fill this in** with your Firebase project's settings (step 3). |
| `firestore.rules` | Security rules for saved entries. You paste these into Firebase (step 4). |
| `storage.rules` | Security rules for photos and files. Only needed for step 5. |
| `cors.json` | Lets photos appear inside PDF exports. Only needed for step 5. |

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Give it a name, such as `lead-workspace`, and click **Continue**.
4. When it asks about Google Analytics, turn it **off**. You don't need it.
5. Click **Create project**, wait for it to finish, then click **Continue**.

## 2. Turn on Google sign-in

1. In the left menu, open **Build → Authentication**, then click **Get started**.
2. On the **Sign-in method** tab, click **Google**.
3. Switch on **Enable**, choose your email as the **Project support email**, and click **Save**.
4. Open the **Settings** tab, then **Authorized domains**.
5. Click **Add domain**, enter `willjfsmith.github.io` and click **Add**.
   Sign-in won't work on the website without this.

## 3. Register the web app and copy its settings

1. Click the **gear icon** next to *Project Overview* (top left), then **Project settings**.
2. Scroll to **Your apps** and click the **`</>`** (Web) icon.
3. Enter a nickname such as `lead-workspace-web`. Leave **Firebase Hosting** unticked, then click **Register app**.
4. You'll see code containing `const firebaseConfig = { apiKey: "...", ... }`. Leave this page open.
5. In another tab, open this repository on GitHub and click `firebase-config.js`, then the **pencil icon** (Edit).
6. Copy each value from Firebase into the matching line between the `""` quotes: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` and `appId`.
   Leave `useStorage: false` as it is for now.
7. Click **Commit changes…**, then **Commit changes**.

These values are safe to publish. Sign-in and the security rules in step 4 protect your data, not this file.

## 4. Create the database and lock it down

1. In the left menu, open **Build → Firestore Database** and click **Create database**.
2. Choose the **Standard** edition if Firebase asks.
3. Pick a location close to you, for example **australia-southeast1 (Sydney)**. You can't change this later.
4. Choose **Start in production mode**, then click **Create**.
5. When the database opens, go to the **Rules** tab.
6. Delete everything in the editor, paste in the contents of `firestore.rules` from this repository, and click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

The free Spark plan is enough for the database and sign-in.

## 5. (Optional) Photos and files

Skip this step if you don't attach photos or files to entries. The rest of the app works without it.

Firebase only offers file storage on the pay-as-you-go **Blaze** plan. Light personal use stays within the free allowance, so in practice it costs nothing.

1. In the left menu, open **Build → Storage** and click **Get started**. Firebase will ask you to upgrade to **Blaze** and link a billing account.
   Once you've upgraded, set a budget alert (for example AU$5) under **Usage and billing → Details & settings**, so any charges are flagged early.
2. Choose a bucket location. **us-central1**, **us-east1** and **us-west1** include the no-cost allowance.
3. Choose **Start in production mode**, then click **Create**.
4. Open the **Rules** tab, paste in the contents of `storage.rules` and click **Publish**.
5. Edit `firebase-config.js` on GitHub again. Change `useStorage: false` to `useStorage: true` and commit.
6. *(Optional, only needed for photos inside PDF exports)* Open the **Google Cloud Shell** at <https://console.cloud.google.com/?cloudshell=true>, choose the same project, and run these two lines. Replace `YOUR-BUCKET` with the `storageBucket` value from `firebase-config.js`:

   ```
   echo '[{"origin":["https://willjfsmith.github.io"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json
   gcloud storage buckets update gs://YOUR-BUCKET --cors-file=cors.json
   ```

## 6. Publish the site on GitHub Pages

1. Open this repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Under **Branch**, choose `claude/kind-mendel-ygv29r` (or `main`, if you've merged it there), choose the **/ (root)** folder, and click **Save**.
4. Wait a minute or two, then refresh the page. It will show the address:
   **<https://willjfsmith.github.io/Workspace/>**

## 7. Move your entries across from Claude

1. Open the **old** Lead workspace artifact in Claude and go to **Settings → Backup → Download backup**. This saves a `.json` file.
2. Open the **new** site, click **Sign in with Google**, and go to **Settings → Backup → Restore from backup**. Choose the file you just downloaded.
3. Check **Settings → Connection check**. It should show your email and **Working** next to *Saving your entries*.

Photos and files don't come across, because they're stored inside Claude. Those entries show **MISSING**. Remove each one and add the file again.

## 8. Put it on your iPad or phone home screen

Open the site in Safari, tap **Share → Add to Home Screen**, then sign in once.

---

## Good to know

- **Who can see your data:** anyone can open the website, but they only see their own empty workspace. Your entries are only readable when signed in as you.
  To stop other people creating workspaces at all, change the rule line in step 4 to the following, using your own email:
  `allow read, write: if request.auth != null && request.auth.uid == uid && request.auth.token.email == "you@example.com";`
- **Working offline:** entries are cached on each device. Changes you make offline sync when you reconnect.
- **Size limit:** each project, person or page can hold up to about 1 MB. If you hit it, the app tells you. Large handwriting sketches are the most likely cause.
- **Updating the app:** edit `index.html` in this repository (or ask Claude to). GitHub Pages republishes automatically within a minute or two.
- **If you see "Firebase is not set up yet":** `firebase-config.js` is still empty or has a typo. Check step 3.
- **If sign-in says the address isn't allowed:** add `willjfsmith.github.io` under *Authorized domains* (step 2.5).
