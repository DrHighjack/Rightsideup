# PWA Icons Setup

This folder should contain the following icons for PWA support:

## Required Files

1. **icon-192.png** - 192x192 square icon (PNG format)
   - Used for app home screen icon on mobile devices
   - Minimum recommended for Android

2. **icon-512.png** - 512x512 square icon (PNG format)
   - Used for splash screens and app icons
   - For high-resolution displays

3. **apple-touch-icon.png** - 180x180 square icon (PNG format)
   - Used specifically for iOS "Add to Home Screen"
   - Should have a white background or solid color

## Design Guidelines

- Use the brand green color (#1a6640) as background
- Include "SignPost" or "SP" as the main visual
- Keep design simple and recognizable at small sizes
- Avoid transparency for apple-touch-icon (iOS doesn't support it well)

## How to Create

Use any image editor or online tool:
- Figma: Create 512x512 artboard, scale to 192x192 for second icon
- Adobe XD
- Photoshop
- Online tools: https://www.favicon-generator.org/

Place generated PNG files in this directory: `/public/`

The manifest.json and app already reference these files.
