# public/images

Static images that ship with the code. **One folder per page** — an image used on
the home page lives in `home/`, one used on pricing in `pricing/`, and so on.
Brand assets (logo, mark) live in `brand/`.

```
images/
  brand/     logo, mark, social card source
  home/      home page only
  pricing/   pricing page only
  blog/      shared blog chrome (post images are uploaded via Admin → Media)
  auth/      sign-in / sign-up screens
```

Rules, enforced by `npm run images:check` (run in CI):

1. Raster images are **WebP**. Drop a PNG/JPEG in and run `npm run images` — it
   converts to WebP at the **same width and height** and removes the original.
2. **No duplicates.** The same picture is stored once and referenced from
   wherever it's needed; the check compares file contents, not names.
3. Nothing loose in `images/` itself.

Always render images with `next/image` (it serves AVIF/WebP at the right size
and lazy-loads below the fold) and give hero images `priority`.

Images uploaded by staff through the admin panel don't live here: they go
through the same WebP + de-duplication pipeline on the API and are stored in
`storage/uploads/<folder>/` (or the S3 bucket), one folder per page or post.
