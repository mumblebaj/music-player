# Music Player

A browser-based music player for locally selected audio files. The app is a static HTML/CSS/JavaScript site and is deployed on GitHub Pages.

Live site: https://player.mumbleb.com

## Functionality

- Import individual audio files from your device.
- Import an entire folder of audio and image files.
- Read embedded track metadata with `jsmediatags` when available.
- Display album art from embedded tags or matching sidecar image files.
- Maintain a clickable playback queue.
- Play, pause, skip forward, and skip backward.
- Seek through the current track with the progress bar.
- Toggle between light and dark themes.
- Clear the queue and release generated object URLs when done.

## How It Works

This player does not stream music from a server. It runs entirely in the browser and plays files selected by the user at runtime.

- Audio files are loaded with the file input APIs.
- Playback uses browser object URLs created from the selected files.
- Metadata is read client-side with `jsmediatags`.
- Queue state is stored in memory for the current session only.

Because of that design:

- GitHub Pages hosts the app itself, not your music library.
- Each user imports their own files locally.
- No upload step or backend is required.

## Supported Media

Audio extensions recognized by the app include:

- `mp3`
- `wav`
- `ogg`
- `flac`
- `aac`
- `m4a`

Image extensions recognized for cover art include:

- `jpg`
- `jpeg`
- `png`
- `webp`
- `gif`

When importing a folder, the player can use sidecar images such as `cover`, `folder`, `front`, `album`, or `albumart` when a track does not include embedded artwork.

## Project Structure

- `index.html` sets up the player UI.
- `style.css` contains layout, theme, and queue styling.
- `script.js` manages imports, playback, queue behavior, metadata, and themes.
- `img/` contains default artwork and related assets.

## Deployment

This site is configured for GitHub Pages with a custom domain.

- `.github/workflows/deploy.yml` deploys the site on pushes to `main`.
- `.nojekyll` disables Jekyll processing so files are served as a plain static site.
- `CNAME` configures the custom domain `player.mumbleb.com`.

## Local Preview

You can open `index.html` directly in a browser, or serve the folder with any simple static server.

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Notes

- The queue is session-based and resets on reload.
- Browser support for folder import depends on the file input directory APIs.
- Album art falls back to the default image if embedded or sidecar artwork is unavailable.