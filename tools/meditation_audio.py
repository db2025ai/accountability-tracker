#!/usr/bin/env python3
"""Record every guided-meditation line in a calm voice (Piper TTS) into docs/audio/med/.

iPhone Home Screen apps can't use the device's speech engine, so the app plays these
recordings with Web Audio instead. Re-run after editing MEDITATIONS / BREATH_PATTERNS
in life-os.js; unchanged lines are kept, removed lines are deleted.

Setup (once):
    python3 -m venv .venv-tts && .venv-tts/bin/pip install piper-tts
Run:
    .venv-tts/bin/python tools/meditation_audio.py
Needs node and ffmpeg. The voice model (~110 MB) is downloaded to ~/.cache/life-os-voices.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'audio' / 'med'
VOICE = 'en_GB-cori-high'  # Cori, British English; trained on public-domain LibriVox recordings
VOICE_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/' + VOICE
CACHE = Path.home() / '.cache' / 'life-os-voices'
LENGTH_SCALE = '1.15'  # a little slower than the voice's default pace


def voice_model():
    CACHE.mkdir(parents=True, exist_ok=True)
    model = CACHE / f'{VOICE}.onnx'
    for suffix in ('.onnx', '.onnx.json'):
        path = CACHE / f'{VOICE}{suffix}'
        if not path.exists():
            print(f'Downloading {path.name}…')
            urllib.request.urlretrieve(VOICE_URL + suffix, path)
    return model


def file_for(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:12] + '.mp3'


def main():
    lines = json.loads(subprocess.check_output(['node', str(ROOT / 'tools' / 'meditation-lines.mjs')], text=True))
    piper = Path(sys.executable).parent / 'piper'
    if not piper.exists():
        sys.exit('piper not found next to this Python — run with the venv that has piper-tts installed')
    model = voice_model()
    OUT.mkdir(parents=True, exist_ok=True)

    manifest = {'voice': 'Cori (Piper en_GB-cori-high)', 'lines': {}}
    made = 0
    with tempfile.TemporaryDirectory() as tmp:
        for text in lines:
            name = file_for(text)
            manifest['lines'][text] = name
            target = OUT / name
            if target.exists():
                continue
            wav = Path(tmp) / 'line.wav'
            subprocess.run([str(piper), '-m', str(model), '--length-scale', LENGTH_SCALE,
                            '--sentence-silence', '0.4', '-f', str(wav)],
                           input=text, text=True, check=True, capture_output=True)
            # Mono MP3 at a steady loudness, with leading silence trimmed so cues land on time
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav),
                            '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-19:LRA=7:TP=-2',
                            '-ac', '1', '-ar', '22050', '-b:a', '48k', str(target)], check=True)
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
