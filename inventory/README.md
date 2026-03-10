# Item Cataloging — Inventory Data

This directory holds all item cataloging output.

## Structure

- `boxes/` — Individual box logs (one file per box)
- `flagged-for-removal.md` — Running list of items flagged for donate/trash
- `inventory-master.json` — Machine-readable master inventory (feeds into Supabase)
- `session-logs/` — Raw processing logs from each video session

## Workflow

1. User uploads video → processed via video-ingest skill
2. Frames + transcript analyzed → items identified
3. Items logged into box files + master inventory
4. Flagged items added to removal list
5. Master JSON eventually pushed to Supabase
