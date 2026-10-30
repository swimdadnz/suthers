# Suther’s Cup — Edition #34 official 11-player draw

**Update dated 30 October 2026.** This is a changes-only update for the existing GitHub Pages website. It does not replace the history, rules, artwork, branding, or original draw-generation files.

## Files to upload

Upload the **contents** of this ZIP into the **root of the existing repository**, retaining the `data/` folder structure:

| File | GitHub action |
| --- | --- |
| `index.html` | Replace the current root file. It references the new versioned scripts and stylesheet. |
| `edition34-live-20261030.css` | Add at the repository root. |
| `edition34-fixtures-20261030.js` | Add at the repository root. It contains the exact spreadsheet pairings. |
| `tournament-core-20261030-live.js` | Add at the repository root. It implements the spreadsheet’s nine-match reseeded finals. |
| `app-20261030-live.js` | Add at the repository root. It supplies viewing, scoring, backups and refresh. |
| `data/edition34.json` | Replace the original blank/default snapshot with the official 11-player draw. **Do not overwrite this later with the original blank version after scores have been published.** |

`UPDATE-EDITION-34.md` is documentation, optional to upload.

**Important:** Commit the files in the same GitHub commit. Do not upload only `index.html`, otherwise the site will be unable to load its new JavaScript. All old `app.js`, `tournament-core.js`, and previous hotfix versions can remain untouched. The old *Build the draw* controls still exist in the page markup but are hidden for this event. Git history and the older scripts preserve the draw-generator version for reinstatement later.

## Exact 11-player draw

The source is `Suthers Cup 34.xls` supplied by the organiser, sheet `RR (11)`. Names and pairings have been read from the spreadsheet’s **11 x 11 coloured fixture matrix**, not generated randomly. Every entrant has **eight games** and **two non-opponents**, giving **44 round-robin games**. The `Finals` sheet defines **nine knockout games**, giving **53 matches overall**.

Players: Brad, Pete, Sean, Gary, Nick, Matt S, Jarrod, Lloyd, Ben, Kyle and Matt VG.

### Non-opponents

| Player | Does not play |
| --- | --- |
| Brad | Pete, Matt VG |
| Pete | Brad, Sean |
| Sean | Pete, Gary |
| Gary | Sean, Nick |
| Nick | Gary, Matt S |
| Matt S | Nick, Jarrod |
| Jarrod | Matt S, Lloyd |
| Lloyd | Jarrod, Ben |
| Ben | Lloyd, Kyle |
| Kyle | Ben, Matt VG |
| Matt VG | Brad, Kyle |

The 44 displayed match numbers are reference IDs only: **the workbook does not specify a playing order or match times**.

### Finals instructions from the second sheet

1. **Quarter-finals (4)**: 1st v 8th, 2nd v 7th, 3rd v 6th, and 4th v 5th. The highest-ranked two winners proceed directly to preliminary finals. The lowest-ranked two losers are eliminated.
2. **Semi-finals (2)**: Fourth-highest-ranked quarter-final winner v second-highest-ranked quarter-final loser. Third-highest-ranked quarter-final winner v highest-ranked quarter-final loser. Winners progress.
3. **Preliminary finals (2)**: Highest-ranked quarter-final winner v winner of first semi; second-highest-ranked quarter-final winner v winner of second semi. Winners progress.
4. **Grand final (1)**: Preliminary-final winners meet for the Cup.

**Ranking qualification:** The workbook identifies total round-robin wins and rank but does not specify how to resolve ties. The website retains its existing provisional ranking logic and lets the organiser reorder finals seeds by agreement before knockout play. For the final standings all players have an equal eight scheduled games, so wins and win percentage produce the same ordering except for ties.

## Using the site on the night

**Players / spectators:** Open **Edition #34 → Fixtures & scores**. Choose a name from the dropdown or tap a name chip. The page shows that player's eight fixtures, which have results, and the two players they *do not* face. The 11-player matchup matrix is open on laptops and collapsible on phones. The **All match cards** section can be expanded to see the full list and filter it to unplayed/completed matches. Normal viewing is read-only.

**Organiser:** On ONE device, click **Enter results**. Tap the winning player's name on each match card. Results are autosaved in that device's browser under a **new separate localStorage key**, leaving any old eight-player draft untouched. Keep scoring mode enabled and **download Backup JSON regularly**; the scorekeeper's draft is never silently replaced by a newly published GitHub file. If an early score is corrected, dependent knockout results are reset to prevent incorrect advancement.

### Publishing updated results to GitHub Pages

1. From the **organiser's scoring-mode device**, select **Backup JSON**; the downloaded file is already named **`edition34.json`**.
2. In the GitHub repository open `data/edition34.json` (inside the **`data` folder**, not the repository root). Replace that file with the newly downloaded `edition34.json` using GitHub Desktop or Git. Alternatively, open the file in GitHub, click the edit/pencil icon, paste the full JSON text and commit.
3. **Commit the change to the GitHub Pages branch.** The website is static: downloading the JSON does *not* publish it automatically.
4. Players press **Refresh scores** on the page, or reload it, to read the newest deployed snapshot. GitHub Pages deployment and CDN caches can introduce a delay; pressing refresh does not guarantee instantaneous publication.
5. Repeat as often as desired. The site's `data/edition34.json` is the **public copy**, while the scoring device's browser retains the editable **local draft**.

**Backup safety:** Keep more than one exported JSON file during the night (e.g. timestamp the filenames when storing on your computer). A print/PDF is a readable archive **but cannot restore** the tournament. The JSON is the recoverable backup. Do not clear the scoring device browser storage unless you have a recent JSON copy. The **Restore** button accepts only backups matching this exact fixed 11-player official draw; it intentionally rejects backups from the older random-draw version.

**No secure edit login / real-time server:** Anyone can enter scorekeeping mode, but this only modifies their own browser, not the public site. Only somebody with GitHub repository write access can publish results. This is intentionally a zero-backend GitHub Pages solution.

## Troubleshooting

- Blank page or JavaScript mismatch: check that **all five versioned interface/code files and `index.html`** exist at the exact root paths described above, and refresh the GitHub Pages URL after the commit.
- Published scores not changing: check the replacement is specifically at **`data/edition34.json`** and that its `exportedAt` and scores reflect your latest download. GitHub Pages may take some time to deploy the commit. The organiser must not inadvertently upload an older JSON backup.
- Old player count appearing: the browser may still have cached the old `index.html`. Try reopening the site with `?version=official11` before any hash fragment, or a private browsing window.
- Need to restore the draw generator later: the former scripts are not deleted. Revert this event's `index.html` to the previous Git commit and re-enable the original generator there; alternatively adapt the preserved generator for Edition #35. Do not use the fixed Edition #34 JSON as a generated-draw backup.

## QA performed

- Verified 44 distinct matches and 8 unique opponents per person against the spreadsheet grid, with 11 symmetric omitted pairs.
- Tested all **16 possible patterns of quarter-final winners**, verifying the spreadsheet reseeding logic for the two semis and preliminaries, and completed each nine-match finals path.
- Browser-tested spectator refresh, organiser mode, autosave, JSON download, protection of unpublished edits and invalidation of dependent knockout results.
- Tested layouts at widths 1440, 768, 390 and 320 pixels without page-level horizontal overflow.
