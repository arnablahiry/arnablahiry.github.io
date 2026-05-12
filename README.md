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
