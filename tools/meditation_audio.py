#!/usr/bin/env python3
"""Record every guided-meditation line in a calm voice (Kokoro TTS) into docs/audio/med/.

iPhone Home Screen apps can't use the device's speech engine, so the app plays these
recordings with Web Audio instead. Re-run after editing MEDITATIONS / BREATH_PATTERNS /
REFLECT_THEMES in life-os.js; unchanged lines are kept, removed lines are deleted.

Setup (once; prebuilt wheels only, so no install script runs):
    python3 -m venv .venv-tts && .venv-tts/bin/pip install --only-binary=:all: kokoro-onnx==0.6.1
Run:
    .venv-tts/bin/python tools/meditation_audio.py
Needs node and ffmpeg. The Kokoro model (~350 MB) is downloaded from the kokoro-onnx GitHub
release to ~/.cache/life-os-voices/kokoro and checked against the SHA-256 sums below.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'audio' / 'med'
CACHE = Path.home() / '.cache' / 'life-os-voices'
MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
MODEL_FILES = {  # Kokoro-82M v1.0 (Apache-2.0), as converted by kokoro-onnx
    'kokoro-v1.0.onnx': '7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5',
    'voices-v1.0.bin': 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
}
VOICE = 'am_michael'  # Michael: warm American English male
VOICE_NAME = 'Michael (Kokoro am_michael)'
SPEED = 0.9  # a little slower than the voice's default pace


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def voice_model():
    from kokoro_onnx import EspeakConfig, Kokoro
    import espeakng_loader
    models = CACHE / 'kokoro'
    models.mkdir(parents=True, exist_ok=True)
    for name, digest in MODEL_FILES.items():
        path = models / name
        if not path.exists():
            print(f'Downloading {name}…')
            urllib.request.urlretrieve(MODEL_URL + name, path)
        if sha256(path) != digest:
            path.unlink()
            sys.exit(f'{name} failed its checksum and was deleted; re-run to download it again')
    # espeak-ng can't read its data from a long path (like a deep venv), so keep a copy near the model
    espeak = CACHE / 'espeak-ng-data'
    if not espeak.exists():
        shutil.copytree(espeakng_loader.get_data_path(), espeak)
    return Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'),
                  espeak_config=EspeakConfig(data_path=str(espeak)))


# The voice is part of the name, so a new voice gets new files and phones can't play a cached old one
def file_for(text):
    return hashlib.sha1(f'{VOICE}\n{text}'.encode('utf-8')).hexdigest()[:12] + '.mp3'


def main():
    lines = json.loads(subprocess.check_output(['node', str(ROOT / 'tools' / 'meditation-lines.mjs')], text=True))
    try:
        tts = voice_model()
    except ImportError:
        sys.exit('kokoro-onnx not found — run with the venv that has it installed (see the top of this file)')
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = {'voice': VOICE_NAME, 'lines': {}}
    made = 0
    with tempfile.TemporaryDirectory() as tmp:
        for text in lines:
            name = file_for(text)
            manifest['lines'][text] = name
            target = OUT / name
            if target.exists():
                continue
            samples, rate = tts.create(text, voice=VOICE, speed=SPEED, lang='en-us')
            wav = Path(tmp) / 'line.wav'
            with wave.open(str(wav), 'wb') as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(rate)
                w.writeframes((samples.clip(-1, 1) * 32767).astype('<i2').tobytes())
            # Mono MP3 at a steady loudness, with leading silence trimmed so cues land on time
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav),
                            '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-19:LRA=7:TP=-2',
                            '-ac', '1', '-ar', '24000', '-b:a', '48k', str(target)], check=True)
            made += 1
            print(f'  {name}  {text[:60]}')

    keep = set(manifest['lines'].values()) | {'manifest.json'}
    removed = [p.name for p in OUT.iterdir() if p.name not in keep]
    for name in removed:
        (OUT / name).unlink()
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
    print(f'{len(lines)} lines: {made} recorded, {len(lines) - made} unchanged, {len(removed)} removed')


if __name__ == '__main__':
    if not shutil.which('ffmpeg') or not shutil.which('node'):
        sys.exit('needs ffmpeg and node on PATH')
    main()
