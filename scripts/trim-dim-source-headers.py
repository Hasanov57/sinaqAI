"""Losslessly trim DİM booklet headers from existing official PDF image crops.

These PNGs are exact rendered crops of data/raw/izah.pdf. This script only
removes the top source-variant band, plus the next question accidentally
included below az-060. Run once when regenerating the asset set.
"""

from pathlib import Path

from PIL import Image


ASSET_DIR = Path("public/exam-assets/2025-03-02")
# (original height, top pixels, bottom pixels or None). The height guard makes
# a second run fail instead of trimming academic text.
TRIMS = {
    "az-034-syntax-options.png": (445, 160, None),
    "az-052-expansion-question.png": (600, 31, None),
    "az-053-theses-question.png": (544, 100, None),
    "az-054-true-false-table.png": (555, 111, None),
    "az-055-comparison-question.png": (377, 72, None),
    "az-058-venn-diagram.png": (411, 190, None),
    "az-060-problem-solution-table.png": (1166, 32, 910),
    "math-066-probability-chart.png": (912, 174, None),
    "math-067-circle-diagram.png": (482, 157, None),
    "math-081-garden-diagram.png": (612, 151, None),
    "math-083-trapezoid-diagram.png": (457, 156, None),
    "math-085-function-graph.png": (672, 142, None),
}


def main() -> None:
    for filename, (expected_height, top, bottom) in TRIMS.items():
        path = ASSET_DIR / filename
        with Image.open(path) as image:
            if image.height != expected_height:
                raise ValueError(f"Unexpected source height for {filename}: {image.height}")
            if bottom is None:
                bottom = image.height
            if top <= 0 or bottom <= top or bottom > image.height:
                raise ValueError(f"Invalid crop for {filename}: {top}:{bottom}")
            cropped = image.crop((0, top, image.width, bottom))
            cropped.save(path, optimize=True)
            print(f"{filename}: {image.width}x{cropped.height}")


if __name__ == "__main__":
    main()
