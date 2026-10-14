"""
Dataset preparation for CivicFix image classifier.

Source layout (image_data/):
  cracks/images/*.jpg        (166 imgs)
  Garbage/*.jpg              (172 imgs)
  open_manhole/images/*.jpg  (152 imgs)
  pothole/images/*.jpg       (300 imgs)
  water_over/images/*.jpg|png(441 imgs)

Output layout (ml/dataset/):
  train / val / test  each with one subfolder per class
  class_names.json

Split: 70 train / 15 val / 15 test
"""
import os, shutil, json, random
from pathlib import Path

SEED=42; TRAIN_R=0.70; VAL_R=0.15
BASE = Path(__file__).parent.parent / "image_data"
OUT  = Path(__file__).parent / "dataset"
CLASSES = {
    "cracks":       ("images","cracks"),
    "Garbage":      (None,    "garbage"),
    "open_manhole": ("images","open_manhole"),
    "pothole":      ("images","pothole"),
    "water_over":   ("images","water_overflow"),
}
EXTS = {".jpg",".jpeg",".png",".webp"}

def collect(src):
    return sorted(p for p in Path(src).rglob("*") if p.is_file() and p.suffix.lower() in EXTS)

def split(items):
    rng=random.Random(SEED); items=items.copy(); rng.shuffle(items)
    n=len(items); nt=int(n*TRAIN_R); nv=int(n*VAL_R)
    return items[:nt], items[nt:nt+nv], items[nt+nv:]

def copy(imgs, dst):
    Path(dst).mkdir(parents=True, exist_ok=True)
    for img in imgs:
        shutil.copy2(img, Path(dst)/img.name)

if OUT.exists():
    shutil.rmtree(OUT)

class_names=[]
for folder,(sub,cls) in CLASSES.items():
    src = BASE/folder/(sub if sub else ".")
    imgs = collect(src)
    if not imgs: print(f"WARN: no images in {src}"); continue
    tr,va,te = split(imgs)
    copy(tr, OUT/"train"/cls); copy(va, OUT/"val"/cls); copy(te, OUT/"test"/cls)
    class_names.append(cls)
    print(f"{cls:20s}  total={len(imgs)}  train={len(tr)}  val={len(va)}  test={len(te)}")

meta={"class_names":sorted(class_names),"num_classes":len(class_names)}
(OUT/"class_names.json").write_text(json.dumps(meta,indent=2))
print(f"\nDone. {OUT.resolve()}")
