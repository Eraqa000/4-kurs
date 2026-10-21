# Бір скрипт: фото -> рамка + маска + марка
# Қолдану:  python src/app.py фото1.jpg фото2.jpg
import sys
import pathlib
import cv2
import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import carlib as C


def run(paths, out_dir=None):
    if out_dir is None:
        out_dir = C.ROOT / "outputs" / "app"
    out_dir.mkdir(parents=True, exist_ok=True)

    model = C.load_resnet(C.ROOT / "models" / "resnet18_brands.pt")

    for path in paths:
        path = pathlib.Path(path)
        img = cv2.imread(str(path))

        box, _ = C.detect(img)
        if box is None:
            print(path.name, "-> көлік табылмады")
            result = C.draw(img, None, None, "no car", 0)
            cv2.imwrite(str(out_dir / path.name), result)
            continue

        mask = C.grabcut(img, box)
        label, conf = C.classify(img, model, box)
        print(path.name, "->", label, int(conf * 100), "%")

        result = C.draw(img, box, mask, label, conf)
        cv2.imwrite(str(out_dir / path.name), result)
        cv2.imwrite(str(out_dir / (path.stem + "_mask.png")), mask.astype(np.uint8) * 255)


if __name__ == "__main__":
    run(sys.argv[1:])
