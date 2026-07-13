#!/usr/bin/env python3
"""Generate and upload Baker 1031 executive-summary audio.

The job is deliberately separate from the Netlify build. It reads published
article source, synthesizes a short summary with Amazon Polly Standard, uploads
the MP3 to Cloudinary's video resource type, and writes the URL manifest that
ci_build.py consumes.

Required environment variables (keep these out of Git):
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
  CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

Install once with:
  python3 -m pip install -r scripts/audio-requirements.txt

Run from the repository root:
  python3 scripts/generate-audio.py
  python3 scripts/generate-audio.py --limit 3   # safe smoke test
  python3 scripts/generate-audio.py --refresh   # regenerate existing assets
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import os
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import boto3
import requests

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'src' / 'pages-legacy'
MANIFEST_PATH = ROOT / 'data' / 'audio-manifest.json'
DEFAULT_CLOUD_NAME = 'opoazlei'


def clean_text(value: str) -> str:
    value = re.sub(r'<script\b.*?</script\s*>', ' ', value, flags=re.I | re.S)
    value = re.sub(r'<style\b.*?</style\s*>', ' ', value, flags=re.I | re.S)
    value = re.sub(r'<[^>]+>', ' ', value)
    value = html.unescape(value)
    return re.sub(r'\s+', ' ', value).strip()


def page_title(raw: str, fallback: str) -> str:
    match = re.search(r'<title[^>]*>(.*?)</title>', raw, flags=re.I | re.S)
    return clean_text(match.group(1)) if match else fallback


def page_description(raw: str) -> str:
    match = re.search(
        r'<meta\b[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']',
        raw, flags=re.I | re.S)
    return clean_text(match.group(1)) if match else ''


def summary_script(raw: str, title: str) -> str:
    """Build a restrained 60–90 second script from existing editorial copy."""
    article = re.search(r'<article\b.*?</article\s*>', raw, flags=re.I | re.S)
    body = article.group(0) if article else raw
    paragraphs = []
    for match in re.finditer(r'<p\b[^>]*>(.*?)</p\s*>', body, flags=re.I | re.S):
        text = clean_text(match.group(1))
        if not text or len(text) < 35:
            continue
        if re.search(r'^(reviewed by|securities offered|this page is educational|baker 1031 reviews)', text, flags=re.I):
            continue
        paragraphs.append(text)

    description = page_description(raw)
    chosen = []
    if description:
        chosen.append(description)
    chosen.extend(paragraphs[:4])
    text = ' '.join(chosen)
    text = re.sub(r'\s+', ' ', text).strip()
    if not text:
        text = 'This article explains the topic, the key decision points, and the risks investors should evaluate with their own professional advisers.'

    # Keep Polly input short and the result comfortably within the target
    # listening time. Cut only at a sentence boundary where possible.
    words = text.split()
    if len(words) > 205:
        text = ' '.join(words[:205])
        boundary = max(text.rfind('.'), text.rfind('?'), text.rfind('!'))
        if boundary > 450:
            text = text[:boundary + 1]
    opening = (
        'This is an executive summary of %s from Baker 1031 Investments. '
        % title.rstrip('.')
    )
    closing = (
        ' This summary is for educational purposes only. Review the cited sources '
        'and discuss your circumstances with your CPA, attorney, and qualified intermediary.'
    )
    return opening + text + closing


def cloudinary_signature(params: dict[str, str], secret: str) -> str:
    payload = '&'.join('%s=%s' % (key, params[key]) for key in sorted(params))
    return hashlib.sha1((payload + secret).encode('utf-8')).hexdigest()


def upload_cloudinary(audio: bytes, slug: str, cloud_name: str, api_key: str, api_secret: str) -> str:
    timestamp = str(int(time.time()))
    folder = 'baker1031/audio'
    public_id = slug
    signed = {'folder': folder, 'public_id': public_id, 'timestamp': timestamp}
    data = dict(signed)
    data.update({'api_key': api_key, 'signature': cloudinary_signature(signed, api_secret)})
    endpoint = 'https://api.cloudinary.com/v1_1/%s/video/upload' % quote(cloud_name, safe='')
    response = requests.post(
        endpoint,
        data=data,
        files={'file': ('%s.mp3' % slug, audio, 'audio/mpeg')},
        timeout=120,
    )
    response.raise_for_status()
    result = response.json()
    if not result.get('secure_url'):
        raise RuntimeError('Cloudinary response did not include secure_url')
    return result['secure_url']


def require_env(name: str, default: Optional[str] = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        raise SystemExit('Missing required environment variable: %s' % name)
    return value


def generate_entry(path: Path, aws_region: str, cloud_name: str, cloud_key: str, cloud_secret: str) -> tuple[str, dict]:
    """Synthesize and upload one page; return its manifest entry."""
    raw = path.read_text(encoding='utf-8', errors='replace')
    title = page_title(raw, path.stem.replace('-', ' ').title())
    script = summary_script(raw, title)
    polly = boto3.client('polly', region_name=aws_region)
    response = polly.synthesize_speech(
        Text=script,
        TextType='text',
        OutputFormat='mp3',
        VoiceId=os.environ.get('POLLY_VOICE_ID', 'Joanna'),
        Engine=os.environ.get('POLLY_ENGINE', 'standard'),
    )
    audio = response['AudioStream'].read()
    url = upload_cloudinary(audio, path.stem, cloud_name, cloud_key, cloud_secret)
    return path.name, {
        'url': url,
        'format': 'audio/mpeg',
        'title': title,
        'generated_at': dt.date.today().isoformat(),
        'provider': 'Amazon Polly Standard',
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offset', type=int, default=0, help='skip the first N pages')
    parser.add_argument('--limit', type=int, default=0, help='process only the first N pages')
    parser.add_argument('--workers', type=int, default=1, help='parallel Polly/Cloudinary uploads')
    parser.add_argument('--missing-only', action='store_true', help='process only pages not already in the manifest')
    parser.add_argument('--refresh', action='store_true', help='regenerate and upload existing entries')
    args = parser.parse_args()

    aws_region = require_env('AWS_DEFAULT_REGION', 'us-east-2')
    cloud_name = require_env('CLOUDINARY_CLOUD_NAME', DEFAULT_CLOUD_NAME)
    cloud_key = require_env('CLOUDINARY_API_KEY')
    cloud_secret = require_env('CLOUDINARY_API_SECRET')

    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
        if not isinstance(manifest, dict):
            manifest = {}
    except (FileNotFoundError, json.JSONDecodeError):
        manifest = {}

    pages = sorted(SOURCE_DIR.glob('*.html'))
    if args.offset:
        pages = pages[args.offset:]
    if args.missing_only and not args.refresh:
        pages = [path for path in pages if not (isinstance(manifest.get(path.name), dict) and manifest[path.name].get('url'))]
    if args.limit:
        pages = pages[:args.limit]
    todo = []
    for path in pages:
        base = path.name
        if not args.refresh and isinstance(manifest.get(base), dict) and manifest[base].get('url'):
            print('skip %s (already uploaded)' % base)
            continue
        todo.append(path)

    if args.workers < 1:
        raise SystemExit('--workers must be at least 1')
    if args.workers == 1:
        results = ((path.name, generate_entry(path, aws_region, cloud_name, cloud_key, cloud_secret)[1]) for path in todo)
        for number, (base, entry) in enumerate(results, 1):
            manifest[base] = entry
            MANIFEST_PATH.write_text(json.dumps(dict(sorted(manifest.items())), indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            print('[%d/%d] uploaded %s' % (number, len(todo), base))
            time.sleep(0.15)
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(generate_entry, path, aws_region, cloud_name, cloud_key, cloud_secret): path
            for path in todo
        }
        for number, future in enumerate(concurrent.futures.as_completed(futures), 1):
            base, entry = future.result()
            manifest[base] = entry
            print('[%d/%d] uploaded %s' % (number, len(todo), base))
    # Write once after a parallel batch completes so an interrupted batch
    # cannot leave a partially serialized manifest behind.
    if args.workers > 1:
        MANIFEST_PATH.write_text(json.dumps(dict(sorted(manifest.items())), indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
