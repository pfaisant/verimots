# Verimots — Google Play publication kit

Generated 2026-10-09T14:43:45.682Z. Human page: https://verimots.pfa87.cc/promo/#google-play. Machine manifest: https://verimots.pfa87.cc/promo/play/play-store.json. Archive: https://verimots.pfa87.cc/promo/play/verimots-play-kit.tar.gz

## Goal
Polish and complete the Verimots store listing in Play Console: texts, graphics, translations and the App content forms. Leave it saved as a draft for Paul to review.

## Rules
- Do not publish, promote a release, change pricing, countries, signing, the package or the testing tracks.
- Do not name Scrabble or another product's trademark in the listing; do not claim the lists are official (ODS, CSW, NWL, FILE).
- Do not add a timer, multiplayer or any feature the APK does not have; every number here was counted from the bundled lists.
- Keep French (fr-FR) as the default listing. Use the other locales as given, or improve their wording without changing facts.
- Screenshots: upload the captioned ones in their order (1 = top play). The raw/ screens are there if a caption must change: re-render with build-kit.mjs instead of editing images by hand.
- Answers marked "decision" are Paul's (target audience, promo video). Answers marked "check" must be confirmed in the Console form, then reported.
- Stop and report what was saved, what the Console rejected (with the message) and every "check" you resolved.

## The app
- Package cc.pfa87.verimots, version 5.1.1 (code 89), minSdk 26, targetSdk 36.
- AAB https://s.pfa87.cc/verimots-5.1.1-89.aab (SHA-256 d90c9fb78a5a1fb953f6d4668057c9ab5609790d2e711bed59172cf308b35ef4). Upload key SHA-256 8f41eabd2c423d061abcc8e8545ce656094fd6d76745e64d0cd00e68208e25b2.
- Category Games › Word. Contact pfanokif@gmail.com. Website https://verimots.pfa87.cc/. Privacy https://s.pfa87.cc/privacy.html (FR https://s.pfa87.cc/confidentialite.html). Account deletion https://s.pfa87.cc/privacy.html#delete-account.

## Store listing (limits: title 30, short 80, full 4000, release notes 500 characters)
- fr-FR (default): title 8, short 75, full 2340, notes 352 · metadata/android/fr-FR/ · 6 phone, 6 7-inch, 6 10-inch screenshots
- en-GB: title 8, short 73, full 2219, notes 319 · metadata/android/en-GB/ · 6 phone, 6 7-inch, 6 10-inch screenshots
- en-US: title 8, short 73, full 2218, notes 319 · metadata/android/en-US/ · 6 phone, 6 7-inch, 6 10-inch screenshots
- es-ES: title 8, short 80, full 2373, notes 364 · metadata/android/es-ES/ · 6 phone, 6 7-inch, 6 10-inch screenshots
- ca: title 8, short 72, full 2375, notes 340 · metadata/android/ca/ · 6 phone, 6 7-inch, 6 10-inch screenshots

## Graphics
- icon.png 512 × 512, opaque (Play applies its own corner mask).
- featureGraphic.jpg 1024 × 500, one per locale.
- Screenshots: phone 1080 × 1920, 7-inch 1200 × 1920, 10-inch 1600 × 2560, JPEG, captioned; order 1 top play · 2 check a word · 3 7 + 1 · 4 short words · 5 the games · 6 languages. Uncaptioned screens in raw/.
- Promo video: [decision] Paul uploads it to YouTube (public or unlisted, no ads, not "made for kids" unless the audience answer changes) and pastes the URL into each locale's video field. Leave the field empty until then.

## App content answers (see play-store.json → console for every field and its source)
- privacyPolicy: [answer] https://s.pfa87.cc/privacy.html
- appAccess: [answer] All functionality is available without special access.
- ads: [answer] No, the app does not contain ads.
- inAppPurchases: [answer] None (free app, no billing library).
- government: [answer] No
- financialFeatures: [answer] None of the above
- health: [answer] No health features
- news: [answer] No, not a news app
- category: [answer] Game › Word
- contact: [answer] 
- targetAudience: [decision] Keep 18+ (or 13+) and answer No to "appeals to children"; choosing any under-13 age group brings in the Families policy and its requirements.
- contentRating: [check] PEGI 3 / Everyone
- dataSafety: [check] 
- releaseTrack: [check] Check in the Console dashboard whether production access still needs a closed test with a minimum number of testers over a minimum period (personal developer accounts). Do not promote a release without Paul.
- promoVideo: [decision] Paul uploads it to YouTube (public or unlisted, no ads, not "made for kids" unless the audience answer changes) and pastes the URL into each locale's video field. Leave the field empty until then.

## Open
- check: Data safety and Content rating answers against the live Console forms (see console.*.status).
- decision (Paul): target audience; YouTube upload of the promo video.
- check: the en-US listing is a copy of en-GB with US spelling; keep it only if Play needs it.
- check: the APK has no tablet layout. The 7-inch screens (600 dp) read well; the 10-inch ones (800 dp) show the phone layout with wide empty margins. Tablet screenshots are optional: upload the 10-inch set only if the listing should target tablets.

## Rebuild
bash scripts/verimots-promo/play/capture.sh <raw> phone|tab7|tab10 (emulator only: it clears app data) → node scripts/verimots-promo/play/build-kit.mjs <raw> → node scripts/verimots-promo/play/verify-kit.mjs
