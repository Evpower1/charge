"""Package the app source without dependencies, credentials or local test data."""
from pathlib import Path
import hashlib
import json
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'
SKIP={'node_modules','.expo','.data','dist','dist-native','coverage','test-output','__pycache__','_cacache','artifacts','ios','android'}
def include(path):
    relative=path.relative_to(ROOT)
    if any(part in SKIP for part in relative.parts):return False
    if path.name.startswith('.env') and path.name!='.env.example':return False
    return not any(path.name.endswith(suffix) for suffix in ('.sqlite','.sqlite-wal','.sqlite-shm','.log','.pyc','.apk','.aab','.ipa'))

OUT.mkdir(exist_ok=True)
files=sorted(path for path in ROOT.rglob('*') if path.is_file() and include(path))
archive_path=OUT/'evpower-app-source.zip'
with ZipFile(archive_path,'w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
    for path in files:
        entry=ZipInfo('evpower-app/'+path.relative_to(ROOT).as_posix(),date_time=(2026,11,10,0,0,0))
        entry.external_attr=0o100644<<16;entry.compress_type=ZIP_DEFLATED
        archive.writestr(entry,path.read_bytes())
with ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    for path in files:assert archive.read('evpower-app/'+path.relative_to(ROOT).as_posix())==path.read_bytes()
data=archive_path.read_bytes()
manifest={'version':'1.0.0','kind':'source package; not an installable phone binary','fileCount':len(files),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Packaged {len(files)} source files ({len(data):,} bytes); ZIP verified.')
