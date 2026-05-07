-- Photo is now optional. Listings without a photo skip OpenAI validation
-- and render with a fallback motif placeholder on the card.
alter table badamangals alter column photo_path drop not null;
