#!/usr/bin/env python3
"""Local deep-vision evidence using torchvision CNN models.

The first run downloads pretrained weights into the standard torch cache.
Images never leave the machine.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("--device", default="cpu", choices=["auto", "cpu", "cuda", "mps"])
    parser.add_argument("--min-score", type=float, default=0.35)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--max-objects", type=int, default=30)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    try:
        import torch
        import torchvision
        from PIL import Image, ImageStat
        from torchvision.models.detection import (
            SSDLite320_MobileNet_V3_Large_Weights,
            ssdlite320_mobilenet_v3_large,
        )
        from torchvision.models import MobileNet_V3_Large_Weights, mobilenet_v3_large

        if args.check:
            print(json.dumps({
                "ok": True,
                "engine": "torchvision",
                "torch": torch.__version__,
                "torchvision": torchvision.__version__,
                "cuda": bool(torch.cuda.is_available()),
            }, ensure_ascii=False))
            return 0

        image_path = Path(args.image).expanduser().resolve()
        if not image_path.is_file():
            raise FileNotFoundError(str(image_path))

        if args.device == "auto":
            device_name = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            device_name = args.device
        device = torch.device(device_name)
        torch.set_num_threads(max(1, min(8, torch.get_num_threads())))

        image = Image.open(image_path).convert("RGB")
        stat = ImageStat.Stat(image)
        width, height = image.size

        classifier_weights = MobileNet_V3_Large_Weights.DEFAULT
        classifier = mobilenet_v3_large(weights=classifier_weights).to(device).eval()
        classifier_input = classifier_weights.transforms()(image).unsqueeze(0).to(device)
        with torch.inference_mode():
            probabilities = classifier(classifier_input).softmax(dim=1)[0]
        top = torch.topk(probabilities, k=min(max(1, args.top_k), len(probabilities)))
        categories = classifier_weights.meta["categories"]
        classification = [
            {"label": str(categories[index]), "score": round(float(score), 4)}
            for score, index in zip(top.values.cpu(), top.indices.cpu())
        ]

        detector_weights = SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
        detector = ssdlite320_mobilenet_v3_large(weights=detector_weights).to(device).eval()
        detector_input = detector_weights.transforms()(image).to(device)
        with torch.inference_mode():
            prediction = detector([detector_input])[0]
        detections = []
        detection_categories = detector_weights.meta["categories"]
        for box, label, score in zip(prediction["boxes"], prediction["labels"], prediction["scores"]):
            value = float(score)
            if value < args.min_score:
                continue
            x1, y1, x2, y2 = [round(float(item), 1) for item in box.tolist()]
            detections.append({
                "label": str(detection_categories[int(label)]),
                "score": round(value, 4),
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            })
            if len(detections) >= args.max_objects:
                break

        print(json.dumps({
            "ok": True,
            "engine": "torchvision MobileNetV3 + SSDLite",
            "device": str(device),
            "image": {"width": width, "height": height},
            "quality": {
                "brightness": round(sum(stat.mean) / 3, 2),
                "contrast": round(sum(stat.stddev) / 3, 2),
            },
            "classification": classification,
            "detections": detections,
        }, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({
            "ok": False,
            "engine": "torchvision MobileNetV3 + SSDLite",
            "error": f"{type(exc).__name__}: {exc}",
        }, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
