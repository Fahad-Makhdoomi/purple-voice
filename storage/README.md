# storage/

`uploads/` holds media uploaded through the admin panel when `STORAGE_DRIVER=local`.
nginx serves it at `/uploads/` with year-long immutable caching (file names carry a
content hash, so a changed image always gets a new URL). It is not committed; back it
up with the database (see docs/DEPLOYMENT.md).
