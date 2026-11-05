"""Replace an actual image through Elementor's native WordPress media dialog."""
import asyncio
import json
import re
import uuid
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    assert wp('option', 'get', 'home') == BASE, 'Disposable local WordPress required.'
    upload = TEMP / ('evpower-owner-image-test-' + uuid.uuid4().hex[:8] + '.webp')
    upload.write_bytes((Path(__file__).resolve().parents[1] / 'evpower/assets/images/charging.webp').read_bytes())
    attachment_id = None
    changed = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        admin = await browser.new_context(viewport={'width':1600,'height':1100})
        page = await admin.new_page()
        visitor = await browser.new_page(viewport={'width':1440,'height':1000})
        await page.goto(BASE + '/wp-login.php', wait_until='domcontentloaded')
        await page.locator('#user_login').fill(CREDENTIALS['username'])
        await page.locator('#user_pass').fill(CREDENTIALS['password'])
        await page.locator('#wp-submit').click()
        await page.wait_for_url('**/wp-admin/**')
        await page.goto(BASE + '/wp-admin/post.php?post=' + str(FIXTURES['pages']['about']) + '&action=elementor', wait_until='domcontentloaded')
        about_frame = page.frame_locator('#elementor-preview-iframe')
        about_photo = about_frame.locator('.ep-story-image.elementor-widget-image')
        await expect(about_photo).to_be_visible(timeout=30000)
        await page.wait_for_timeout(1000)
        close = page.get_by_role('dialog').get_by_role('button', name='Close', exact=True)
        if await close.count():
            await close.first.click()
        structure = page.get_by_role('button', name='Close structure', exact=True)
        if await structure.count():
            await structure.click()
        await about_photo.hover()
        await about_photo.locator('.elementor-editor-element-edit').first.click()
        await expect(page.locator('.elementor-control-image')).to_be_visible()
        await page.locator('.elementor-control-image .elementor-control-media__content').click()
        await expect(page.locator('.media-modal:visible')).to_be_visible()
        await page.locator('.media-modal:visible .media-modal-close').click()
        print('PASS: a regular page photo exposes its Image controls and opens the native Media Library')
        await page.goto(BASE + '/wp-admin/post.php?post=' + str(FIXTURES['pages']['home']) + '&action=elementor', wait_until='domcontentloaded')
        frame = page.frame_locator('#elementor-preview-iframe')
        widget = frame.locator('.ep-hero-image.elementor-widget-image')
        await expect(widget).to_be_visible(timeout=30000)
        await page.wait_for_timeout(1000)
        close = page.get_by_role('dialog').get_by_role('button', name='Close', exact=True)
        if await close.count():
            await close.first.click()
        structure = page.get_by_role('button', name='Close structure', exact=True)
        if await structure.count():
            await structure.click()
        original_url = await widget.locator('img').get_attribute('src')
        original_id = await widget.locator('img').evaluate(r'(img) => (img.className.match(/wp-image-(\d+)/) || [])[1]')
        assert original_id

        async def select_photo():
            box = await widget.bounding_box()
            await widget.hover(position={'x':box['width']-70,'y':80})
            await page.screenshot(path=str(TEMP / 'elementor-media-controls.png'))
            await widget.locator('.elementor-editor-element-edit').first.click()
            await expect(page.locator('.elementor-control-image')).to_be_visible()

        async def open_media():
            if not await page.locator('.media-modal:visible').count():
                await page.locator('.elementor-control-image .elementor-control-media__content').click()
            await expect(page.locator('.media-modal:visible')).to_be_visible()

        async def publish_and_check(expected):
            await page.get_by_role('button', name='Publish', exact=True).click()
            for _ in range(20):
                await visitor.goto(BASE + '/', wait_until='domcontentloaded')
                if expected == await visitor.locator('.ep-hero-image img').get_attribute('src'):
                    return
                await page.wait_for_timeout(300)
            raise AssertionError('The published hero image did not update')

        try:
            await select_photo()
            print('PASS: the homepage hero image can be selected directly on the Elementor canvas')
            await open_media()
            await page.get_by_role('tab', name='Upload files', exact=True).click()
            await page.locator('.media-modal input[type="file"]').set_input_files(str(upload))
            selected = page.locator('.media-modal .attachment[aria-label="' + upload.stem + '"]')
            await expect(selected).to_have_attribute('data-id', re.compile(r'\d+'), timeout=30000)
            attachment_id = await selected.get_attribute('data-id')
            assert attachment_id != original_id
            if 'selected' not in (await selected.get_attribute('class')).split():
                await selected.click()
            await page.locator('.media-modal .media-button-select').click()
            await expect(widget.locator('img')).to_have_attribute('src', re.compile('evpower-owner-image-test'))
            changed = True
            changed_url = await widget.locator('img').get_attribute('src')
            await publish_and_check(changed_url)
            print('PASS: uploading and choosing a photo in the native media dialog updates the live page after Publish')
        except Exception:
            await page.screenshot(path=str(TEMP / 'elementor-media-failure.png'))
            raise
        finally:
            if attachment_id and changed:
                await open_media()
                await page.get_by_role('tab', name='Media Library', exact=True).click()
                original = page.locator('.media-modal .attachment[data-id="' + original_id + '"]')
                if 'selected' not in (await original.get_attribute('class')).split():
                    await original.click()
                await page.locator('.media-modal .media-button-select').click()
                await publish_and_check(original_url)
                print('PASS: choosing an existing Media Library image restores the original hero photo')
            if attachment_id and attachment_id != original_id:
                wp('post', 'delete', attachment_id, '--force')
            await browser.close()
            upload.unlink(missing_ok=True)

if __name__ == '__main__':
    asyncio.run(main())
