# Quiz App Studio CMS

Next.js admin panel for managing exam content on the shared Firebase project (`quiz-apps-a4b59`).

Stays faithful to the mobile app Firestore model in `flutter_apps/hmgs_app`:

```
exams → subjects → topics (UI: Dersler)
                 ├── topic_cheatsheets
                 ├── flash_decks (cards[])
                 └── questions + question_pools
```

## Setup

Firebase is already wired to the **same project as HMGS**: `quiz-apps-a4b59` (Web app **Admin**).

```bash
cp .env.example .env.local   # already filled with project keys
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Admin login

- Email/Password is enabled on the project.
- `test@gmail.com` has custom claim `{ "role": "admin" }` (required by Firestore rules).
- After claim changes, sign out/in once so the ID token refreshes.

To grant another user:

```js
// role: "editor" | "admin"
admin.auth().setCustomUserClaims(uid, { role: "editor" });
```

### Project apps

| App | Platform | App ID |
| --- | --- | --- |
| quiz_app | Android | `…android:c1bf5cfdf434157974b45f` |
| quiz_app | iOS | `…ios:7322c16353a8f23074b45f` |
| Admin | Web | `…web:e637d8887b04caff74b45f` |

## Content ownership

**CMS is the only content authority.** Mobile reads Firestore; it does not write catalog/seed and does not override CMS with bundled seed.

After CMS edits, open the mobile app (or pull-to-refresh catalog) to see changes. Use **Sistem → Yayın sürümünü artır** if you need an explicit manifest bump.


Full HGMS local seed upload:

```bash
# optional: re-export JSON from Flutter seed
npm run seed:hgms:export

# upload exams, subjects, topics, questions, cheatsheets, flash decks
npm run seed:hgms:full
```

Last full seed: 21 topics, 21 cheatsheets, 43 flash decks (1075 cards), 6 questions.


- Auth gate + role check
- Dashboard counts
- Exams / subjects / topics CRUD + drag-and-drop `sortOrder`
- Topic hub
- Hap bilgi editor (`topic_cheatsheets`)
- Flash deck + cards + flip preview (25-card guidance)
- Questions CRUD + `question_pools` rebuild
- Reports list (admin claim)

## Not in Phase 1

- Bulk CSV import
- Audit logs / Admin SDK claim UI
- Storage uploads
- Named `tests` collection (mobile has no Test entity yet)
# admin_panel
