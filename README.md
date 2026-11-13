# The Codebreakers: Operation Glass Key

A beginner-friendly digital forensics CTF.

**Play:** https://dev0root6.github.io/CTF1/

Players investigate a (fictional) data theft across eight missions:

| # | Mission | Skill |
|---|---------|-------|
| 1 | Briefing | Getting started |
| 2 | The intercepted note | Caesar cipher |
| 3 | The blank report | Hidden text in a PDF |
| 4 | Files in disguise | File signatures / magic bytes |
| 5 | The access log | Web server logs, URL decoding |
| 6 | Find the insider | DHCP, timeline and alibi correlation |
| 7 | What the photo remembers | EXIF metadata, binary |
| 8 | Case closed | Debrief |

No installs are needed to play. Every mission links to free online tools and has hints that reveal one at a time.

## How answers are protected

The site is static, so there is no server to check answers. Instead, each mission's reward (flag, link to the next page, note) is encrypted with AES-GCM using a key derived from the correct answer (PBKDF2-SHA256, 200k iterations). The page source holds only ciphertext, and a wrong answer simply fails to decrypt. Mission pages have unguessable names, and each page's link comes out of the previous page's encrypted reward.

The landing page is locked with an access password. The password itself is never stored: it's the key that decrypts the briefing, welcome flag and Mission 2 link, using the same PBKDF2 + AES-GCM scheme, and unlike mission answers it's case-sensitive and matched exactly. Once unlocked, a browser stays unlocked. To change it, edit the `index.html` entry in `.private/answers.json` and rebuild.

Answers are normalised before hashing: case-insensitive, and spaces, underscores and hyphens are treated as the same.

Limits: answers with very few possible values (like a first name) can be guessed by trial and error, and since the repository is public, someone could open mission pages out of order. They still have to solve each puzzle to get its flag.

## Layout

```
index.html            Mission 1 (landing page, QR code to mission 2)
m2-…html … m8-…html   Missions 2–8
assets/style.css      Shared design system
assets/ctf.js         Progress tracking, answer checking, flag locker
assets/vault.js       Encryption helpers, shared by browser and build script
evidence/             Downloadable evidence files
tools/build-vaults.mjs  Encrypts rewards into each page
```

## Editing answers or flags (organisers)

Answers live in `.private/answers.json`, which is **gitignored** and must never be committed. Format:

```json
{
  "pages": {
    "m2-4f7a1c.html": {
      "answers": [["ACCEPTED ANSWER"], ["ANOTHER ACCEPTED SPELLING"]],
      "reward": { "flag": "FLAG{...}", "next": "m3-b83e05.html", "note": "Shown after solving." }
    }
  }
}
```

Each inner array is one accepted answer, with one value per input field on that page. After editing, rebuild and verify:

```sh
node tools/build-vaults.mjs --check
```

## Running locally

The scripts are ES modules, so open the site through a local server rather than `file://`:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
