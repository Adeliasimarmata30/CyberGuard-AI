"""
Jalur keaslian suara CyberGuard AI (Tugas Akhir):
  audio -> WAV 16 kHz mono -> segmen 4 detik -> XLS-R 300M (beku) -> AASIST -> skor -> ambang batas -> asli / sintetis

Berkas yang dibutuhkan di folder models/:
  aasist_backend.pt   bobot AASIST hasil latihan (dari Colab)
  ambang.json         ambang batas dari data validasi
  xlsr-300m/          (opsional) salinan XLS-R; kalau tidak ada, diunduh dari Hugging Face
"""

import json
from pathlib import Path

import librosa
import numpy as np
import torch
from transformers import Wav2Vec2Model

from aasist_backend import AASISTBackend

SAMPLE_RATE = 16000
SEGMENT_LEN = SAMPLE_RATE * 4      # 64.000 sampel (4 detik), sama dengan saat latihan
MAX_SEC = 30                        # batas durasi sistem
MIN_TAIL_SEC = 1.0
XLSR_ID = "facebook/wav2vec2-xls-r-300m"


def siapkan_audio(path):
    """Baca audio -> 16 kHz mono, maks 30 detik, volume dinormalkan (sama dengan skrip data)."""
    y, _ = librosa.load(str(path), sr=SAMPLE_RATE, mono=True, duration=MAX_SEC)
    if y.size == 0:
        raise ValueError("Audio kosong")
    puncak = float(np.max(np.abs(y)))
    if puncak < 1e-6:
        raise ValueError("Audio hening total")
    return (y / puncak * 0.95).astype(np.float32)


def potong_segmen(y):
    segmen = []
    for mulai in range(0, len(y), SEGMENT_LEN):
        potong = y[mulai:mulai + SEGMENT_LEN]
        if len(potong) == SEGMENT_LEN:
            segmen.append(potong)
        elif len(potong) >= MIN_TAIL_SEC * SAMPLE_RATE:
            ulang = int(np.ceil(SEGMENT_LEN / len(potong)))
            segmen.append(np.tile(potong, ulang)[:SEGMENT_LEN])
    if not segmen:
        raise ValueError("Audio terlalu pendek (kurang dari 1 detik)")
    return segmen


class PendeteksiKeaslian:
    def __init__(self, folder_model="models", device=None):
        folder = Path(folder_model)
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        sumber_xlsr = folder / "xlsr-300m"
        self.xlsr = Wav2Vec2Model.from_pretrained(
            str(sumber_xlsr) if sumber_xlsr.is_dir() else XLSR_ID
        ).to(self.device).eval()
        for p in self.xlsr.parameters():
            p.requires_grad = False

        self.aasist = AASISTBackend(in_dim=1024).to(self.device)
        self.aasist.load_state_dict(torch.load(folder / "aasist_backend.pt", map_location=self.device))
        self.aasist.eval()

        self.ambang = float(json.loads((folder / "ambang.json").read_text(encoding="utf-8"))["ambang"])

    @torch.no_grad()
    def periksa(self, path_audio):
        """Kembalikan hasil pemeriksaan keaslian satu file suara."""
        segmen = potong_segmen(siapkan_audio(path_audio))
        batch = np.stack([(s - s.mean()) / np.sqrt(s.var() + 1e-7) for s in segmen])
        fitur = self.xlsr(torch.from_numpy(batch).to(self.device)).last_hidden_state
        skor_segmen = torch.softmax(self.aasist(fitur.float()), dim=1)[:, 1].cpu().numpy()

        # Cara menggabungkan skor antar segmen: rata-rata (sementara, belum ditetapkan di laporan)
        skor = float(skor_segmen.mean())
        return {
            "label": "asli" if skor >= self.ambang else "sintetis",
            "skor_asli": round(skor, 4),
            "ambang": round(self.ambang, 4),
            "jumlah_segmen": len(segmen),
            "skor_per_segmen": [round(float(s), 4) for s in skor_segmen],
            "catatan": "Indikasi, bukan kepastian.",
        }