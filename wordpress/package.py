"""Build the two uploadable WordPress ZIPs, excluding all local test data."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parent
DESTINATION = ROOT / 'packages'
DESTINATION.mkdir(exist_ok=True)
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
(DESTINATION / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Created verified-layout WordPress theme and plugin ZIPs:')
for name, metadata in manifest.items():
    print(name, metadata['bytes'], 'bytes')
