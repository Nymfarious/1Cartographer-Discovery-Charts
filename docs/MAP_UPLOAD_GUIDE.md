# Historical Map Upload Guide

## Preserving High-Resolution Maps

This application uses Deep Zoom Image (DZI) technology to preserve and display ultra-high-resolution historical maps without losing quality.

### Current Architecture

Your map collection system includes:

1. **Storage Buckets** (Supabase Storage)
   - `base_maps` - Public bucket for storing original high-res images
   - `tiles` - Private bucket for storing DZI tiles
   - `overlays` - Public bucket for thematic overlays

2. **Database Table: `base_maps`**
   - Stores metadata: title, attribution, license, region
   - Links to file paths in storage
   - Tracks who uploaded the map

3. **Tile Generation Script** (`scripts/tile-image.mjs`)
   - Converts large images into DZI format (Deep Zoom Image)
   - Creates pyramid of tiles at multiple zoom levels
   - Adds watermarks for demo/protected content
   - Uses Sharp library for image processing

4. **Edge Function** (`ingestPoster`)
   - Handles file uploads from the UI
   - Processes images and generates tiles
   - Saves metadata to database

### How to Upload High-Resolution Maps

#### Method 1: Local Upload (Admin Only)
Via the **History** page → **Local Upload** tab:
1. Select your high-resolution image (recommended: 2000+ pixels)
2. Enter title and attribution
3. Choose license status
4. Click "Upload Map to Archive"

**The system will:**
- Store the original file in `base_maps` bucket
- Generate DZI tiles for smooth zooming
- Create thumbnail for library view
- Save metadata to database

#### Method 2: Cloud Download (Admin Only)
Via the **History** page → **Cloud Download** tab:
1. Paste direct image URL from archives (Wikipedia, Library of Congress, etc.)
2. Enter title and attribution
3. Choose license status
4. Click "Download & Import"

**Recommended sources:**
- Wikimedia Commons
- Library of Congress
- Internet Archive
- British Library Collections
- David Rumsey Map Collection

### Technical Details

#### DZI Tile Format
- Each map is split into 256×256 pixel tiles
- Multiple zoom levels (pyramid structure)
- Overlap: 1 pixel between tiles for seamless display
- Format: JPEG (quality 90)

#### Why DZI?
- **Scalability**: View gigapixel images smoothly
- **Performance**: Only loads visible tiles
- **Zoom**: Infinite zoom without quality loss
- **Compatibility**: Works with OpenSeadragon viewer

### Viewing Maps

Maps in your library use **OpenSeadragon** for viewing:
- Pan by dragging
- Zoom with mouse wheel or pinch
- Full-screen mode available
- Smooth tile loading

### Next Steps (Queue)

1. **Load Button Wiring**
   - Connect "Load Selected Map" button
   - Display selected map in viewer
   - Navigate between maps

2. **Dev Library Interface**
   - Preferences page integration
   - Default map selection
   - Quick access to favorites

3. **Overlay System**
   - Year-based thematic overlays
   - Toggle layers on/off
   - Custom annotations

### File Size Considerations

**Original files:**
- Maximum recommended: 100MB per file
- Larger files will take longer to process
- High-res JPEGs work best (avoid PNG for photos)

**Storage efficiency:**
- DZI tiles are efficiently compressed
- System auto-generates smaller zoom levels
- Original file preserved for archival

### Troubleshooting

**Upload fails:**
- Check file size (must be under 100MB)
- Ensure image format is supported (JPG, PNG, TIFF)
- Verify you have admin role

**Tiles not displaying:**
- Check browser console for errors
- Verify tiles bucket has correct permissions
- Check DZI file path in database

**Slow loading:**
- Large original images take time to process
- First view generates tiles (one-time process)
- Subsequent views are fast (tiles cached)

---

**Note:** The tile generation happens automatically in the background via edge functions. No manual intervention needed!
