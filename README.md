# Suther's Cup — website and tournament manager

A responsive, four-section website for the **34th Suther's Cup**, Friday **30 October 2026**. This is a **static website**: HTML, CSS, JavaScript, images and a pair of JSON data files. There is no paid hosting requirement or external database. **GitHub Pages can host it free.**

## 1. Publish to GitHub Pages

1. On GitHub, create a repository, for example `suthers-cup`. Public repositories are the simplest option for GitHub Pages on supported accounts.
2. Extract `suthers-cup-site.zip` on your computer. Upload the **contents** of the extracted folder into the root of the repository using **Add file → Upload files**. `index.html` must be at repository root, not nested inside another `suthers-cup-site` folder.
3. Commit the upload.
4. In the repository, open **Settings → Pages → Build and deployment → Deploy from a branch**. Choose `main` and `/(root)` and save.
5. GitHub will display the published address, normally `https://YOUR-USERNAME.github.io/suthers-cup/` (for a project repository).
6. Open it on a phone and a computer. Use the **Edition #34** tab to set up the event.

**Repository files:**

```text
index.html                  the entire website layout
styles.css                  responsive theme and print styles
app.js                      live event manager, archive, autosave and export
history.js                  embedded fallback of 33 historic editions
tournament-core.js          balanced draw / rankings / bracket calculations
assets/brand-mark.svg       original Suther's Cup vector crest
assets/favicon.svg          original eight-ball favicon
assets/trophy-and-beer.webp supplied trophy photo, web-optimised
assets/trophy-engraving.webp supplied plaque close-up, web-optimised
data/history.json           editable public history archive
data/edition34.json         publicly displayed event snapshot (starts as null)
README.md                   these instructions
```

For a quick local test, open `index.html` in a browser. The core site works offline, using the embedded historical data. To exercise hosted snapshot loading locally, start a local HTTP server such as `python -m http.server 8000` from this folder and open `http://localhost:8000/` in an ordinary browser.

## 2. Prepare the 34th Cup

In the **Edition #34** tab:

1. Enter the number of players (2–24) and all names.
2. Set the **maximum total number of games** (round robin plus knockout).
3. Optionally set the minimum **round-robin** games per player. If left blank, every player still gets at least one group game.
4. Choose the knockout: automatic, top 2, top 4 or top 8.
5. Review the preview, then select **Generate the draw**.

The draw reserves the required knockout matches, then fills as many **distinct round-robin 1v1 fixtures** as possible without exceeding the maximum. It allocates the games evenly: individual round-robin fixture counts differ by **at most one**. With the automatic setting, a top-four semifinal/final bracket is used where feasible, falling back to a top-two final if necessary.

If the match cap and minimum cannot both be met, the app shows an error rather than quietly ignoring the constraint. **A minimum number of total games for all competitors cannot be guaranteed once elimination starts.** The app therefore interprets the optional minimum as a group-stage requirement.

After the draw is created, select the winning name on each fixture. Standings update automatically. When all group matches have results, knockout seeds appear automatically. Winners progress through the bracket, and the final winner and runner-up appear in the Hall of Fame on that device.

A deliberate correction to a group result *after knockouts have started* asks for confirmation and resets the knockout results and manual seed order. Changing an earlier knockout result removes later results that are no longer valid.

### Standings and seeding policy

The **2011 Cup rules do not prescribe a tournament ranking method**. For Edition #34, the site uses:

1. Round-robin winning percentage (to allow for players receiving slightly different numbers of fixtures).
2. Total number of wins.
3. Direct head-to-head for a tied pair, if their meeting is recorded.
4. Opponents' aggregate winning percentage (strength of schedule).
5. Player name, alphabetically, as a deterministic last resort.

After group play, seed positions can be adjusted by agreement using the arrows on the **Knockout bracket** page. Manual reseeding resets knockout results. Confirm this ranking method with participants before the first game if a different customary method is preferred.

## 3. Protect the results on the night

**Recommended method: one nominated scorer, one primary device, regular JSON backups.**

- The site automatically saves every setup change, selected result and seed adjustment to that device's `localStorage` in that browser. It normally survives a refresh or closing and reopening the page.
- `localStorage` is **not** a cloud backup. It can be lost if browser data is cleared, a private/incognito session ends, a device fails, or a different browser/device is used. There is no automatic multi-device synchronisation.
- Click **↓ Backup JSON** after setting up the draw, regularly during the evening, and after the final. Save `edition34.json` to Files, iCloud Drive, OneDrive, or another secure location. Repeated backups may get numbered by the browser; retain dated versions.
- Use **↑ Restore** to load any exported `edition34.json` onto the same or another device. This replaces the active browser state after a warning.
- **↓ CSV** makes a spreadsheet-friendly list of match results, but does not contain all tournament state.
- **⎙ PDF / Print** opens the browser print dialog, with a clean tournament report for saving as PDF. This is a **readable archive only**, not restorable tournament state. On iOS, use the print preview's Share/Save to Files options; availability varies by iOS browser.

Do not score the same edition simultaneously on several unconnected phones; you will create separate divergent local states. If multiple people need to score live, build a secure shared database with real-time updates and access controls (e.g. Supabase or Firebase). **Do not embed a GitHub personal access token or database admin key in public web files.**

## 4. Publish the tournament results back to the website

GitHub Pages serves static files: **a browser visitor cannot directly write scores back into your repository**. To publish a snapshot of the tournament for everyone to read:

1. From the primary scoring device, click **↓ Backup JSON**. It downloads `edition34.json` containing the full draw, group results, seed order and knockout results.
2. In your GitHub repository, open `data/edition34.json`. Use GitHub's **Edit** action (pencil icon) to replace the initial `null` with the **entire content** of the downloaded JSON file, and commit. Alternatively, upload a replacement file at that exact path.
3. GitHub Pages serves the newly committed snapshot after it deploys. Anyone opening the website in a browser **without an older local copy** will see those published results, including the winner in the Hall of Fame.
4. A browser that previously saved a different copy will retain its own local version until the user opens Edition #34 → **How do I make sure the results aren't lost?** → **Load published results**. This deliberate override prevents accidental overwriting of unfinished scoring.
5. After completing the event, also save the final PDF report and JSON file somewhere independent of GitHub for long-term records.

The `data/history.json` file holds the 33 transcribed past results. It can be edited and committed to correct a historical entry. Once the 34th event is complete, the hosted `data/edition34.json` automatically adds that winner and runner-up to the Hall of Fame without needing to duplicate it manually into history.

## 5. Original rules and source fidelity

The **Cup Rules** tab is based on `Suther’s Cup Rules (Version 2 – March 2011)`. It keeps the distinctive house provisions including the black-ball rules, two shots after fouls, Downtrou, spading prohibition and catching a ball knocked off the table. The rules are grouped by topic; an outdated expression referring to mechanical bridge sticks has been replaced with neutral wording. The source is ambiguous in some areas, and the original document delegates unresolved questions to the rules authority.

**Historical dating discrepancy:** the supplied 33-row record calls Cup #1 **April 2004**. The user also described the event as having run since 2011; March 2011 is the supplied **rules version**, not demonstrably the tournament's founding date. To avoid silently changing the evidence, the website shows the dated historical archive and does not claim a founding year.

The past winners/runner-up list was transcribed from the supplied table. Names have been normalised for consistent leaderboard counts (for example `Andy McKay` rather than mixed `Mckay/McKay`). The two trophy photos are user-supplied and re-encoded for display. The last three pool images provided are styling references only and are **not** republished, avoiding potential rights/watermark issues. The vector logo/crest was designed specifically for this site; it does not copy any existing tournament identity.

## 6. Design and technical notes

The original palette draws on blue-green pool felt, the black eight-ball and trophy base, silver metal, cream cue balls and amber from the trophy photograph:

| Role | Colour |
| --- | --- |
| Midnight navy | `#091923` |
| Pool felt | `#0e6467` |
| Championship gold | `#e8b66d` |
| Chalk ivory | `#f7f3e9` |
| Silver slate | `#a8bdc5` |
| Copper accent | `#b47b34` |

Responsive breakpoints are 1120px, 860px, 620px and 370px. History tables scroll **within their panel** on small devices. Fonts use optional Google-hosted Barlow Condensed and DM Sans with system fallbacks; core functionality does not require a third-party service.

### Quality assurance

- `node tests/test-core.js` tests 57,527 valid fixture configurations covering entrants 2–24, bracket sizes 2/4/8, caps, minimum games, unique opponents, and ≤1 difference between per-player group appearances.
- `python tests/test-e2e.py` exercises setup, entering 17 group results, 4-person knockout progression, champion and runner-up, historical updating, autosave, JSON export/import, simulated refresh, error-free JavaScript, and layouts at 1440px, 768px, 390px and 320px. The test adapts to a restricted browser runtime by injecting static files into a blank page.
- A printable report is produced using print CSS. The test verifies the print command and report content, not a native iPhone PDF save flow.

**Important limitation:** GitHub Pages is not a database. The site is intentionally scoped to a reliable single-device scorer with manual publication of JSON snapshots. A proper multi-device real-time system would be a separate phase.
