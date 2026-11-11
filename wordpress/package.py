"""Build the two uploadable WordPress ZIPs, excluding all local test data."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent
DESTINATION = ROOT / 'packages'
DESTINATION.mkdir(exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preview-directory', type=Path, help='Optional exported static design preview; never a WordPress runtime.')
options = parser.parse_args()
manifest = {}
for name in ['evpower', 'evpower-core']:
    source = ROOT / name
    target = DESTINATION / (name + '.zip')
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(source.rglob('*')):
            if not path.is_file():
                continue
            assert path.suffix not in ['.env', '.sqlite', '.sql'], 'Unexpected private data in package.'
            entry = ZipInfo(str(path.relative_to(ROOT)), date_time=(2026, 11, 4, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = (0o100644 << 16)
            archive.writestr(entry, path.read_bytes())
    manifest[target.name] = {'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size}
if options.preview_directory:
    preview = options.preview_directory.resolve()
    assert (preview / 'index.html').is_file(), 'Export the preview first.'
    target = DESTINATION / 'evpower-website-preview.zip'
    with ZipFile(target, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(preview.rglob('*')):
            if not path.is_file():
                continue
            assert path.suffix not in ['.php', '.env', '.sqlite', '.sql'], 'Unexpected runtime/private file in preview.'
            if path.suffix == '.html':
                html = path.read_text().lower()
                assert not any(token in html for token in ['evpower_service_nonce', 'admin-post.php', 'ep_preview_nonce', 'wp-admin/']), 'A WordPress endpoint remained in the design preview.'
            entry = ZipInfo('evpower-website-preview/' + path.relative_to(preview).as_posix(), date_time=(2026, 11, 11, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = (0o100644 << 16)
            archive.writestr(entry, path.read_bytes())
preview_zip = DESTINATION / 'evpower-website-preview.zip'
if preview_zip.is_file():
    manifest[preview_zip.name] = {'sha256': hashlib.sha256(preview_zip.read_bytes()).hexdigest(), 'bytes': preview_zip.stat().st_size, 'purpose': 'Offline design preview; forms do not submit.'}
(DESTINATION / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Created verified WordPress packages and available design preview:')
for name, metadata in manifest.items():
    print(name, metadata['bytes'], 'bytes')
