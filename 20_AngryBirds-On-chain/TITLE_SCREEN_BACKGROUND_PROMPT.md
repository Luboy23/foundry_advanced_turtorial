# Title Screen Background Prompt

This prompt is tuned for the current Phaser title scene layout in `frontend/src/game/scenes/TitleScene.ts`:

- top title text occupies the upper center band
- a large menu panel sits in the center
- important background action should stay in the lower-left and lower-right

Recommended output size: `2560 x 1440`
Recommended model: `Gemini / Imagen`

## Main Prompt

```text
Use case: stylized-concept
Asset type: title-screen background for a Phaser casual slingshot game
Input images: Image 1 is the current title-screen background reference; use it for overall screen layout, cheerful mood, and UI-safe composition. Image 2 is the current gameplay background reference; use it for the brighter outdoor color palette, landscape atmosphere, and game-world feeling.
Primary request: Create a single cohesive 2560 x 1440 pixel title-screen background illustration for a bright cartoon slingshot bird game. The image must feel like the same world as the game scene, but redesigned specifically for the title screen. Include recognizable classic-style red birds, green pigs, and wooden structure pieces. The image should feel polished, playful, readable, charming, and production-ready for a game start menu.

Scene/backdrop: bright blue sky, soft rounded white clouds, distant snow mountains, layered green meadow hills, clean sunny daytime lighting, lighthearted outdoor cartoon atmosphere
Subject: in the lower-left foreground place a wooden slingshot with one red bird ready to launch and two or three additional red birds nearby; in the lower-right foreground place a tidy wooden structure made of rectangular and triangular wooden pieces with two or three green pigs around or inside it
Style/medium: polished 2D cartoon illustration, classic mobile slingshot game readability, clean outlines, soft shading, vivid but not neon colors, family-friendly arcade game style
Composition/framing: wide side-view composition like a playable game world. Keep the most important action in the bottom-left and bottom-right corners. Keep the upper center calm and readable for the title text. Keep the central middle zone visually softer and lower-detail because a large in-game menu panel will cover that area. Allow scenery to continue behind the center zone, but do not place important bird faces, pig faces, slingshot forks, or key structure joints in the middle of the image.
Layout safety: reserve the top 18 percent of the image as a clean title area. Reserve the center 60 percent width by 42 percent height as a UI-safe zone with gentle landscape only, low contrast, and no important characters. Put the strongest character silhouettes below the horizontal midline.
Lighting/mood: clear, bright, optimistic, inviting, lighthearted game-opening mood
Color palette: sky blue, white, fresh green, warm wood brown, bright red, lively pig green, soft mountain blue
Constraints: no text, no logo, no watermark, no user interface, no menu panel, no frame, no buttons, no coins, no extra fantasy props, no explosions, no heavy dust cloud, no heavy motion blur, no photorealism
Avoid: dark scene, sunset lighting, dramatic battle damage, cluttered center, oversized characters blocking the middle, realistic textures, off-model birds or pigs, extreme perspective, cropped slingshot, cropped pigs, cropped birds, messy background noise
```

## Short Retry Prompt

Use this shorter version if Gemini overcomplicates the scene:

```text
Create a 2560 x 1440 bright cartoon title-screen background for a casual slingshot bird game. Match the classic Angry Birds-like 2D mobile game style. Show a wooden slingshot with red birds in the lower-left corner, and a wooden structure with green pigs in the lower-right corner. Use a blue sky, soft white clouds, distant snow mountains, and green meadow hills. Keep the top-center clean for the title, and keep the center area low-detail and calm because a large menu panel will sit there. No text, no logo, no UI, no watermark, no photorealism, no clutter in the center.
```

## Negative Prompt

```text
text, logo, watermark, user interface, buttons, popup panel, dialog box, menu frame, photorealism, realistic texture, cinematic blur, dark mood, storm, sunset, fire, explosion, dust cloud in center, debris in center, crowded center, extra characters, fantasy castle, vehicles, weapons, extreme perspective, distorted birds, distorted pigs, cropped slingshot, cropped faces
```

## Upload Guidance

- Best case: upload `2` references
  - current title-screen screenshot for layout and safe zones
  - current gameplay background or gameplay screenshot for environment style
- If only one reference is allowed, upload the current title-screen screenshot first
- Ask Gemini to keep the result as `one single background image only`

## Acceptance Checklist

- red birds are clearly visible
- green pigs are clearly visible
- wooden structure pieces are clearly visible
- slingshot reads clearly in the lower-left
- pig/structure target area reads clearly in the lower-right
- top-center stays clean enough for `ANGRY BIRDS`
- center stays calm enough for the large menu panel overlay
- overall look matches the bright cartoon style of the gameplay scene
