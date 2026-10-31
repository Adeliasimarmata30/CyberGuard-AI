# Endpoint pemeriksaan keaslian suara (XLS-R 300M beku + AASIST)
import os
import sys
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

# Folder backend/voice (berisi src/ dan models/)
AKAR_VOICE = Path(__file__).resolve().parent.parent / "voice"
sys.path.insert(0, str(AKAR_VOICE / "src"))

router = APIRouter(prefix="/voice", tags=["Voice Authenticity"])

EKSTENSI_BOLEH = {".wav", ".mp3", ".flac", ".m4a", ".ogg", ".opus"}
UKURAN_MAKS_MB = 25

_pendeteksi = None


def _ambil_pendeteksi():
    # Model dimuat sekali saja, saat permintaan pertama
    global _pendeteksi
    if _pendeteksi is None:
        from authenticity import PendeteksiKeaslian
        _pendeteksi = PendeteksiKeaslian(folder_model=AKAR_VOICE / "models")
    return _pendeteksi


@router.post("/check")
def periksa_suara(file: UploadFile = File(...)):
    ekstensi = Path(file.filename or "").suffix.lower()
    if ekstensi not in EKSTENSI_BOLEH:
        raise HTTPException(
            status_code=400,
            detail="Format tidak didukung. Gunakan WAV, MP3, FLAC, M4A, OGG, atau OPUS.",
        )

    isi = file.file.read()
    if len(isi) > UKURAN_MAKS_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file maksimal {UKURAN_MAKS_MB} MB.",
        )

    path_sementara = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ekstensi) as tmp:
            tmp.write(isi)
            path_sementara = tmp.name

        hasil = _ambil_pendeteksi().periksa(path_sementara)
        return {"success": True, "hasil": hasil}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Voice Error: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal memeriksa suara: {e}")

    finally:
        if path_sementara and os.path.exists(path_sementara):
            os.remove(path_sementara)