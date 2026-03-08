# Home Organization — 3D Home Inventory Navigator

A React Router + Three.js + Supabase app for cataloging everything in your house
and navigating it in 3D. Search "tea tray" and the camera flies into your basement
and highlights the bottom cabinet.

## Architecture

- **Framework**: React Router v7 (framework mode, SPA — no SSR)
- **3D**: Three.js via @react-three/fiber + @react-three/drei
- **Database**: Supabase (Postgres + Storage + RLS)
- **Styling**: Plain CSS (app/app.css), dark theme

## Routes

- `/` — 3D house view (main experience) with grid fallback toggle
- `/rooms/:roomId` — 2D room detail with frame grid
- `/admin` — Floor plan editor, JSON import, Cowork setup instructions

## Database Schema

- `rooms` — id, name, icon, pos_x/y/z, width/depth/height, color
- `frames` — id, room_id, image_url, timestamp
- `items` — id, frame_id, name, location, pin_x/y/z

Full-text search via `search_items(query)` Postgres function.

## Cowork Integration (for cataloging items from video frames)

When the user gives you video frames to catalog:

1. Analyze each frame, identify items and their locations
2. Build a JSON payload matching the structure in `scripts/push-to-supabase.ts`
3. Write the JSON to a temp file
4. Run: `npx tsx scripts/push-to-supabase.ts <path-to-json>`

Or use the Supabase client directly:
- URL: env VITE_SUPABASE_URL
- Key: env VITE_SUPABASE_ANON_KEY

The JSON structure for a room catalog is:
```json
{
  "supabase_url": "...",
  "supabase_key": "...",
  "room": {
    "name": "Kitchen",
    "icon": "K",
    "color": "#5d4037",
    "width": 5,
    "depth": 4,
    "height": 2.7
  },
  "frames": [
    {
      "image_path": "/path/to/frame.jpg",
      "timestamp": "0:04",
      "items": [
        { "name": "Tea tray", "location": "Bottom cabinet, left side" }
      ]
    }
  ]
}
```

## Dev

```bash
npm install
cp .env.example .env  # fill in Supabase credentials
npm run dev
```
