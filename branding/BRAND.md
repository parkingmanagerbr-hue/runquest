# RunQuest — Brand Guide

## Logo

3 variantes em `branding/`:

| Arquivo | Uso |
|---------|-----|
| `runquest_logo_main.svg` (1024×1024) | App icon principal — iOS/Android store, splash, favicon HiDPI |
| `runquest_icon_simple.svg` (1024×1024) | Versão simplificada — favicons pequenos, badges in-app, notificações |
| `runquest_logo_horizontal.svg` (1600×480) | Header de site, e-mails, app stores (feature graphic), social headers |

SVG nativo: escalável sem perda, editável, sem dependência de IA externa. Para exportar PNG:
```bash
# Inkscape
inkscape runquest_logo_main.svg --export-type=png --export-filename=runquest_1024.png -w 1024 -h 1024
# ImageMagick
magick -background none -density 300 runquest_logo_main.svg runquest_1024.png
# Online: usar svgomg.firebaseapp.com ou cloudconvert.com
```

## Paleta

| Token | Hex | Uso |
|-------|-----|-----|
| `--rq-lime` | `#A8FF3E` | Energia, conquista, XP — CTA primário |
| `--rq-emerald` | `#3DD68C` | Sucesso, progresso, missões completadas |
| `--rq-violet` | `#5B2EFF` | Premium, IA, profundidade, mistério |
| `--rq-orange` | `#FF7A1A` | Streak, motion, alertas positivos |
| `--rq-gold` | `#FFE15A` | Badges, conquistas raras, level up |
| `--rq-ink` | `#0E0A2A` | Background dark mode |
| `--rq-night` | `#1A1240` | Cards, surfaces |

## Tipografia

- **Display / Wordmark:** Inter Black Italic (web), SF Pro Display Black (iOS), Roboto Black (Android)
- **Body:** Inter / SF Pro / Roboto
- **Numerais (timer, pace, km):** JetBrains Mono Bold (tabular)

## Símbolo

O símbolo é a fusão de **3 conceitos**:
1. **Runner em mid-stride** — fitness, movimento
2. **Seta ascendente** formada pelo braço estendido + perna traseira → progresso, level-up
3. **Hexágono** ao redor → territórios H3 conquistáveis no mapa (mecânica core)

A trilha laranja por trás indica velocidade/streak.
