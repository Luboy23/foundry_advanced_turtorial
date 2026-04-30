# SOURCES

> Project: `20_AngryBirds-On-chain`  
> Scope: `frontend/public/` 当前保留运行时视觉素材来源  
> Status: `active`  
> Updated: `2026-04-18`

## 说明

- 这份文件只记录当前仓库里仍然保留、且与前端运行时直接相关的视觉素材。
- `audio/` 下的运行时音频不在本表逐项登记。
- `2026-04-17` 起，当前保留图片统一集中在 `game-images/` 目录。
- `2026-04-18` 起，当前运行时资源改为按 `characters / props / fonts`
  语义目录组织，不再保留旧的导入期命名。
- `levels/`、`contract-config.json` 属于数据或配置，因此不在本表逐项登记。

## 当前目录

```text
frontend/public/
├── game-images/
│   ├── app/
│   ├── backgrounds/
│   ├── characters/
│   ├── fonts/
│   └── props/
├── levels/
├── LICENSES.md
└── SOURCES.md
```

## 当前保留素材

- File group:
  `game-images/characters/**`,
  `game-images/props/**`,
  `game-images/fonts/hud-score-numbers.*`
  Source: `legacy Angry Birds demo-derived sprite pack`
  Author / owner: `Rovio Entertainment Ltd.`
  Status: `in-use`

- File group:
  `game-images/backgrounds/play-backdrop-meadow-mountains.png`,
  `game-images/backgrounds/bg-home.png`,
  `game-images/backgrounds/play-foreground-grass-clean.png`
  Source: `project-local generated / composited backgrounds`
  Reference:
  `TITLE_SCREEN_BACKGROUND_PROMPT.md`
  Status: `in-use`

- File group: `game-images/app/favicon.png`
  Source: `project-local app asset`
  Status: `in-use`
