# Evpower charging animation

Standalone downloads of the blue/cyan EV charging animation from the Kedir digital card.

- **evpower-charging-animation.mp4** — silent video for saving to a phone, sharing, or using in another project. Turn on repeat in your player for continuous playback.
- **evpower-charging-animation.html** — the animation in a self-contained browser file. Download it and open it in a browser; its visual assets are embedded and it loops automatically. Browser reduced-motion preferences are respected.

The animation shows the vehicle parking, connecting, charging, disconnecting and departing. These downloads contain the animation without personal contact details, QR codes or business-card controls.

The MP4 is 1280 × 960, 30 fps and 21.6 seconds, with no audio. Its first and last loop states match. The H.264 video uses the broadly supported yuv420p format and fast-start playback.

To rebuild from the scene source, run `python digital-card/build-animation-export.py`, then `python digital-card/render-animation.py` in an environment with Playwright, Chromium and FFmpeg installed. The card source and published pages are separate from these animation-only files.
