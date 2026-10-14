"""
Renames all images in ml/dataset/ (train, val, test) to class-prefixed names.

  cracks/       -> crack1.jpg,    crack2.jpg,    ...
  garbage/      -> garbage1.jpg,  garbage2.jpg,  ...
  open_manhole/ -> manhole1.jpg,  manhole2.jpg,  ...
  pothole/      -> pothole1.jpg,  pothole2.jpg,  ...
  water_overflow/ -> water1.jpg,  water2.jpg,    ...
"""

import os
from pathlib import Path

DATASET_DIR = Path(__file__).parent / "dataset"
SPLITS      = ["train", "val", "test"]
IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}

# folder name → file prefix
PREFIX_MAP = {
    "cracks":         "crack",
    "garbage":        "garbage",
    "open_manhole":   "manhole",
    "pothole":        "pothole",
    "water_overflow": "water",
}

def rename_class(class_dir: Path, prefix: str):
    images = sorted(
        p for p in class_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    )
    for idx, img in enumerate(images, start=1):
        new_name = f"{prefix}{idx}.jpg"
        new_path = class_dir / new_name
        if img.name == new_name:
            continue  # already renamed
        # avoid collision: rename to tmp first if target exists
        if new_path.exists() and new_path != img:
            tmp = class_dir / f"__tmp_{idx}_{img.name}"
            img.rename(tmp)
            tmp.rename(new_path)
        else:
            img.rename(new_path)
    return len(images)

total = 0
for split in SPLITS:
    print(f"\n── {split} ──")
    for cls_folder, prefix in PREFIX_MAP.items():
        cls_dir = DATASET_DIR / split / cls_folder
        if not cls_dir.exists():
            print(f"  SKIP (not found): {cls_dir}")
            continue
        count = rename_class(cls_dir, prefix)
        print(f"  {cls_folder:20s} → {prefix}1.jpg … {prefix}{count}.jpg  ({count} files)")
        total += count

print(f"\nDone. {total} files renamed.")
