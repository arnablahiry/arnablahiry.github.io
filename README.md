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
