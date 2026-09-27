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
Each row maps `photo 1`, `photo 2`, etc. to a caption. Captions entered there are used by the travel lightbox.
When new country folders or photos are added, rerunning the sync command auto-adds new sheets/rows while preserving existing captions.

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
