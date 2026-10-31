"""
Coba jalur keaslian suara pada satu file audio.

Cara pakai (dari folder backend/voice/data):
  pip install torch transformers librosa soundfile
  python ../scripts/03_predict.py raw/asli/asli_001.wav
"""

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent          # backend/voice
sys.path.insert(0, str(AKAR / "src"))

from authenticity import PendeteksiKeaslian  # noqa: E402


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python ../scripts/03_predict.py <file_audio>")
    pendeteksi = PendeteksiKeaslian(folder_model=AKAR / "models")
    hasil = pendeteksi.periksa(sys.argv[1])
    print(json.dumps(hasil, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()