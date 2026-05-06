# Reference image placeholders

Drop three real reference photos of authentic bhandara/badamangal setups here as:

- `ref-1.jpg`
- `ref-2.jpg`
- `ref-3.jpg`

Then run `npm run upload:refs` to upload them to the private `reference-images` Supabase Storage bucket. The Gemini validator caches them in memory at server cold-start.

Suitable references show:
- Communal cooking vessels (kadhai / deg / pateela)
- Volunteers preparing or distributing food
- Rows of seated devotees being served on plates or banana leaves
- Saffron-clad organisers
- Temple, courtyard, pandal, or public-square setting

To swap them later, replace the files and re-run `upload:refs`, then redeploy (the in-memory cache is process-lifetime).
