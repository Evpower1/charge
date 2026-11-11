"""Export the disposable WordPress service website as a portable design preview.

This deliberately exports no WordPress runtime, credentials or submission endpoint.
Original scripts are replaced by small local navigation/accordion/preview handlers.
Run only after services-browser.py has completed its save/restore checks.
"""
from __future__ import annotations

import argparse
import hashlib
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
from urllib.parse import parse_qs, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, build_opener, ProxyHandler

from runtime import docker, wp

BASE = 'http://localhost:8094'
ORIGIN = urlsplit(BASE)
SLUGS = {
    'home': '', 'services': 'services', 'mobile': 'mobile-ev-charging',
    'supply': 'charger-supply', 'installation': 'charger-installation',
    'maintenance': 'charger-maintenance', 'about': 'about',
    'contact': 'contact', 'quote': 'request-a-quote',
}
OPENER = build_opener(ProxyHandler({}))
MAX_ASSET_BYTES = 15 * 1024 * 1024

PREVIEW_CSS = '''
.evs-preview-banner{position:relative;z-index:9999;background:#122d4d;color:#fff;
font:500 13px/1.6 Arial,sans-serif;text-align:center;padding:10px 18px;}
.evs-preview-banner a{color:#8ceaf6;text-decoration:underline;white-space:nowrap;}
.evs-preview-banner strong{font-weight:700;}
.evs-preview-feedback{background:#e9f5ff;border:1px solid #b8d8f4;color:#122d4d;
padding:16px;border-radius:12px;font:500 15px/1.6 Arial,sans-serif;margin:12px 0;}
.evs-preview-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);
z-index:10000;width:min(560px,calc(100% - 32px));padding:16px;border-radius:12px;
background:#122d4d;color:white;font:500 15px/1.6 Arial,sans-serif;
box-shadow:0 10px 35px #122d4d33;}
'''

PREVIEW_JS = '''
(() => {
 const message='Design preview: requests are not sent. Call +251 911 049 916 or use WhatsApp to contact Evpower.';
 const toast=()=>{let el=document.querySelector('.evs-preview-toast');if(el)el.remove();
  el=document.createElement('div');el.className='evs-preview-toast';el.role='status';
  el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),6500);};
 document.querySelectorAll('form[data-preview-form]').forEach(form=>{
  const select=form.querySelector('select[name="service"]');
  const service=new URLSearchParams(location.search).get('service');
  if(select&&[...select.options].some(o=>o.value===service))select.value=service;
  form.addEventListener('submit',event=>{event.preventDefault();
   let note=form.querySelector('.evs-preview-feedback');
   if(!note){note=document.createElement('p');note.className='evs-preview-feedback';
    note.setAttribute('role','status');form.append(note);}note.textContent=message;toast();});
 });
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-preview-only]')){event.preventDefault();toast();return;}
  const open=event.target.closest('.wp-block-navigation__responsive-container-open');
  const close=event.target.closest('.wp-block-navigation__responsive-container-close');
  if(open||close){event.preventDefault();const nav=(open||close).closest('nav');
   const panel=nav?.querySelector('.wp-block-navigation__responsive-container');
   if(panel){panel.classList.toggle('is-menu-open',!!open);panel.classList.toggle('has-modal-open',!!open);
    panel.setAttribute('aria-hidden',close?'true':'false');open?.setAttribute('aria-expanded','true');
    document.documentElement.classList.toggle('has-modal-open',!!open);
    (open?panel.querySelector('.wp-block-navigation__responsive-container-close'):nav.querySelector('.wp-block-navigation__responsive-container-open'))?.focus();}}
  const title=event.target.closest('.elementor-tab-title');
  if(title){event.preventDefault();const body=document.getElementById(title.getAttribute('aria-controls'))||title.nextElementSibling;
   const active=title.getAttribute('aria-expanded')==='true';title.setAttribute('aria-expanded',String(!active));
   title.classList.toggle('elementor-active',!active);if(body){body.hidden=active;body.style.display=active?'none':'block';body.classList.toggle('elementor-active',!active);}}
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){
  document.querySelectorAll('.wp-block-navigation__responsive-container.is-menu-open').forEach(panel=>{
   panel.classList.remove('is-menu-open','has-modal-open');panel.setAttribute('aria-hidden','true');
   panel.closest('nav')?.querySelector('.wp-block-navigation__responsive-container-open')?.focus();});
  document.documentElement.classList.remove('has-modal-open');}});
 document.querySelectorAll('.elementor-tab-title').forEach(title=>{
  title.setAttribute('tabindex','0');title.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();title.click();}});
 });
 document.querySelectorAll('.elementor-tab-content').forEach(panel=>{
  const title=document.querySelector('[aria-controls="'+panel.id+'"]');
  const active=title?.getAttribute('aria-expanded')==='true';panel.hidden=!active;panel.style.display=active?'block':'none';
 });
})();
'''


def same_origin(url: str) -> bool:
    part = urlsplit(url)
    return (part.scheme, part.hostname, part.port) == (ORIGIN.scheme, ORIGIN.hostname, ORIGIN.port)


def relative_url(target: Path, current: Path) -> str:
    return Path(os.path.relpath(target, current.parent)).as_posix()


class Exporter:
    def __init__(self, output: Path, pages: dict[str, str], ids: dict[str, int]):
        self.output = output
        self.pages = pages
        self.ids = ids
        self.routes = {}
        self.assets: dict[str, Path] = {}
        self.bytes_written = 0
        for key, url in pages.items():
            if key in SLUGS:
                self.routes[urlsplit(url).path.rstrip('/') or '/'] = key

    def read(self, url: str) -> tuple[bytes, str]:
        if not same_origin(url):
            raise ValueError('Only the disposable local origin can be fetched.')
        with OPENER.open(Request(url, headers={'User-Agent': 'EvpowerDesignPreview/1.0'}), timeout=30) as response:
            if not same_origin(response.url):
                raise ValueError('Asset redirected away from the disposable local runtime.')
            body = response.read(MAX_ASSET_BYTES + 1)
            if len(body) > MAX_ASSET_BYTES:
                raise ValueError('Preview asset exceeds the export size limit.')
            return body, response.headers.get_content_type()

    def asset(self, url: str, current: Path) -> str:
        url = urlunsplit((*urlsplit(url)[:4], ''))
        if not same_origin(url):
            return 'data:,'
        part = urlsplit(url)
        if not part.path.startswith(('/wp-content/', '/wp-includes/')):
            return 'data:,'
        if url not in self.assets:
            filename = re.sub(r'[^A-Za-z0-9._-]', '-', unquote(Path(part.path).name))[:100] or 'asset'
            target = self.output / 'assets' / (hashlib.sha256(url.encode()).hexdigest()[:16] + '-' + filename)
            self.assets[url] = target  # Register first to break CSS import cycles.
            data, kind = self.read(url)
            if kind in ('text/html', 'application/json'):
                raise ValueError('An asset unexpectedly returned a page or JSON response.')
            if kind == 'text/css' or filename.endswith('.css'):
                css = data.decode('utf-8')
                css = re.sub(r'/\*[#@]\s*source(?:Mapping)?URL=.*?\*/', '', css, flags=re.S)
                def replace_css(match):
                    value = match.group(2).strip()
                    if not value or value.startswith(('data:', '#')):
                        return match.group(0)
                    return 'url("' + self.asset(urljoin(url, value), target) + '")'
                css = re.sub(r'url\(\s*([\'"]?)(.*?)\1\s*\)', replace_css, css)
                css = re.sub(r'@import\s+([\'"])(.*?)\1', lambda m: '@import "' + self.asset(urljoin(url, m.group(2)), target) + '"', css)
                data = css.encode('utf-8')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            self.bytes_written += len(data)
        return relative_url(self.assets[url], current)

    def inline_css(self, css: str, source: str, current: Path) -> str:
        css = re.sub(r'/\*[#@]\s*source(?:Mapping)?URL=.*?\*/', '', css, flags=re.S)
        def rewrite(match):
            value = match.group(2).strip()
            if not value or value.startswith(('data:', '#')):
                return match.group(0)
            return 'url("' + self.asset(urljoin(source, value), current) + '")'
        return re.sub(r'url\(\s*([\'"]?)(.*?)\1\s*\)', rewrite, css)

    def page_link(self, value: str, current: Path, source: str) -> tuple[str, bool]:
        if value.startswith(('#', 'mailto:', 'tel:', 'data:')):
            return value, False
        absolute = urljoin(source, value)
        if not same_origin(absolute):
            return absolute, False
        part = urlsplit(absolute)
        query = parse_qs(part.query)
        key = None
        page_id = (query.get('page_id') or query.get('p') or [''])[0]
        if page_id.isdigit():
            key = next((name for name, ident in self.ids.items() if int(ident) == int(page_id)), None)
        if not key:
            key = self.routes.get(part.path.rstrip('/') or '/')
        if key in SLUGS:
            target = self.output / SLUGS[key] / 'index.html'
            link = relative_url(target, current)
            suffix = ''
            service = (query.get('service') or [''])[0]
            if service in ('mobile', 'supply', 'installation', 'maintenance'):
                suffix = '?service=' + service
            if part.fragment:
                suffix += '#' + part.fragment
            return link + suffix, False
        return '#preview-notice', True


class PreviewHTML(HTMLParser):
    def __init__(self, exporter: Exporter, source: str, current: Path):
        super().__init__(convert_charrefs=False)
        self.exporter, self.source, self.current = exporter, source, current
        self.output: list[str] = []
        self.skip_script = False
        self.in_style = False

    def handle_decl(self, decl):
        self.output.append('<!' + decl + '>')

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.skip_script = True
            return
        if self.skip_script:
            return
        attrs = dict(attrs)
        if tag == 'link' and any(rel in (attrs.get('rel') or '').split() for rel in ('canonical', 'shortlink', 'alternate', 'https://api.w.org/', 'pingback', 'preconnect', 'dns-prefetch')):
            return
        if tag == 'meta' and attrs.get('name') in ('generator', 'robots'):
            return
        if tag == 'input' and (attrs.get('type') == 'hidden' or 'nonce' in attrs.get('name', '').lower()):
            return
        attrs = {name: value for name, value in attrs.items() if not name.startswith(('on', 'data-wp-')) and name not in ('nonce', 'ping', 'data-settings')}
        if tag == 'style':
            self.in_style = True
        if tag == 'form':
            attrs.update({'action': '#preview-notice', 'method': 'get', 'data-preview-form': 'true'})
        if tag in ('a', 'area') and attrs.get('href'):
            attrs['href'], unsupported = self.exporter.page_link(attrs['href'], self.current, self.source)
            if unsupported:
                attrs['data-preview-only'] = 'true'
        if tag == 'link' and attrs.get('href'):
            attrs['href'] = self.exporter.asset(urljoin(self.source, attrs['href']), self.current)
        for name in ('src', 'poster'):
            if attrs.get(name):
                attrs[name] = self.exporter.asset(urljoin(self.source, attrs[name]), self.current)
        if attrs.get('srcset'):
            rewritten = []
            for entry in attrs['srcset'].split(','):
                fields = entry.strip().split()
                if fields:
                    fields[0] = self.exporter.asset(urljoin(self.source, fields[0]), self.current)
                    rewritten.append(' '.join(fields))
            attrs['srcset'] = ', '.join(rewritten)
        if attrs.get('style'):
            attrs['style'] = self.exporter.inline_css(attrs['style'], self.source, self.current)
        text = '<' + tag + ''.join(' ' + name + ('' if value is None else '="' + escape(value, quote=True) + '"') for name, value in attrs.items()) + '>'
        self.output.append(text)
        if tag == 'body':
            self.output.append('<aside class="evs-preview-banner" id="preview-notice"><strong>Design preview only.</strong> Requests are not sent here. <a href="tel:+251911049916">Call Evpower</a> · <a href="https://wa.me/251911049916">WhatsApp</a></aside>')
        if tag == 'form':
            self.output.append('<p class="evs-preview-feedback">Design preview: this form does not send requests. Use Call or WhatsApp to contact Evpower.</p>')

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.skip_script = False
            return
        if self.skip_script:
            return
        if tag == 'style':
            self.in_style = False
        if tag == 'head':
            self.output.append('<meta name="robots" content="noindex,nofollow"><style>' + PREVIEW_CSS + '</style>')
        if tag == 'body':
            self.output.append('<script src="' + relative_url(self.exporter.output / 'preview.js', self.current) + '"></script>')
        self.output.append('</' + tag + '>')

    def handle_data(self, data):
        if not self.skip_script:
            self.output.append(self.exporter.inline_css(data, self.source, self.current) if self.in_style else data)

    def handle_entityref(self, name):
        if not self.skip_script:
            self.output.append('&' + name + ';')

    def handle_charref(self, name):
        if not self.skip_script:
            self.output.append('&#' + name + ';')

    def handle_comment(self, data):
        pass  # Omit WordPress's serialized block/runtime metadata.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('/tmp/evpower-services-preview'))
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(Path('/tmp')) or output == Path('/tmp'):
        raise ValueError('Export output must be a dedicated folder under /tmp.')
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError('Use an empty dedicated output folder; existing exports are never deleted.')
    fixture = json.loads(docker('exec', 'evpower-wp-test', 'cat', '/tmp/evpower-services-fixtures.json'))
    if wp('option', 'get', 'home') != BASE:
        raise ValueError('Only the disposable local WordPress origin may be exported.')
    pages = json.loads(wp('eval', 'echo wp_json_encode(array_map("get_permalink",get_option("evpower_services_pages",array())));'))
    if set(SLUGS) - pages.keys():
        raise ValueError('Prepare all service pages before exporting.')
    exporter = Exporter(output, pages, fixture['pages'])
    for key in SLUGS:
        source = pages[key]
        target = output / SLUGS[key] / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        data, kind = exporter.read(source)
        if kind != 'text/html':
            raise ValueError('Expected a rendered public service page.')
        document = PreviewHTML(exporter, source, target)
        document.feed(data.decode('utf-8'))
        document.close()
        html = ''.join(document.output)
        if any(value in html.lower() for value in ('evpower_service_nonce', 'admin-post.php', 'ep_preview_nonce', 'wp-admin/')):
            raise ValueError('A WordPress administration endpoint or nonce remained in the preview.')
        target.write_text(html)
    (output / 'preview.js').write_text(PREVIEW_JS)
    (output / '.nojekyll').write_text('')
    font_source = Path(__file__).resolve().parents[1] / 'evpower' / 'assets' / 'fonts'
    for name in ('dm-sans-LICENSE.txt', 'manrope-LICENSE.txt'):
        (output / 'assets' / name).write_bytes((font_source / name).read_bytes())
    print(json.dumps({'pages': len(SLUGS), 'assets': len(exporter.assets), 'asset_bytes': exporter.bytes_written,
                      'output': str(output), 'submissions': 'disabled; call and WhatsApp links remain active'}))


if __name__ == '__main__':
    main()
