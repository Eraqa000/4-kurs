"""Stanford Cars -> 6 марка, әрқайсысына 150 сурет, train/test (120/30)."""
import re, glob, io, random, json, pathlib
import pyarrow.parquet as pq
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRANDS = ["Audi", "BMW", "Ford", "Hyundai", "Mercedes-Benz", "Toyota"]
PER_BRAND, N_TRAIN = 150, 120
random.seed(0)

txt = open(ROOT / "data/hf/README.md").read()
names = {int(a): b for a, b in re.findall(r"'(\d+)': (.+)", txt)}
items = {b: [] for b in BRANDS}
for f in sorted(glob.glob(str(ROOT / "data/hf/data/*.parquet"))):
    t = pq.read_table(f, columns=["label"])["label"].to_pylist()
    for i, l in enumerate(t):
        b = names[l].split()[0]
        if b in items:
            items[b].append((f, i, names[l]))
meta = {}
for b, lst in items.items():
    random.shuffle(lst)
    lst = lst[:PER_BRAND]
    need = {}
    for k, (f, i, n) in enumerate(lst):
        need.setdefault(f, {})[i] = (k, n)
    for f, d in need.items():
        tbl = pq.read_table(f).to_pylist() if False else None
        pf = pq.ParquetFile(f)
        base = 0
        for rg in range(pf.num_row_groups):
            n = pf.metadata.row_group(rg).num_rows
            hit = [i for i in d if base <= i < base + n]
            if hit:
                rows = pf.read_row_group(rg, columns=["image"])["image"].to_pylist()
                for i in hit:
                    k, name = d[i]
                    split = "train" if k < N_TRAIN else "test"
                    p = ROOT / f"data/cars/{split}/{b}/{b}_{k:03d}.jpg"
                    p.parent.mkdir(parents=True, exist_ok=True)
                    Image.open(io.BytesIO(rows[i - base]["bytes"])).convert("RGB").save(p, quality=92)
                    meta[str(p.relative_to(ROOT))] = name
            base += n
json.dump(meta, open(ROOT / "data/cars/meta.json", "w"), indent=1, ensure_ascii=False)
print({b: len(glob.glob(str(ROOT / f"data/cars/*/{b}/*.jpg"))) for b in BRANDS})
