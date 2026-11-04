"""Website studio journeys against a disposable local production-mode instance."""
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.async_api import async_playwright, expect

BASE = os.environ.get('TEST_SECURE_URL', 'http://localhost:3002')
assert urlparse(BASE).hostname in ['localhost', '127.0.0.1'], 'Use a disposable local database.'
CREDENTIALS = json.loads(Path(os.environ.get('TEST_ADMIN_CREDENTIALS_FILE', '/tmp/evpower-editor-test-credentials.json')).read_text())

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000})
        login = await context.request.post(BASE + '/api/auth/login', data=CREDENTIALS, headers={'Origin': BASE})
        assert login.ok
        workspace = await (await context.request.get(BASE + '/api/cms/site')).json()
        original = workspace['published']
        original_product = (await (await context.request.get(BASE + '/api/catalog')).json())['products'][0]
        saved = await context.request.put(BASE + '/api/cms/draft', data={'document': original, 'revision': workspace['revision']}, headers={'Origin': BASE})
        assert saved.ok
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        public = await browser.new_context()
        visitor = await public.new_page()
        try:
            await page.goto(BASE + '/admin/editor', wait_until='networkidle')
            preview = page.frame_locator('iframe[title="Website draft preview"]')
            await expect(preview.locator('.hero h1')).to_be_visible()
            await expect(page.locator('.editor-section-row')).to_have_count(8)
            await page.screenshot(path='/tmp/evpower-website-studio.png', full_page=True)
            await preview.locator('.hero h1 [data-cms-copy]').filter(has_text='A better way').first.click()
            field = page.get_by_label('Selected content', exact=True)
            await expect(field).to_have_value('A better way')
            await field.fill('Your electric future starts here.')
            await expect(preview.locator('.hero h1')).to_contain_text('Your electric future starts here.')
            await page.get_by_role('button', name='Undo edit').click()
            await expect(preview.locator('.hero h1')).to_contain_text('A better way')
            await page.get_by_role('button', name='Redo edit').click()
            await expect(preview.locator('.hero h1')).to_contain_text('Your electric future starts here.')
            await page.get_by_role('button', name='Save draft', exact=True).click()
            await expect(page.get_by_role('status')).to_contain_text('Your live website has not changed')
            await visitor.goto(BASE + '/', wait_until='networkidle')
            await expect(visitor.locator('.hero h1')).to_contain_text('A better way')
            print('PASS: click-to-edit, undo/redo, draft saving, and public/draft separation')

            await page.get_by_role('button', name='Theme', exact=True).click()
            await page.get_by_label('Accent / buttons', exact=True).fill('#cfed76')
            await expect(preview.locator('.website-theme')).to_have_css('--lime', '#cfed76')
            await page.get_by_role('button', name='Mobile preview').click()
            await expect(page.locator('.editor-frame-container')).to_have_class('editor-frame-container is-mobile')
            await page.get_by_role('button', name='Desktop preview').click()
            print('PASS: live colour editing and responsive preview controls')

            await page.get_by_role('button', name='Brand', exact=True).click()
            await page.get_by_label('Company name', exact=True).fill('Evpower Studio')
            await page.get_by_label('Toll-free number', exact=True).fill('88901')
            await page.get_by_label('Contact email', exact=True).fill('support@example.com')
            await expect(preview.locator('.topbar a[href="tel:88901"] strong')).to_have_text('88901')
            await page.get_by_label('Choose page to edit').select_option('/contact')
            await expect(preview.locator('.contact-method[href="mailto:support@example.com"]')).to_be_visible()
            await page.get_by_label('Choose page to edit').select_option('/')
            await expect(preview.locator('.hero h1')).to_be_visible()
            print('PASS: global company/contact details update real phone and email links in the draft')

            await page.get_by_role('button', name='Page', exact=True).click()
            await page.get_by_role('button', name='Add section', exact=True).click()
            await page.get_by_role('dialog').get_by_role('button', name='Features', exact=True).click()
            inspector = page.locator('.editor-section-inspector')
            await inspector.get_by_label('Heading', exact=True).fill('Fleet partnerships, made simple.')
            await expect(preview.locator('.cms-custom-features')).to_contain_text('Fleet partnerships, made simple.')
            await page.get_by_role('button', name='Move Feature cards up', exact=True).click()
            await page.get_by_role('button', name='Hide Feature cards', exact=True).click()
            await expect(preview.locator('.cms-custom-features')).to_have_count(0)
            await page.get_by_role('button', name='Show Feature cards', exact=True).click()
            await expect(preview.locator('.cms-custom-features')).to_have_count(1)
            print('PASS: new sections, editing, reordering, hiding and restoring')

            await page.get_by_role('button', name='Add a page', exact=True).click()
            dialog = page.get_by_role('dialog')
            await dialog.get_by_label('Page name', exact=True).fill('Workplace charging')
            await dialog.get_by_role('button', name='Create draft page').click()
            await expect(page.get_by_label('Choose page to edit')).to_have_value('/workplace-charging')
            await expect(preview.locator('main h1')).to_have_text('Workplace charging')
            await page.locator('.editor-section-name').first.click()
            await page.locator('.editor-section-inspector').get_by_role('textbox', name='Body text', exact=True).fill('Charging solutions for your workplace, edited without code.')
            await page.get_by_text('Search engine settings', exact=True).click()
            await page.get_by_label('SEO title', exact=True).fill('Workplace EV charging')
            await page.get_by_label('Search description', exact=True).fill('A workplace charging page created in the Evpower website studio.')
            await page.get_by_role('button', name='Navigation', exact=True).click()
            await page.get_by_role('button', name='Add navigation link').click()
            nav = page.locator('.editor-nav-card').last
            await nav.get_by_label('Label', exact=True).fill('Workplace')
            await nav.get_by_label('Destination', exact=True).fill('/workplace-charging')
            await page.get_by_role('button', name='Publish changes', exact=True).click()
            await expect(page.get_by_role('status')).to_contain_text('Your changes are published')
            response = await visitor.goto(BASE + '/workplace-charging', wait_until='networkidle')
            assert response.status == 200
            await expect(visitor.locator('main h1')).to_have_text('Workplace charging')
            assert 'Workplace EV charging' in await visitor.title()
            await visitor.locator('.nav-more summary').click()
            await expect(visitor.locator('.nav-more-menu').get_by_role('link', name='Workplace', exact=True)).to_be_visible()
            print('PASS: custom page creation, SEO, navigation and real publication')

            await page.get_by_label('Choose page to edit').select_option('/')
            await expect(preview.locator('.hero-photo img')).to_be_visible()
            await preview.locator('.hero-photo img').click()
            await page.get_by_role('button', name='Replace image', exact=True).click()
            image_path = Path('/tmp/evpower-editor-upload.png')
            from PIL import Image
            Image.new('RGB', (32, 32), '#c4f06b').save(image_path)
            await page.get_by_label('Upload website image', exact=True).set_input_files({'name': 'studio-test.png', 'mimeType': 'image/png', 'buffer': image_path.read_bytes()})
            await expect(page.get_by_role('dialog')).to_have_count(0)
            await expect(preview.locator('.hero-photo img')).to_have_attribute('src', __import__('re').compile('api%2Fmedia|api/media'))
            print('PASS: image upload, library selection and live hero-image replacement')

            await page.get_by_role('button', name='History', exact=True).click()
            version = page.locator('.editor-version').filter(has_text='Before first editor publication')
            await version.get_by_role('button', name='Restore to draft').click()
            await expect(page.get_by_role('status')).to_contain_text('Version restored to your draft')
            assert (await visitor.goto(BASE + '/workplace-charging')).status == 200
            await page.get_by_role('button', name='Publish changes', exact=True).click()
            await expect(page.get_by_role('status')).to_contain_text('Your changes are published')
            assert (await visitor.goto(BASE + '/workplace-charging')).status == 404
            print('PASS: restoring history only changes the draft until explicitly published')

            await page.get_by_label('Choose page to edit').select_option('/faq')
            await expect(preview.locator('main h1')).to_be_visible()
            await page.get_by_role('button', name='Text & links', exact=True).click()
            await page.get_by_label('Search editable fields').fill('Will your chargers work')
            await expect(page.locator('.editor-field-list button')).to_have_count(1)
            print('PASS: FAQ and server-rendered page content is editable')

            await page.set_viewport_size({'width': 390, 'height': 844})
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
            await page.screenshot(path='/tmp/evpower-studio-mobile.png', full_page=True)
            assert not errors, errors
            print('PASS: mobile studio layout and no browser exceptions/console errors')

            await page.set_viewport_size({'width': 1440, 'height': 1000})
            await page.goto(BASE + '/admin', wait_until='networkidle')
            await page.get_by_role('button', name='Products', exact=True).click()
            await page.get_by_role('button', name='Edit', exact=True).first.click()
            product_dialog = page.get_by_role('dialog')
            await product_dialog.get_by_role('button', name='Choose image', exact=True).click()
            library = page.get_by_role('dialog').last
            await library.get_by_role('button', name='Choose studio-test.png', exact=True).last.click()
            await expect(page.get_by_role('dialog')).to_have_count(1)
            await expect(product_dialog.locator('.media-current > img')).to_have_attribute('src', __import__('re').compile('/api/media/'))
            before_save = await (await context.request.get(BASE + '/api/catalog')).json()
            assert before_save['products'][0]['image_url'] == (original_product.get('image_url') or '')
            await product_dialog.get_by_role('button', name='Save changes', exact=True).click()
            await expect(page.get_by_role('dialog')).to_have_count(0)
            after_save = await (await context.request.get(BASE + '/api/catalog')).json()
            assert after_save['products'][0]['image_url'].startswith('/api/media/')
            print('PASS: product image selection in the business dashboard saves only on explicit confirmation')
        finally:
            await context.request.put(BASE + '/api/admin/products', data=original_product, headers={'Origin': BASE})
            state = await (await context.request.get(BASE + '/api/cms/site')).json()
            saved = await context.request.put(BASE + '/api/cms/draft', data={'document': original, 'revision': state['revision']}, headers={'Origin': BASE})
            if saved.ok:
                revision = (await saved.json())['revision']
                await context.request.post(BASE + '/api/cms/publish', data={'revision': revision}, headers={'Origin': BASE})
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
