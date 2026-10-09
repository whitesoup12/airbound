import math
from PIL import Image, ImageDraw

SIZE = 512
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background rounded rect
radius = 110
bg_color = (15, 23, 42, 255) # slate-900
border_color = (30, 41, 59, 255) # slate-800

draw.rounded_rectangle([8, 8, SIZE - 8, SIZE - 8], radius=radius, fill=bg_color, outline=border_color, width=6)

# Draw stylized airplane polygon
# Centered at (256, 256)
# Original SVG coordinates from (0,0) to (24,24)
# Path: M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z
scale = 14.5
offset_x = 256 - (12 * scale)
offset_y = 256 - (12 * scale)

svg_points = [
    (21, 16),
    (21, 14),
    (13, 9),
    (13, 3.5),
    (12.5, 2),
    (11.5, 2),
    (11, 3.5),
    (11, 9),
    (3, 14),
    (3, 16),
    (11, 13.5),
    (11, 19),
    (9, 20.5),
    (9, 22),
    (12.5, 21),
    (16, 22),
    (16, 20.5),
    (14, 19),
    (14, 13.5)
]

canvas_points = [(offset_x + x * scale, offset_y + y * scale) for (x, y) in svg_points]

# Cyan airplane fill with subtle shadow
shadow_points = [(x, y + 4) for (x, y) in canvas_points]
draw.polygon(shadow_points, fill=(6, 182, 212, 100))
draw.polygon(canvas_points, fill=(6, 182, 212, 255), outline=(56, 189, 248, 255))

img.save('electron/assets/icon.png', 'PNG')
print('Generated electron/assets/icon.png successfully!')
