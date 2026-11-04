"""Create a source-only Hostinger ZIP; deliberately never include data or credentials."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'evpower-hostinger.zip'
if destination.exists():
    raise SystemExit(f'Refusing to overwrite an existing archive: {destination}')
roots = ['src', 'public', 'deploy', 'scripts']
files = [root / name for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.mjs', '.nvmrc', '.gitignore', 'README.md']]
for directory in roots:
    files.extend(p for p in (root / directory).rglob('*') if p.is_file())
approved_examples = {'deploy/hostinger.env.example'}
for file in files:
    rel = file.relative_to(root).as_posix()
    if file.is_symlink() or not file.resolve().is_relative_to(root):
        raise SystemExit(f'Refusing symbolic/external file: {rel}')
    if any(part in {'.git', '.data', '.next', 'node_modules', '__pycache__'} for part in file.relative_to(root).parts):
        raise SystemExit(f'Excluded runtime/private path found: {rel}')
    if ('.env' in file.name and rel not in approved_examples) or file.suffix in {'.sqlite', '.db', '.pem', '.key', '.pyc'}:
        raise SystemExit(f'Refusing potential credentials or runtime data: {rel}')
manifest = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
with zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(root).as_posix())
    archive.writestr('SOURCE-MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert 'package.json' in archive.namelist()
    assert all(hashlib.sha256(archive.read(name)).hexdigest() == digest for name, digest in manifest.items())
digest = hashlib.sha256(destination.read_bytes()).hexdigest()
print(f'Created {destination}: {len(files)} source files; {destination.stat().st_size:,} bytes')
print(f'SHA-256: {digest}')
