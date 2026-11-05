"""Exercise the owner's new layout action, mobile controls and real Elementor saves."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    assert wp('option', 'get', 'home') == BASE, 'Disposable local runtime required.'
    before = {area: wp('post', 'meta', 'get', str(document), '_elementor_data') for area, document in FIXTURES['layouts'].items()}
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        owner = await browser.new_context(viewport={'width':1600,'height':1100})
        visitor_context = await browser.new_context(viewport={'width':1440,'height':1000})
        page = await owner.new_page()
        visitor = await visitor_context.new_page()
        errors = []
        visitor.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(BASE + '/wp-login.php')
        await page.get_by_label('Username or Email Address').fill(CREDENTIALS['username'])
        await page.get_by_label('Password', exact=True).fill(CREDENTIALS['password'])
        await page.get_by_role('button', name='Log In', exact=True).click()
        await page.goto(BASE + '/wp-admin/admin.php?page=evpower-elementor')
        await page.get_by_role('button',name='Apply simple header & footer',exact=True).click()
        await expect(page.locator('.notice-success')).to_contain_text('Simple header and light footer applied')
        try:
            for width in [1440,990,900,899,768,390,320]:
                await visitor.set_viewport_size({'width':width,'height':1000 if width > 900 else 844})
                await visitor.goto(BASE + '/', wait_until='networkidle')
                header = visitor.locator('header .ep-header-simple')
                footer = visitor.locator('footer .ep-footer-light')
                await expect(header).to_be_visible()
                assert not await visitor.evaluate('document.documentElement.scrollWidth > innerWidth'), width
                assert (await header.bounding_box())['height'] <= 80, width
                await expect(header.get_by_role('link',name='Book a charge',exact=True)).to_be_visible()
                await expect(header.get_by_role('link',name='Sign in',exact=True)).to_be_visible()
                await expect(header.get_by_role('link',name='Cart',exact=True)).to_have_count(1)
                await expect(header.get_by_role('link',name='Cart',exact=True)).to_be_visible()
                await expect(header.get_by_role('link',name='Cart',exact=True)).to_have_attribute('href',BASE + '/cart/')
                if width >= 900:
                    assert await header.locator('.wp-block-navigation-item').all_text_contents() == ['Services','Shop','Find stations']
                    await expect(header.get_by_role('button',name='Open menu',exact=True)).to_be_hidden()
                else:
                    await expect(header.get_by_role('button',name='Open menu',exact=True)).to_be_visible()
                assert await footer.locator('h3').all_text_contents() == ['Services','Company','Contact']
                await expect(footer.get_by_role('link',name='info@evpower.et',exact=True)).to_have_attribute('href','mailto:info@evpower.et')
                await expect(footer.get_by_role('link',name='+251 911 049 916',exact=True)).to_have_attribute('href','tel:+251911049916')
                await expect(footer.get_by_role('link',name='Chat on WhatsApp',exact=True)).to_have_attribute('href','https://wa.me/251911049916')
                await expect(footer.get_by_role('link',name='Cart',exact=True)).to_be_visible()
                await expect(footer.locator('h3').first).to_have_css('color','rgb(16, 30, 49)')
                if width in [1440,990,390,320]:
                    await header.screenshot(path=str(TEMP / f'simple-header-{width}.png'))
                    await footer.screenshot(path=str(TEMP / f'light-footer-{width}.png'))
                print(f'PASS: simple header, visible booking/sign-in/Cart and light footer at {width}px')
            await visitor.set_viewport_size({'width':390,'height':844})
            await visitor.goto(BASE + '/', wait_until='networkidle')
            await visitor.get_by_role('button',name='Open menu',exact=True).click()
            await visitor.locator('.is-menu-open').get_by_role('link',name='Services',exact=True).click()
            await expect(visitor.locator('main h1')).to_have_text('Our Services')
            await visitor.locator('header').get_by_role('link',name='Book a charge',exact=True).click()
            await expect(visitor.locator('main h1')).to_contain_text('Book')
            await visitor.locator('header').get_by_role('link',name='Cart',exact=True).click()
            await expect(visitor.locator('main h1')).to_have_text('Cart')
            print('PASS: mobile menu, booking and Cart controls navigate to real pages')

            async def save_and_check(selector, expected):
                await page.get_by_role('button',name='Publish',exact=True).click()
                for _ in range(20):
                    await visitor.goto(BASE + '/services/',wait_until='domcontentloaded')
                    if await visitor.locator(selector).inner_text() == expected:
                        return
                    await page.wait_for_timeout(300)
                raise AssertionError('Published edit did not appear: ' + selector)

            for area in ['header','footer']:
                await page.goto(FIXTURES[area + '_editor'],wait_until='domcontentloaded')
                frame = page.frame_locator('#elementor-preview-iframe')
                widget = frame.locator('.elementor-widget-evpower-identity' if area == 'header' else '.elementor-widget-heading').first
                await expect(widget).to_be_visible(timeout=45000)
                close = page.get_by_role('dialog').get_by_role('button',name='Close',exact=True)
                if await close.count():
                    await close.first.click()
                structure = page.get_by_role('button',name='Close Structure',exact=True)
                if await structure.count():
                    await structure.click()
                await widget.hover()
                await widget.locator('.elementor-editor-element-edit').first.click()
                field = page.locator('.elementor-control-title input' if area == 'header' else '.elementor-control-title textarea')
                await expect(field).to_be_visible()
                original = await field.input_value()
                edited = 'Evpower Owner' if area == 'header' else 'Our services'
                await field.fill(edited)
                await field.dispatch_event('change')
                selector = 'header .ep-brand-name' if area == 'header' else 'footer h3 >> nth=0'
                await save_and_check(selector,edited)
                await field.fill(original)
                await field.dispatch_event('change')
                await save_and_check(selector,'Evpower' if area == 'header' else 'Services')
                print(f'PASS: the new {area} remains individually editable and publishable in Elementor')
            assert not errors, errors
        finally:
            await page.goto(BASE + '/wp-admin/admin.php?page=evpower-elementor')
            await page.get_by_role('button',name='Restore previous header & footer',exact=True).click()
            await expect(page.locator('.notice-success')).to_contain_text('Previous header and footer restored')
            for area, document in FIXTURES['layouts'].items():
                assert before[area] == wp('post','meta','get',str(document),'_elementor_data'), area
            await browser.close()
        print('PASS: the actual dashboard restore button recovers the owner’s previous designs')

if __name__ == '__main__':
    asyncio.run(main())
