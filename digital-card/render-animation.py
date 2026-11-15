"""Render one deterministic cycle of the standalone animation to a phone-ready MP4."""
import asyncio
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parent
DEST=ROOT/'animation-downloads'
WIDTH,HEIGHT,FPS,DURATION=1280,960,30,21.6

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

async def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(DEST)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base='http://127.0.0.1:'+str(server.server_port)
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':WIDTH,'height':HEIGHT},device_scale_factor=1,reduced_motion='no-preference')
        await context.add_init_script('window.__EVPOWER_CAPTURE__=true;')
        page=await context.new_page()
        errors=[];requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:requests.append(request.url))
        await page.goto(base+'/evpower-charging-animation.html',wait_until='load')
        await page.wait_for_selector('[data-ev-assets-ready="true"]')
        await page.add_style_tag(content='*,*::before,*::after{transition:none!important;animation:none!important}')
        assert await page.locator('figure').count()==1
        assert await page.locator('a,h1,h2,dialog').count()==0
        assert not any(url.startswith(('http:','https:')) and not url.startswith(base+'/') for url in requests)
        async def seek(t):
            await page.evaluate('(t)=>window.__EVPOWER_SCENE__.seek(t)',t)
            return await page.locator('[data-ev-scene]').evaluate('''s=>({phase:s.dataset.phase,percent:s.querySelector('[data-ev-percent]').textContent,cable:s.querySelector('[data-ev-cable]').getAttribute('d'),energy:s.querySelector('[data-ev-energy]').getAttribute('d'),car:s.querySelector('[data-ev-car]').getAttribute('transform')})''')
        phases=[(0,'waiting'),(2,'arriving'),(4.6,'parked'),(6,'connecting'),(10,'charging'),(14.6,'complete'),(16,'disconnecting'),(19,'departing'),(21,'waiting')]
        for t,phase in phases:
            state=await seek(t)
            assert state['phase']==phase,(t,state)
            assert state['cable']==state['energy']
            if phase=='complete':assert state['percent']=='100%'
        a=await seek(8);b=await seek(13)
        assert float(a['percent'][:-1])<float(b['percent'][:-1])
        await seek(0);first=await page.screenshot()
        await seek(DURATION);last=await page.screenshot()
        assert first==last,'Loop boundary should match exactly.'
        await page.set_viewport_size({'width':390,'height':844})
        assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        await page.set_viewport_size({'width':WIDTH,'height':HEIGHT})
        await seek(10.5)
        await page.screenshot(path=str(DEST/'evpower-charging-animation-preview.png'))
        print('PASS: all phases, battery progression, cable alignment, seamless loop, offline playback and mobile sizing.',flush=True)
        target=DEST/'evpower-charging-animation.mp4'
        log_path=Path(tempfile.gettempdir())/'evpower-animation-ffmpeg.log'
        with log_path.open('wb') as log:
            process=subprocess.Popen(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','png','-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=Evpower EV charging animation',str(target)],stdin=subprocess.PIPE,stderr=log)
            try:
                for frame in range(round(DURATION*FPS)):
                    await seek(frame/FPS)
                    process.stdin.write(await page.screenshot(type='png'))
                    if frame%90==0:print(f'Rendering {frame}/{round(DURATION*FPS)} frames',flush=True)
                process.stdin.close()
                assert process.wait()==0,log_path.read_text()
            finally:
                if process.poll() is None:process.terminate();process.wait()
        assert not errors,errors
        await browser.close()
    server.shutdown();server.server_close()
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)],text=True))
    streams=data['streams'];assert len(streams)==1
    stream=streams[0]
    assert stream['codec_name']=='h264' and stream['pix_fmt']=='yuv420p'
    assert stream['width']==WIDTH and stream['height']==HEIGHT
    assert int(stream['nb_frames'])==round(DURATION*FPS)
    assert abs(float(data['format']['duration'])-DURATION)<.04
    subprocess.run(['ffmpeg','-v','error','-i',str(target),'-f','null','-'],check=True)
    atoms=[];offset=0;content=target.read_bytes()
    while offset+8<=len(content):
        size,name=struct.unpack('>I4s',content[offset:offset+8]);atoms.append(name)
        assert size>0;offset+=size
    assert atoms.index(b'moov')<atoms.index(b'mdat')
    manifest_path=DEST/'manifest.json';manifest=json.loads(manifest_path.read_text())
    manifest.update({'width':WIDTH,'height':HEIGHT,'fps':FPS,'frames':int(stream['nb_frames']),'codec':'H.264','pixel_format':'yuv420p','audio':False})
    for file in [target,DEST/'evpower-charging-animation-preview.png']:
        file.chmod(0o644);manifest['files'][file.name]={'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    print('PASS: 1280×960 H.264 MP4, 30fps, 21.6 seconds, all 648 frames decoded, fast-start atom verified.',flush=True)
    print('Video bytes:',target.stat().st_size,flush=True)

if __name__=='__main__':asyncio.run(main())
