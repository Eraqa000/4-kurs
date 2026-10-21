# Көмекші функциялар: детекция, сегментация, жіктеу
import pathlib
import numpy as np
import cv2
import torch
import torch.nn as nn
import torchvision
from torchvision import transforms

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRANDS = ["Audi", "BMW", "Ford", "Hyundai", "Mercedes-Benz", "Toyota"]

# Қай құрылғыда есептейміз: Mac GPU (mps), NVIDIA (cuda) немесе процессор
if torch.backends.mps.is_available():
    DEV = torch.device("mps")
elif torch.cuda.is_available():
    DEV = torch.device("cuda")
else:
    DEV = torch.device("cpu")

# COCO кластары: 2 = car, 5 = bus, 7 = truck
CAR_CLASSES = [2, 5, 7]

# Суретті нейрондық желіге беру үшін дайындау
to_tensor = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# Модельдерді бір рет қана жүктейміз
yolo_model = None
deeplab_net = None


def detect(img):
    """Суреттегі ең сенімді көлікті табады. Қайтарады: (рамка, табылған объект саны).
    Рамка = (x1, y1, x2, y2, сенімділік) немесе None."""
    global yolo_model
    if yolo_model is None:
        from ultralytics import YOLO
        yolo_model = YOLO(str(ROOT / "models/yolov8s.pt"))

    result = yolo_model(img, verbose=False)[0]
    best_box = None
    for b in result.boxes:
        if int(b.cls) not in CAR_CLASSES:
            continue
        conf = float(b.conf)
        if best_box is None or conf > best_box[4]:
            x1, y1, x2, y2 = b.xyxy[0].tolist()
            best_box = (int(x1), int(y1), int(x2), int(y2), conf)
    return best_box, len(result.boxes)


def grabcut(img, box):
    """Рамка бойынша көлікті бөледі. Қайтарады: True/False маска."""
    x1, y1, x2, y2 = box[:4]
    mask = np.zeros(img.shape[:2], np.uint8)
    bg_model = np.zeros((1, 65))
    fg_model = np.zeros((1, 65))
    rect = (x1, y1, x2 - x1, y2 - y1)
    cv2.grabCut(img, mask, rect, bg_model, fg_model, 5, cv2.GC_INIT_WITH_RECT)
    # 1 = нақты көлік, 3 = көлік болуы мүмкін
    return (mask == 1) | (mask == 3)


def deeplab(img):
    """DeepLabV3 көмегімен көлікті бөледі (VOC-та car класы = 7)."""
    global deeplab_net
    if deeplab_net is None:
        net = torchvision.models.segmentation.deeplabv3_resnet50(weights="DEFAULT")
        deeplab_net = net.eval().to(DEV)

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    x = to_tensor(rgb).unsqueeze(0).to(DEV)
    with torch.no_grad():
        out = deeplab_net(x)["out"][0]
    classes = out.argmax(0).cpu().numpy()
    return classes == 7


def load_resnet(weights_path=None):
    """ResNet18: соңғы қабатын 6 маркаға ауыстырады."""
    model = torchvision.models.resnet18(weights="IMAGENET1K_V1")
    model.fc = nn.Linear(512, len(BRANDS))
    if weights_path is not None:
        model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    model = model.to(DEV)
    model.eval()
    return model


def classify(img, model, box=None):
    """Маркасын болжайды. Егер box берілсе, тек рамка ішін қияды."""
    if box is not None:
        x1, y1, x2, y2 = box[:4]
        img = img[max(y1, 0):y2, max(x1, 0):x2]
    img = cv2.resize(img, (224, 224))
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    x = to_tensor(rgb).unsqueeze(0).to(DEV)
    with torch.no_grad():
        probs = torch.softmax(model(x), dim=1)[0].cpu().numpy()
    best = int(probs.argmax())
    return BRANDS[best], float(probs[best])


def iou(mask1, mask2):
    """Екі маска қаншалықты сәйкес келеді (0..1)."""
    union = (mask1 | mask2).sum()
    if union == 0:
        return 0.0
    inter = (mask1 & mask2).sum()
    return float(inter / union)


def draw(img, box, mask, label, conf):
    """Суретке рамка, маска және жазу салады."""
    out = img.copy()
    if mask is not None:
        green = out.copy()
        green[mask] = (0, 200, 0)
        out = cv2.addWeighted(green, 0.45, out, 0.55, 0)
    if box is not None:
        cv2.rectangle(out, (box[0], box[1]), (box[2], box[3]), (0, 0, 255), 3)
    text = label + " " + str(int(conf * 100)) + "%"
    cv2.rectangle(out, (0, 0), (14 * len(text) + 10, 36), (0, 0, 0), -1)
    cv2.putText(out, text, (6, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    return out
