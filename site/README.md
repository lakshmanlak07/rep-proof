# Public pages (privacy policy and account deletion)

Google Play needs a public privacy-policy URL and a public account-deletion URL. These pages are generated from the same text the app shows (`src/lib/privacyPolicy.ts`), so the two never drift apart.

Nothing in this folder is published automatically. Publishing is the owner's decision.

## Build

```bash
SUPPORT_EMAIL=<the contact address you choose> npm run build:site
```

This writes `site/dist/` with `privacy.html`, `delete-account.html`, `index.html` and the favicon. `site/dist/` is gitignored. The build refuses to run without a real contact address.

## Host it

Pick one static host, for example:

- **GitHub Pages:** a separate public repo, or a `gh-pages` branch. Upload the contents of `site/dist`. Note that this exposes the contact email publicly.
- **Cloudflare Pages / Netlify:** drag-and-drop `site/dist`.

## After hosting

1. Put the URLs in `.env` (they are public, not secrets), then rebuild the app:
   ```
   EXPO_PUBLIC_PRIVACY_URL=https://…/privacy.html
   EXPO_PUBLIC_DELETE_ACCOUNT_URL=https://…/delete-account.html
   ```
2. In Play Console, enter the same URLs:
   - App content, Privacy policy.
   - Data safety, Data deletion.
3. Honour the deletion promise on the page: when an email request arrives from an account's own address, delete the user in the Supabase dashboard (Authentication, Users, Delete user). Every table cascades from `auth.users`, so nothing else is needed.
