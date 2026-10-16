// The privacy policy, written from what the code actually does (data inventory: docs/REP_PROOF_LAUNCH_READINESS.md).
// One source for both places it appears: the in-app Privacy screen and the public page built by
// scripts/build-site.mjs. Plain TypeScript (no imports), so the build script can load it directly.
// Status: DRAFT for the owner's review. It is not legal advice and has not been reviewed by a lawyer.

export const POLICY_UPDATED = '9 October 2026';

export type PolicySection = { title: string; body: string[] };

export const POLICY: PolicySection[] = [
  {
    title: 'Who we are',
    body: [
      'RepProof is a strength-training and nutrition app for adults (18+). This policy explains what the app collects, why, who processes it, and how to delete it.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'Account: your email address and a password (stored only as a secure hash by our authentication provider). If phone sign-in is turned on, your phone number instead.',
      'Training profile: birth year (to confirm you are 18 or over and estimate calorie needs), experience, goal, equipment, training days and session length, bodyweight, height, optional sex, units, movements you want to avoid, and when you accepted the disclaimer.',
      'Training log: your plan, workouts, exercises, weights, reps, reps in reserve or RPE, readiness check-ins (sleep, soreness and energy ratings), cardio sessions and bodyweight entries.',
      'Nutrition: your nutrition goal, foods you log (name, amount, calories and macros), saved meals, and food searches and barcodes you look up.',
      'Feedback: messages and weekly survey answers you choose to send.',
      'Usage events: which features are used, with small details so we can improve the app. Examples: "workout finished" with the number of sets; the goal, experience, training days and split you choose in setup; the session length, effort style and exercise coverage you choose in Training settings; your answers to the optional weekly survey; the type and intensity of a cardio session; which meal and food source you used; which exercises you added or swapped; which science topic or study you opened. Each event can only carry the fields listed for it in the app (anything else is dropped on your phone). They never include passwords, check-in answers, bodyweight, the foods you log, or the weights and reps you lift.',
      'Crash reports: if the app crashes while you are signed in, an error message and code location, the screen you were on, the platform and app version. Emails, tokens, keys, passwords and long numbers are removed on your phone before sending.',
    ],
  },
  {
    title: 'What stays on your phone',
    body: [
      'An unfinished workout, your effort-scale and notification preferences, recent coaching notes, any reps-in-reserve rep-outs you choose to record, your answer to a missed-session prompt, and whether you have seen the weekly survey or the founding-member offer are kept on your device only.',
      'Before your account is set up, your birth year and the time you accepted the disclaimer are kept on your device; they are saved to your account when your profile is created, then removed from the device.',
      'Your sign-in session is stored in the device\'s secure storage.',
      'If you download your data, the export files are written to the app\'s cache so you can share them; they are removed at your next export, when you sign out, or when you delete your account.',
      'The camera is used only to scan food barcodes. Camera images are processed on your phone and are never saved or uploaded.',
      'Rest-timer notifications, if you turn them on, are created on your phone. RepProof does not send push or marketing messages.',
    ],
  },
  {
    title: 'Why we use it',
    body: [
      'To run your account, build and adjust your training plan, calculate nutrition targets, show your progress, fix problems and improve the app.',
      'We do not sell your data, show ads, or use your data for advertising. We do not use advertising SDKs or third-party analytics services (apart from the barcode scanner\'s diagnostics described under "Who processes it").',
    ],
  },
  {
    title: 'Who processes it',
    body: [
      'Supabase (database, authentication and server functions) stores your account and logs on our behalf.',
      'Food search: your search words and scanned barcodes are sent to the USDA FoodData Central service (through our server, without your identity) and to Open Food Facts (through our server, and directly from your phone for barcode lookups or when our server is unavailable; direct requests share your IP address with them like any web request).',
      'Food search words and barcodes are cached on our server so repeat searches are fast: a cached result is used for up to 30 days, and expired entries are removed periodically. The cache holds the search and its results only, never who searched.',
      'Barcode scanning uses Google ML Kit on your phone. ML Kit sends Google diagnostic and usage data about the scanner (device and app details, performance, error codes); Google says it does not pass this data to third parties. Camera images are not sent.',
      'Sign-in and password-reset codes are emailed by our authentication provider, or by the email service configured to send for it.',
      'If CAPTCHA protection is turned on for sign-up, Cloudflare Turnstile checks that you are a person and receives device and browser signals for that purpose.',
      'Links to studies open the publisher\'s or doi.org website in your browser, under their own privacy policies.',
    ],
  },
  {
    title: 'Health information',
    body: [
      'Bodyweight, check-in ratings, training and nutrition logs are fitness information. They are used only to give you the app\'s features, are visible only to your account, and are protected by database access rules that block other users.',
      'RepProof gives training information, not medical advice.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Data is encrypted in transit (HTTPS). Every table is locked to its owner with row-level security, writes are size- and rate-limited, and the app\'s keys allow no access beyond your own data. No system is perfectly secure, but we work to protect your information.',
    ],
  },
  {
    title: 'Keeping and deleting your data',
    body: [
      'Your data is kept while your account exists. Old crash reports are cleared automatically: whenever a new report arrives, any older than 90 days are deleted.',
      'Delete everything at any time in the app: Account, Your data, Delete account and all data. This immediately and permanently deletes your account and every record linked to it: profile, plans, workouts, sets, check-ins, food logs, saved meals, cardio, bodyweight, feedback, usage events and crash reports.',
      'Without the app, request deletion through the account deletion page. We confirm the request comes from the account\'s email address and delete the account within 30 days.',
      'Our provider keeps short-lived server logs for security and operations. Database backups, if enabled, expire on the provider\'s schedule.',
      'You can download a copy of your data in the app: Account, Your data, Download my data. It includes your profile, plans, workouts, sets, check-ins, cardio, bodyweight, food logs and saved meals. Feedback, usage events and crash reports are write-only and not included; email us for a copy.',
    ],
  },
  {
    title: 'Age',
    body: ['RepProof is only for people aged 18 or over. The app asks for your birth year and does not let younger people create a training profile.'],
  },
  {
    title: 'Changes and contact',
    body: [
      'If this policy changes, the date above changes.',
      'Questions or requests: use Send feedback in the app, or the contact address on the account deletion page.',
    ],
  },
];
