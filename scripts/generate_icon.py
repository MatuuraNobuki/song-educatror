"""
Song Educator app icon generator
Design: light-blue gradient background, white music note + graduation cap
"""
from PIL import Image, ImageDraw, ImageFilter
import os
import math

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES_DIR = os.path.join(BASE_DIR, "android", "app", "src", "main", "res")

SIZES = [
    ("mipmap-mdpi",    48,  108),
    ("mipmap-hdpi",    72,  162),
    ("mipmap-xhdpi",   96,  216),
    ("mipmap-xxhdpi",  144, 324),
    ("mipmap-xxxhdpi", 192, 432),
]

# Colors
BG_TOP    = (188, 214, 247)   # #BCD6F7 light periwinkle
BG_BOTTOM = (108, 157, 220)   # #6C9DDC medium blue
WHITE     = (255, 255, 255)


def make_gradient_bg(size):
    """Create a top-left → bottom-right blue gradient image."""
    img = Image.new("RGBA", (size, size))
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
            g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
            b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
            img.putpixel((x, y), (r, g, b, 255))
    return img


def draw_music_notes(draw, cx, cy, S):
    """
    Draw a pair of beamed eighth notes (♫) centred around (cx, cy).
    S = icon size.
    """
    # Scale factor
    f = S / 100.0

    # Note head dimensions
    hw = int(9 * f)   # half-width of ellipse
    hh = int(7 * f)   # half-height of ellipse

    # Left note head centre
    lx = int(cx - 11 * f)
    ly = int(cy + 18 * f)

    # Right note head centre
    rx = int(cx + 11 * f)
    ry = int(cy + 14 * f)

    # Stem height
    stem_h = int(36 * f)
    stem_w = max(2, int(3.5 * f))

    # Beam
    beam_h = max(2, int(4 * f))

    # --- Left note head ---
    draw.ellipse([lx - hw, ly - hh, lx + hw, ly + hh], fill=WHITE)

    # --- Right note head ---
    draw.ellipse([rx - hw, ry - hh, rx + hw, ry + hh], fill=WHITE)

    # --- Left stem ---
    l_stem_x = lx + hw - stem_w
    draw.rectangle(
        [l_stem_x, ly - stem_h, l_stem_x + stem_w, ly],
        fill=WHITE,
    )

    # --- Right stem ---
    r_stem_x = rx + hw - stem_w
    draw.rectangle(
        [r_stem_x, ry - stem_h, r_stem_x + stem_w, ry],
        fill=WHITE,
    )

    # --- Beam connecting tops of stems ---
    beam_y_left  = ly - stem_h
    beam_y_right = ry - stem_h
    pts = [
        (l_stem_x,              beam_y_left),
        (r_stem_x + stem_w,     beam_y_right),
        (r_stem_x + stem_w,     beam_y_right + beam_h),
        (l_stem_x,              beam_y_left  + beam_h),
    ]
    draw.polygon(pts, fill=WHITE)

    # Return beam top-centre for cap placement
    beam_cx = (l_stem_x + r_stem_x + stem_w) // 2
    beam_top = min(beam_y_left, beam_y_right)
    return beam_cx, beam_top


def draw_graduation_cap(draw, cx, top_y, S):
    """
    Draw a mortarboard centred at cx, with bottom at top_y.
    S = icon size.
    """
    f = S / 100.0

    board_w  = int(46 * f)
    board_h  = int(8  * f)
    cap_w    = int(22 * f)
    cap_h    = int(12 * f)
    tassel_l = int(16 * f)
    tassel_r = int(2  * f)

    board_top = int(top_y - board_h - cap_h - int(4 * f))

    # --- Cap body (under the board) ---
    cap_left = cx - cap_w // 2
    cap_top  = board_top + board_h
    draw.rectangle(
        [cap_left, cap_top, cap_left + cap_w, cap_top + cap_h],
        fill=WHITE,
    )

    # --- Board (flat top, trapezoid look via polygon) ---
    skew = int(3 * f)
    board_pts = [
        (cx - board_w // 2 + skew, board_top),
        (cx + board_w // 2 + skew, board_top),
        (cx + board_w // 2 - skew, board_top + board_h),
        (cx - board_w // 2 - skew, board_top + board_h),
    ]
    draw.polygon(board_pts, fill=WHITE)

    # --- Small button on top ---
    btn_r = max(2, int(3 * f))
    draw.ellipse(
        [cx - btn_r, board_top - btn_r, cx + btn_r, board_top + btn_r],
        fill=WHITE,
    )

    # --- Tassel (line + small circle, hangs from right side of board) ---
    tassel_x = cx + board_w // 2
    tassel_y0 = board_top + board_h // 2
    tassel_y1 = tassel_y0 + tassel_l
    draw.line(
        [tassel_x, tassel_y0, tassel_x + int(4 * f), tassel_y1],
        fill=WHITE,
        width=max(2, int(2.5 * f)),
    )
    tip_r = max(2, int(3.5 * f))
    tip_x = tassel_x + int(4 * f)
    draw.ellipse(
        [tip_x - tip_r, tassel_y1 - tip_r, tip_x + tip_r, tassel_y1 + tip_r],
        fill=WHITE,
    )


def make_icon(size, shape="rounded"):
    """
    shape: 'rounded' | 'circle' | 'transparent'
    transparent = no background (foreground layer for adaptive icon)
    """
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if shape != "transparent":
        # Gradient background
        grad = make_gradient_bg(size)

        # Mask for shape
        mask = Image.new("L", (size, size), 0)
        md   = ImageDraw.Draw(mask)
        if shape == "rounded":
            r = size // 5
            md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        else:  # circle
            md.ellipse([0, 0, size - 1, size - 1], fill=255)

        img.paste(grad, mask=mask)

    draw = ImageDraw.Draw(img)

    cx = size // 2
    cy = int(size * 0.54)

    beam_cx, beam_top = draw_music_notes(draw, cx, cy, size)
    draw_graduation_cap(draw, beam_cx, beam_top, size)

    return img


def save_png(img, path):
    img.convert("RGB").save(path, "PNG", optimize=True)
    print(f"  saved: {os.path.relpath(path, BASE_DIR)}")


def main():
    print("Generating Song Educator app icons...\n")

    for folder, launcher_size, fg_size in SIZES:
        res_path = os.path.join(RES_DIR, folder)
        print(f"[{folder}]")

        save_png(make_icon(launcher_size, "rounded"),     os.path.join(res_path, "ic_launcher.png"))
        save_png(make_icon(launcher_size, "circle"),      os.path.join(res_path, "ic_launcher_round.png"))
        save_png(make_icon(fg_size,       "transparent"), os.path.join(res_path, "ic_launcher_foreground.png"))

    print("\nDone!")


if __name__ == "__main__":
    main()
