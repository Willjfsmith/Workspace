/* Connects the Workspace page to Firebase.
   The page asks for four services through window.claude.use(name):
     db        saved entries (Cloud Firestore)
     user      who is signed in (Firebase Authentication, Google sign-in)
     assets    photos and files (Cloud Storage for Firebase, optional)
     downloads saving backups, PDFs and Word files to this device
   This file builds each one and hands them to the page through window.__lwReady. */

const V = '12.19.0';
const CDN = 'https://www.gstatic.com/firebasejs/' + V + '/';

const ready = window.__lwReady || function () {};
const config = window.FIREBASE_CONFIG || {};

function fail(msg) {
  console.error('[workspace] ' + msg);
  showGate(msg, false);
  ready({});
}

/* ---------- sign-in screen ---------- */
let gate = null;
function showGate(msg, withButton) {
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 'lw-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-label', 'Sign in');
    gate.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--board,#fff);color:var(--ink,#111);font-family:var(--body,system-ui,sans-serif)';
    document.body.appendChild(gate);
  }
  gate.innerHTML =
    '<div style="max-width:360px;width:100%;text-align:center">' +
    '<img src="icons/logo.svg" alt="" width="64" height="64" style="display:block;margin:0 auto 14px">' +
    '<div style="font-family:var(--head,system-ui);font-size:28px;font-weight:600;letter-spacing:.02em;margin-bottom:10px">Workspace</div>' +
    '<p style="color:var(--muted,#666);margin:0 0 20px;line-height:1.45"></p>' +
    (withButton ? '<button type="button" style="font:inherit;font-weight:600;padding:12px 22px;border:1px solid var(--ink,#111);background:var(--ink,#111);color:var(--board,#fff);border-radius:6px;cursor:pointer">Sign in with Google</button>' : '') +
    '</div>';
  gate.querySelector('p').textContent = msg;
  const btn = gate.querySelector('button');
  if (btn) btn.onclick = () => signIn && signIn();
  gate.style.display = 'flex';
}
function hideGate() { if (gate) gate.style.display = 'none'; }

let signIn = null;

/* ---------- start ---------- */
if (!config.apiKey || !config.projectId) {
  fail('Firebase is not set up yet. Paste your Firebase settings into firebase-config.js (see SETUP.md).');
} else {
  start().catch((e) => fail('Firebase could not start: ' + (e && e.message ? e.message : e)));
}

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(CDN + 'firebase-app.js'),
    import(CDN + 'firebase-auth.js'),
    import(CDN + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(config);

  /* --- user --- */
  const auth = A.getAuth(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  signIn = () => A.signInWithPopup(auth, provider).catch((e) => {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      return A.signInWithRedirect(auth, provider);
    }
    if (e && e.code === 'auth/unauthorized-domain') {
      showGate('This web address is not on the Firebase allowed list yet. Add it under Authentication > Settings > Authorized domains.', true);
      return;
    }
    if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      showGate('Sign-in did not work: ' + (e.message || e.code), true);
    }
  });
  A.getRedirectResult(auth).catch(() => {});

  let firstUser;
  const signedIn = new Promise((res) => { firstUser = res; });
  let current;
  A.onAuthStateChanged(auth, (u) => {
    if (current && current.uid !== (u && u.uid)) { location.reload(); return; } // signed out or switched account
    current = u;
    if (u) {
      window.lwAccount = { email: u.email, name: u.displayName };
      hideGate();
      firstUser(u.uid);
    } else {
      window.lwAccount = null;
      showGate('Sign in to open your workspace. Your entries are saved to your own account.', true);
    }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-lw-signout]');
    if (b) { e.preventDefault(); e.stopPropagation(); A.signOut(auth); }
  }, true);
  const user = { id: () => signedIn };

  /* --- db --- */
  let fs;
  try {
    fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    fs = F.getFirestore(app);
  }
  // Each entry is stored as one JSON string, so any shape the page saves (nested lists, handwriting) is accepted.
  const MAX = 1000000;
  const decode = (d) => {
    const v = d.data();
    if (v && typeof v.json === 'string') { try { return JSON.parse(v.json); } catch (e) { return {}; } }
    return v || {};
  };
  const db = {
    doc(path) {
      const base = path.split('/').filter(Boolean);
      return {
        collection(kind) {
          return {
            doc(id) {
              const ref = F.doc(fs, ...base, kind, id);
              return {
                set(body) {
                  const json = JSON.stringify(body);
                  if (json.length > MAX) return Promise.reject({ code: 'too_big' });
                  return F.setDoc(ref, { json, at: Date.now() });
                },
                delete() { return F.deleteDoc(ref); },
              };
            },
            onSnapshot(next, error) {
              return F.onSnapshot(F.collection(fs, ...base, kind), (qs) => {
                next({ docs: qs.docs.map((d) => ({ id: d.id, data: () => decode(d) })) });
              }, error);
            },
          };
        },
      };
    },
  };

  /* --- downloads --- */
  const MIME = { pdf: 'application/pdf', json: 'application/json', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', csv: 'text/csv', txt: 'text/plain' };
  const downloads = {
    save({ filename, data }) {
      const ext = (String(filename).split('.').pop() || '').toLowerCase();
      const blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return Promise.resolve();
    },
  };

  /* --- assets (optional: needs Cloud Storage switched on) --- */
  let assets;
  if (config.storageBucket && config.useStorage === true) {
    try {
      const S = await import(CDN + 'firebase-storage.js');
      const st = S.getStorage(app);
      const LIMIT = 20 * 1024 * 1024;
      const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const fileRef = async (id) => S.ref(st, 'users/' + (await signedIn) + '/files/' + id);
      assets = {
        async upload(file, opts) {
          if (file.size > LIMIT) throw { code: 'too_large' };
          const id = newId();
          const type = (opts && opts.type) || file.type || 'application/octet-stream';
          const r = await fileRef(id);
          try {
            await S.uploadBytes(r, file, { contentType: type });
          } catch (e) {
            throw { code: e && e.code === 'storage/quota-exceeded' ? 'quota_or_state' : 'upstream_error' };
          }
          const url = await S.getDownloadURL(r);
          return { id, contentType: type, sizeBytes: file.size, url };
        },
        async delete(id) { return S.deleteObject(await fileRef(id)); },
      };
    } catch (e) {
      console.warn('[workspace] photo and file uploads are off:', e);
    }
  }

  ready({ db, user, downloads, assets });
}
