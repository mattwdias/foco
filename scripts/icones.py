import struct, zlib, pathlib

def png(n, path):
    bg, fg = (0x00, 0x71, 0xe3, 255), (255, 255, 255, 255)
    px = [[bg] * n for _ in range(n)]
    t  = round(.085 * n)
    x0 = round(.36 * n); y0 = round(.28 * n); y1 = round(.72 * n)
    ym = y0 + round((y1 - y0) * .42)
    for ax, ay, bx, by in [(x0, y0, x0 + t, y1),                    # haste
                           (x0, y0, x0 + round(.30 * n), y0 + t),   # braco de cima
                           (x0, ym, x0 + round(.23 * n), ym + t)]:  # braco do meio
        for y in range(ay, by):
            for x in range(ax, bx):
                px[y][x] = fg
    cru = b"".join(b"\0" + b"".join(bytes(c) for c in l) for l in px)
    ch = lambda t, d: (struct.pack(">I", len(d)) + t + d
                       + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff))
    pathlib.Path(path).write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + ch(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0))
        + ch(b"IDAT", zlib.compress(cru, 9))
        + ch(b"IEND", b""))

png(192, "icone-192.png")
png(512, "icone-512.png")
