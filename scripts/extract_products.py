"""Render the scanned catalogue, locate ink, and export visually reviewed products."""

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DPI = 300

# PDF point rectangles: accepted ink near the price/variant, followed by the
# product photo. Order within a page is the printed row order.
REVIEWED = {
    1: [
        ((630, 140, 716, 215), (290, 142, 411, 247)),
        ((635, 304, 718, 375), (291, 305, 411, 411)),
        ((642, 469, 719, 546), (291, 475, 413, 579)),
        ((648, 639, 723, 711), (290, 629, 414, 742)),
        ((655, 804, 724, 865), (286, 792, 419, 906)),
    ],
    2: [
        ((611, 164, 684, 225), (272, 183, 395, 284)),
        ((621, 329, 685, 386), (272, 336, 399, 436)),
    ],
    3: [
        ((646, 132, 701, 190), (290, 117, 353, 197)),
        ((639, 232, 706, 300), (292, 223, 355, 306)),
        ((635, 662, 707, 734), (291, 663, 356, 744)),
        ((638, 771, 707, 841), (299, 776, 356, 857)),
    ],
    4: [
        ((699, 114, 774, 157), (328, 149, 451, 288)),
        ((696, 226, 767, 271), (328, 149, 451, 288)),
        ((695, 268, 767, 314), (328, 149, 451, 288)),
        ((270, 591, 323, 644), (371, 562, 409, 644)),
        ((686, 763, 766, 819), (330, 766, 437, 811)),
        ((694, 851, 761, 922), (321, 827, 454, 926)),
    ],
    5: [],
    6: [((715, 161, 794, 224), (317, 168, 469, 235))],
    7: [
        ((700, 397, 760, 448), (306, 367, 458, 481)),
        ((697, 542, 768, 609), (346, 527, 440, 640)),
    ],
    8: [((718, 723, 787, 773), (316, 682, 471, 790))],
    9: [
        ((688, 138, 763, 206), (311, 115, 432, 236)),
        ((678, 266, 747, 321), (319, 245, 406, 351)),
        ((689, 381, 754, 447), (323, 365, 406, 468)),
    ],
    10: [
        ((730, 516, 795, 570), (314, 495, 465, 612)),
        ((728, 779, 792, 830), (318, 752, 471, 869)),
    ],
    11: [
        ((199, 169, 257, 226), (316, 132, 438, 226)),
        ((700, 279, 760, 336), (324, 258, 447, 365)),
        ((704, 415, 750, 450), (322, 396, 443, 472)),
        ((699, 533, 754, 582), (304, 522, 455, 613)),
    ],
}
EXCLUSIONS = {
    4: "粉色按摩儀有叉記，已排除。三個環狀拉力帶色號各有圈選，其餘色號排除。",
    5: "淡痕的位置與第 4 頁背面圈線、勾記及叉記互為鏡像，沒有正面選取記號。",
    6: "左側淡痕與第 7 頁正面圈記互為鏡像。",
    7: "左側淡痕與第 6 頁正面圈記互為鏡像。",
    9: "左側淡痕與第 10 頁正面圈記互為鏡像。",
    10: "左側淡痕與第 9 頁正面圈記互為鏡像。",
    11: "第一款另圈 L/XL 尺寸，排除同組未圈的 S/M。",
}


def ink_components(rgb, origin=(0, 0), include_pencil=False):
    """Return stroke-sized contour boxes in PDF points for visual review."""
    red, green, blue = cv2.split(rgb.astype(np.int16))
    mask = ((red - green >= 20) & (red - blue >= 11) & (green < 195)).astype(np.uint8)
    if include_pencil:
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        mask |= cv2.adaptiveThreshold(
            gray, 1, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 35, 8
        )
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((4, 4), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    points_per_pixel = 72 / DPI
    boxes = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if 8 <= width * points_per_pixel <= 125 and 7 <= height * points_per_pixel <= 105:
            if cv2.contourArea(contour) >= 95:
                boxes.append([
                    round(origin[0] + x * points_per_pixel, 1),
                    round(origin[1] + y * points_per_pixel, 1),
                    round(width * points_per_pixel, 1),
                    round(height * points_per_pixel, 1),
                ])
    return sorted(boxes, key=lambda box: (box[1], box[0]))


def crop_box(rect, image):
    return tuple(
        min(round(value * DPI / 72), image.size[index % 2])
        for index, value in enumerate(rect)
    )


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, default=ROOT / "梅科輔具品項.pdf")
    parser.add_argument("--transcription", type=Path, default=ROOT / "scripts/reviewed-products.json")
    parser.add_argument("--output-root", type=Path, default=ROOT)
    parser.add_argument("--review-only", action="store_true")
    args = parser.parse_args()

    products_by_page = {}
    if not args.review_only:
        for product in json.loads(args.transcription.read_text(encoding="utf-8")):
            products_by_page.setdefault(product["page"], []).append(product)

    product_dir = args.output_root / "public/assets/products"
    data_dir = args.output_root / "src/data"
    data_dir.mkdir(parents=True, exist_ok=True)
    if not args.review_only:
        product_dir.mkdir(parents=True, exist_ok=True)

    products, pages = [], []
    with fitz.open(args.pdf) as document:
        if len(document) != len(REVIEWED):
            raise ValueError("This review map applies only to the 11-page catalogue.")

        for page_number, page in enumerate(document, 1):
            px = page.get_pixmap(dpi=DPI, alpha=False)
            source = Image.frombytes("RGB", (px.width, px.height), px.samples)
            annotations = [annot.type[1] for annot in page.annots()]
            candidates = ink_components(np.asarray(source))
            reviewed = REVIEWED[page_number]
            rows = products_by_page.get(page_number, [])
            if not args.review_only and len(rows) != len(reviewed):
                raise ValueError(f"Page {page_number}: expected {len(reviewed)} products, found {len(rows)}")

            entries = []
            for index, (mark, photo) in enumerate(reviewed):
                contours = ink_components(
                    np.asarray(source.crop(crop_box(mark, source))), mark[:2], include_pencil=page_number <= 2
                )
                entry = {"markBox": mark, "photoBox": photo, "inkContours": contours}
                entries.append(entry)
                if args.review_only:
                    continue
                row = rows[index]
                product = {key: value for key, value in row.items() if key not in {"page", "evidence"}}
                product_id = product["id"]
                if not product_id or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in product_id):
                    raise ValueError(f"Invalid product ID: {product_id}")
                if any(existing["id"] == product_id for existing in products):
                    raise ValueError(f"Duplicate product ID: {product_id}")

                photo_image = source.crop(crop_box(photo, source))
                photo_image.thumbnail((560, 560), Image.Resampling.LANCZOS)
                photo_image.save(product_dir / f"{product_id}.png", optimize=True)
                product["imagePath"] = f"/assets/products/{product_id}.png"
                product["sourcePage"] = page_number
                product["keyMechanisms"] = [ref["mechanism"] for ref in row["evidence"]]
                product["evidenceRefs"] = [
                    {"refId": f"{product_id}-{number}", "title": ref["title"],
                     "detail": ref["detail"], "sourcePage": page_number}
                    for number, ref in enumerate(row["evidence"], 1)
                ]
                products.append(product)
                entry.update(
                    id=product_id,
                    name=product["name"],
                    skus=[variant["sku"] for variant in product["variants"]],
                )
                print(f"第 {page_number:2} 頁 | {'、'.join(entry['skus'])} | {entry['name']}")

            pages.append({
                "page": page_number, "annotationTypes": annotations, "accepted": entries,
                "redInkCandidateCount": len(candidates), "reviewNotes": EXCLUSIONS.get(page_number, ""),
            })
            print(f"第 {page_number:2} 頁：300 DPI，{len(annotations)} 筆 PDF 註記、"
                  f"{len(candidates)} 個紅墨候選、{len(entries)} 筆人工確認")

    write_json(data_dir / "extraction-manifest.json", {
        "source": args.pdf.name, "sourceSha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(),
        "dpi": DPI, "coordinateSystem": "PDF points, x0/y0/x1/y1",
        "method": "OpenCV ink candidates and visually reviewed scope",
        "pages": pages,
    })
    if not args.review_only:
        write_json(data_dir / "products.json", products)


if __name__ == "__main__":
    main()
