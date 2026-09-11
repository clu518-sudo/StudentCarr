# StudentCarr sidebar icons

Eight original raster navigation icons generated with the built-in image-generation tool (not the CLI). The existing links, labels, active-route logic, admin filtering, and API calls are unchanged.

## Files and rendering

- Original transparent PNGs: `source/<name>-v1.png`.
- Production transparent WebP assets: `../../public/icons/sidebar/<name>-v1.webp`.
- Production dimensions: 96 × 96 pixels, displayed at 32 × 32 CSS pixels for high-density screens.
- The images are decorative (`alt=""`); navigation keeps its accessible link labels.
- Active and hover treatments are CSS-only, with motion disabled when reduced motion is requested.
- Original generated images are retained unchanged. Only resizing and WebP compression are applied for delivery.

Regenerate the production files from `App` with `node scripts/optimize-sidebar-icons.cjs` when `sharp` is installed, or pass a path to a local `sharp` package as the first argument. No runtime package is required.

## Exact generation prompts

The original design brief asked for 28 CSS pixels; visual integration uses a 32-pixel image box so the transparent margin leaves a legible small symbol.

### dashboard

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: Four plump rounded squares in a precise 2 by 2 grid, representing dashboard. Primary cornflower blue with periwinkle bevels and pale ice-blue highlights.
```

### profile

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: A friendly abstract person bust: one circular head above one rounded shoulders shape, representing profile. Primary periwinkle with soft lilac bevels and pale lavender highlights. No facial details.
```

### skills

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: A single chunky lightbulb with a rounded bulb and a short simple two-band base, representing skills. Primary warm honey gold bulb, pale butter highlights, periwinkle base. No rays.
```

### progress

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: Three thick rounded vertical chart bars aligned on a shared baseline, increasing from left to right, representing progress. Primary mint teal with pale mint highlights and restrained blue-teal bevels. No arrow or axes.
```

### jobs

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: A single compact briefcase with a rounded rectangular body, simple handle at top, one little central clasp, representing jobs. Primary cornflower blue, pale blue highlights, understated periwinkle bevels.
```

### applications

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: A single thick rounded document sheet with a softly folded upper-right corner, two short embossed horizontal lines, and one small checkmark on lower half, representing applications. Primary pale periwinkle-blue, icy highlights, mint checkmark. No actual letters or text.
```

### interview

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: Two overlapping rounded speech bubbles with simple short tails, representing interview. Large front bubble in soft cyan-blue, smaller rear bubble in periwinkle. Two or three bold small dots inside front bubble, no text.
```

### settings

```text
Use case: stylized-concept.
Asset type: one production sidebar navigation icon for the StudentCarr dark navy career app, displayed at 28 CSS pixels.
Style: elegant miniature 3D pictogram, rounded solid geometry with a satin enamel finish, slight beveled depth, almost front-facing orthographic view, soft upper-left lighting. Simple bold silhouette, few large shapes, very restrained highlights. No detailed textures. Design for legibility when tiny.
Composition: one centered symbol, square canvas, symbol fills 80% of canvas with even 10% clear margin. Genuinely transparent background with alpha, including gaps. No backdrop, no enclosing app tile, no floor, no surrounding glow, no cast shadow outside the silhouette.
Constraints: no text, letters, numbers, labels, extra ornaments, border, watermark or mockup. One icon only.
Subject: A single friendly chunky six-tooth gear with a large circular hole through its center, representing settings. Primary slate-periwinkle blue with icy blue highlights. No extra objects.
```

