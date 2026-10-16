"""Builds RepProof's app icon, adaptive icon layers, splash mark, favicon, notification icon and Play Store
graphics from the brand mark in the approved Design System v1.0 (burgundy #7A1F3D tile, white outline heart,
as on the welcome screen). Re-run after changing the mark:  python scripts/make-brand-assets.py
Needs Pillow. Reads the Ionicons and Bricolage Grotesque fonts already installed in node_modules."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
NM = ROOT / 'node_modules'
IONICONS = NM / '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
DISPLAY = next((NM / '@expo-google-fonts/bricolage-grotesque/700Bold').glob('*.ttf'))
BODY = next((NM / '@expo-google-fonts/dm-sans/500Medium').glob('*.ttf'))
HEART = chr(62327)  # Ionicons "heart-outline"
BURGUNDY, CREAM, INK, WHITE = (122, 31, 61, 255), (251, 246, 241, 255), (42, 22, 32, 255), (255, 255, 255, 255)
SS = 4  # supersampling for smooth edges


def heart(size: int, scale: float, color, bg=(0, 0, 0, 0), tile=False) -> Image.Image:
    """`size` square with the heart glyph at `scale` of the width, optionally on a rounded burgundy tile."""
    big = size * SS
    img = Image.new('RGBA', (big, big), bg)
    d = ImageDraw.Draw(img)
    if tile:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.24), fill=BURGUNDY)
    font = ImageFont.truetype(str(IONICONS), int(big * scale))
    l, t, r, b = d.textbbox((0, 0), HEART, font=font)
    d.text(((big - (r - l)) / 2 - l, (big - (b - t)) / 2 - t), HEART, font=font, fill=color)
    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, rel: str):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(f'{rel}: {img.size[0]}x{img.size[1]}')


# Launcher and store icon: full-bleed square (Android and Play apply their own mask).
save(heart(1024, 0.56, WHITE, BURGUNDY), 'assets/images/icon.png')
# Adaptive icon (108 dp canvas; the mark stays inside the central 66 dp safe zone).
save(Image.new('RGBA', (1024, 1024), BURGUNDY), 'assets/images/android-icon-background.png')
save(heart(1024, 0.42, WHITE), 'assets/images/android-icon-foreground.png')
save(heart(1024, 0.42, WHITE), 'assets/images/android-icon-monochrome.png')
# Splash: the rounded brand tile on the cream app background (set in app.json).
save(heart(512, 0.5, WHITE, tile=True), 'assets/images/splash-icon.png')
save(heart(48, 0.56, WHITE, tile=True), 'assets/images/favicon.png')
# Android status-bar notification icon: white silhouette on transparent.
save(heart(96, 0.8, WHITE), 'assets/images/notification-icon.png')

# Play Store listing: 512x512 icon and 1024x500 feature graphic.
save(heart(512, 0.56, WHITE, BURGUNDY).convert('RGB'), 'store/play-icon-512.png')
fg = Image.new('RGBA', (1024 * SS, 500 * SS), CREAM)
d = ImageDraw.Draw(fg)
tile = heart(220 * SS // SS, 0.5, WHITE, tile=True).resize((220 * SS, 220 * SS), Image.LANCZOS)
fg.alpha_composite(tile, (90 * SS, 140 * SS))
d.text((360 * SS, 128 * SS), 'RepProof', font=ImageFont.truetype(str(DISPLAY), 72 * SS), fill=BURGUNDY)
d.text((360 * SS, 230 * SS), 'Train on evidence.', font=ImageFont.truetype(str(DISPLAY), 52 * SS), fill=INK)
d.text((360 * SS, 292 * SS), 'Not on hype.', font=ImageFont.truetype(str(DISPLAY), 52 * SS), fill=INK)
save(fg.resize((1024, 500), Image.LANCZOS).convert('RGB'), 'store/play-feature-graphic-1024x500.png')
