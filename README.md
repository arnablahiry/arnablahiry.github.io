# My website - from scratch, wink wink ;)

## Travel photos

Drop travel photos into `images/travels/<country-folder>/` using any browser-friendly image extension (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`). Filenames do not need to follow a sequence.

Then regenerate the travel photo manifest:

```sh
node scripts/generate-travel-photo-manifest.js
```

Create/update the per-country caption spreadsheet and browser caption data:

```sh
node scripts/sync-travel-caption-spreadsheet.js
```

If this is your first time running the caption sync script, install dependencies once:

```sh
npm install
```

Or run the full travel sync (manifest + captions):

```sh
npm run travel:sync
```

The caption spreadsheet lives at `data/travel-captions.xlsx` with one sheet per country.
Each row is one photo, keyed by its file name (`Photo`), with a `Caption` and an `Author` (who took it; empty means Arnab). Both show in the travel lightbox.
When new country folders or photos are added, rerunning the sync command auto-adds new sheets/rows while preserving existing captions. (Older workbooks keyed `photo 1`, `photo 2`, ... are converted automatically.)
Captions and authors can also be edited in the browser, see [Editing the site in the browser](#editing-the-site-in-the-browser).

The travel page reads `scripts/travel-photo-manifest.js`, so all photos in each country folder are picked up automatically.
The same command also creates lightweight JPEG thumbnails in each country folder's `thumbs/` directory. Travel cards load those thumbnails, while the fullscreen lightbox keeps using the original photo.

About page thumbnails are generated separately:

```sh
node scripts/generate-about-thumbnails.js
```

The About page's visible image tags use `images/about/thumbs/` so the page does not decode the original full-size photos just to show small cards.

## My Wild India

Drop MyWildIndia photos into `images/mywildindia/<place-folder>/` using any browser-friendly image extension (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`). Filenames can be anything.

Run the combined MyWildIndia sync to refresh the manifest, thumbnails, and caption workbook:

```sh
node scripts/generate-mywildindia-photo-manifest.js
```

The caption workbook lives at `data/mywildindia-captions.xlsx`. It is organized by folder, with rows keyed by filename only. The columns are `Photo`, `Caption`, and `Author`.

When you edit the workbook or add files, rerun the same sync command. The page reads `scripts/mywildindia-photo-manifest.js` and `scripts/mywildindia-captions.js`, so refreshing the browser after the sync picks up the new images immediately.

For live watching while you edit files, use:

```sh
node scripts/watch-mywildindia-caption-spreadsheet.js
```

## Talks

Drop a presentation PDF into `docs/talks/`, add its card to `talks.html` (`data-pdf` on the `<article>` and on the View Presentation button), then run:

```sh
npm run talks:sync
```

That does two things:

- `npm run talks:optimize` re-compresses the PDFs in place with ghostscript (images downsampled to 150 dpi, file linearized). Keynote/PowerPoint exports routinely shrink 5-10x with no visible difference on screen; files under 2 MB, and any result that barely saves anything, are left untouched.
- `npm run talks:thumbs` renders page 1 of each PDF to a ~100 KB poster in `images/talks/`. The cards show those posters, so opening the talks page no longer downloads any PDF.

Both need ghostscript (`brew install ghostscript`).

A deck is fetched only when its card is opened, behind a "Loading… %" cover. Once it is up, the remaining slides are rendered into memory in the background, so flipping through the deck does not flicker.

### Notebook cards

A `.ipynb` that's hosted (and rendered) elsewhere — e.g. an AstroStat Academy Jupyter Book page — gets a plain outbound-link card instead of a PDF-style viewer: a cover image, a teaser, and an "Open ... ↗" line that opens the hosted page in a new tab. See the NN Explainability card in `talks.html` for the pattern, and `.talks-link-card` in `css/talks_style.css` for its styling.

That card is deliberately a bare `<a>`, not a `.project-card` — research.js attaches expand-to-fullscreen behavior to every `.project-card` on the page, which this kind of card has nothing to expand into. Pick a cover image the same way as the notebook cards above: there's no single obvious "page 1", so crop/save a representative plot into `images/talks/<name>.jpg` yourself.

## News

Edit home page news in `data/news.xlsx`. To auto-refresh the browser data after each spreadsheet save, start the watcher once:

```sh
npm run news:watch
```

The watcher keeps running until you stop it with Ctrl+C.

## My Current Fixations

The cards on `fixations.html` come from `data/fixations.xlsx`, one row per card, in page order:

| Column | Value |
|---|---|
| Kind | `Books`, `Movies`, `Shows` or `Games` |
| Image | path inside `images/fixations/`, e.g. `games/totk.png` |
| Title | card heading (rows without a title are not shown) |
| Rating | 1-5 hearts |
| Description | short blurb |

Start the watcher once and leave it running:

```sh
npm run fixations:watch
```

Every workbook save regenerates `scripts/fixations-data.js`. Dropping a new cover into `images/fixations/<books|movies|shows|games>/` appends a row with Kind and Image already filled in; give it a Title (plus Rating and Description) and it appears on the page. Covers can be any aspect ratio. `npm run fixations:sync` does a one-off sync without watching.

### Editing in the browser

With `npm run edit` running (see [Editing the site in the browser](#editing-the-site-in-the-browser)), open <http://localhost:8790/fixations.html>. Edit mode turns each card into a form: type into the title and description, hover the hearts and click to rate (left half of a heart = half), pick the kind from the pill, hover the cover and click to replace it, × removes a card and the dashed **+** card adds one. **Save** copies new covers into `images/fixations/<kind>/`, rewrites `data/fixations.xlsx` in page order and regenerates `scripts/fixations-data.js`; **Cancel** throws the changes away. Close the workbook in Excel first, or reopen it afterwards, since the editor rewrites the file.

## Editing the site in the browser

```sh
npm run edit
```

then open <http://localhost:8790/> and browse to a page (`npm run edit:open`, `npm run edit --open` or `npm run edit -- --open timeline.html` opens the browser for you). Tap the pixel heart in the footer 5 times (pages with an editor also show an **Edit** button at the bottom right) to switch to edit mode. **Save** writes the changes into the spreadsheets and regenerates the page data; **Cancel** throws them away. All of this only works through this local server: on the published site the heart does nothing.

Pages with an editor so far:

- **My Current Fixations**: see [Editing in the browser](#editing-in-the-browser) above.
- **My Travels**: open a country; its photo grid ends with a **+** tile to add photos. Click a photo to give it a caption and pick its author (or add a new one). × on a photo marks it for removal (click again to keep it). Save copies new photos into `images/travels/<folder>/`, moves removed ones to `.edit-trash/travels/<folder>/` (git-ignored, so you can still restore them), writes `data/travel-captions.xlsx` and rebuilds the photo list and thumbnails.

- **Timeline**: **+ New month entry** at the top adds an entry; type the month (e.g. `March` or `January, February`) and year, and it moves to its place (newest first). In each entry, **+ Text** / **+ Image** add a block under the last one; the arrows move a block up or down, × removes it; hover an image and click to replace it, and the box below it is its description (alt text). Save copies new images into `images/timeline/` and rewrites the entries in `timeline.html` (only the part between the `timeline-entries` markers), adding the year separators and spacing itself; the previous version of the page is kept in `.edit-trash/timeline/`.

- **Publications**: each publication becomes a form: cover (hover and click to replace), title, authors (`**A. Lahiry**` for bold), journal line, one link per button (arXiv, NASA ADS, journal, project page: pick a Research card or type a URL; empty = no button), the BibTeX entry itself (saved as `bibtex/<name>.html`, which the BibTeX button opens), and the abstract (blank line = new paragraph). "Shown on the site" off keeps a publication in the page but hidden; arrows reorder, × removes, **+ New publication** adds one at the top. Save rewrites the cards between the `publications` markers in `publications.html` (previous version in `.edit-trash/publications/`).

- **Research** and **Software**: each card becomes a form. The card front has proper fields: cover (hover and click to replace), title and subtitle (inline HTML such as `<b>N</b>` allowed); on Software also category (Personal / Collaboration) and type (Science, Fun), which drive the filters and tag chips, badges (image URL + link), and icon links (GitHub, Docs, PyPI, Website, Zenodo, CosmoStat; empty = no icon). The expanded text is edited as HTML source, with **+ Figure** (pick an image; it is inserted at the cursor and uploaded on save) and **Preview** (renders it, equations and code included). Arrows reorder, × removes, **+ New card** adds one at the top. Save rewrites only the cards you changed; the others are written back exactly as they were (previous version of the page in `.edit-trash/research/` or `.edit-trash/software/`).

- **Talks & Teaching**: two kinds of card. A **presentation** has a date, description, image description and a PDF (Choose / Replace PDF; it is uploaded to `docs/talks/` on save); its cover is the poster rendered from page 1 of the PDF unless you click the cover and pick your own image, and **Preview** opens it in the page's PDF viewer, even before the PDF is saved. A **link card** (e.g. a notebook hosted elsewhere) has a label, description, link, link text, badge (e.g. IPYNB) and its own cover. Arrows reorder, × removes (the files stay in the repo), **+ Presentation** / **+ Link card** add one at the top. Save rewrites only the cards that changed, then compresses new PDFs and renders their posters (the same as `npm run talks:sync`); the previous version of the page is kept in `.edit-trash/talks/`.

Other pages say "No editor for this page yet". An editor is a script that registers itself with `scripts/edit-mode.js` (see the comment at its top) and saves through `scripts/edit-server.js`.
