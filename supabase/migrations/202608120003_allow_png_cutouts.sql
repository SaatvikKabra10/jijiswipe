-- Some iPhone Safari versions return a transparent PNG when WebP encoding is requested.
update storage.buckets
set allowed_mime_types = array['image/webp', 'image/png']
where id = 'clothing';
