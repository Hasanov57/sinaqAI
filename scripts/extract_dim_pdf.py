"""Extract page/column text and reusable question-block hints from a DİM PDF.

This intentionally stays layout-aware and conservative. It does not decide
correct answers. The official explanation PDF must still be visually reviewed
before a question is accepted into a dataset.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber


VARIANT_LINE = re.compile(
    r"^(?P<variant>[ABCD]) variantı (?P<number>\d+) saylı test tapşırığı$",
    re.MULTILINE,
)


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return "\n".join(line.rstrip() for line in value.splitlines()).strip()


def find_question_blocks(text: str, page_number: int) -> list[dict[str, object]]:
    matches = list(VARIANT_LINE.finditer(text))
    starts: list[int] = []
    for index, match in enumerate(matches):
        if match.group("variant") != "A":
            continue
        following = matches[index : index + 4]
        if [item.group("variant") for item in following] == ["A", "B", "C", "D"]:
            starts.append(match.start())

    blocks: list[dict[str, object]] = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        raw = text[start:end].strip()
        variants = {
            item.group("variant"): int(item.group("number"))
            for item in VARIANT_LINE.finditer(raw)
        }
        blocks.append(
            {
                "source_page": page_number,
                "variant_numbers": variants,
                "raw_text": raw,
            }
        )
    return blocks


def extract_pdf(pdf_path: Path) -> dict[str, object]:
    pages: list[dict[str, object]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            split_x = page.width / 2
            left_text = normalize_text(
                page.crop((0, 0, split_x + 8, page.height)).extract_text(
                    x_tolerance=2, y_tolerance=3
                )
            )
            right_text = normalize_text(
                page.crop((split_x - 8, 0, page.width, page.height)).extract_text(
                    x_tolerance=2, y_tolerance=3
                )
            )
            pages.append(
                {
                    "page_number": page_number,
                    "width_points": round(page.width, 2),
                    "height_points": round(page.height, 2),
                    "left_text": left_text,
                    "right_text": right_text,
                    "question_blocks": find_question_blocks(left_text, page_number)
                    + find_question_blocks(right_text, page_number),
                }
            )

    return {
        "source_pdf": str(pdf_path).replace("\\", "/"),
        "page_count": len(pages),
        "pages": pages,
    }


def save_crop(
    pdf_path: Path,
    page_number: int,
    crop_box: tuple[float, float, float, float],
    output_path: Path,
    resolution: int,
) -> None:
    with pdfplumber.open(pdf_path) as pdf:
        if page_number < 1 or page_number > len(pdf.pages):
            raise ValueError(f"Page {page_number} is outside the PDF")
        page = pdf.pages[page_number - 1]
        cropped = page.crop(crop_box, strict=True)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.to_image(resolution=resolution, antialias=True).save(output_path)


def parse_box(value: str) -> tuple[float, float, float, float]:
    values = tuple(float(item.strip()) for item in value.split(","))
    if len(values) != 4:
        raise argparse.ArgumentTypeError("Crop box must contain x0,y0,x1,y1")
    return values  # type: ignore[return-value]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--crop-page", type=int)
    parser.add_argument("--crop-box", type=parse_box)
    parser.add_argument("--crop-output", type=Path)
    parser.add_argument("--resolution", type=int, default=220)
    args = parser.parse_args()

    if args.output:
        result = extract_pdf(args.pdf)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Extracted {result['page_count']} pages to {args.output}")

    crop_arguments = (args.crop_page, args.crop_box, args.crop_output)
    if any(item is not None for item in crop_arguments):
        if not all(item is not None for item in crop_arguments):
            parser.error("--crop-page, --crop-box and --crop-output are required together")
        save_crop(
            args.pdf,
            args.crop_page,
            args.crop_box,
            args.crop_output,
            args.resolution,
        )
        print(f"Saved crop to {args.crop_output}")

    if not args.output and not any(item is not None for item in crop_arguments):
        parser.error("Provide --output, crop arguments, or both")


if __name__ == "__main__":
    main()
