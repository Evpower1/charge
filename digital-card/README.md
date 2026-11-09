# Ahmed Kemal · Evpower phone card

A separate home-screen web app for iPhone and Android. Open the card, tap **Show my QR**, and let someone scan it to add Ahmed's contact. The QR stores the contact details directly, so scanning it does not depend on a website or an internet connection.

## Downloads

- [Phone app hosting package](dist/evpower-card-app.zip)
- [Card image to save in Photos](dist/evpower-ahmed-contact-card.png)
- [Contact file](dist/evpower-ahmed-kemal.vcf)
- [QR image](dist/evpower-contact-qr.png)
- [App preview image](dist/evpower-card-phone-preview.png)

The card image is ready to use immediately: save it in your phone's Photos/Gallery, open it, and show the QR to another person's camera. The camera or QR reader should offer a contact preview; they choose **Add contact** or **Save**. QR reader support varies by phone.

## Install the home-screen app

The ZIP is a hosting package, not an APK or an iPhone installer. Both phones install this app from a secure HTTPS link after a one-time upload.

1. In Hostinger, open **File Manager** for `evpower.et` and open its `public_html` folder.
2. Upload `evpower-card-app.zip` and extract it directly in `public_html`. It contains its own `evpower-card` folder. The final path must be `public_html/evpower-card/index.html`, without an extra folder level. It does not replace the website's root files. If an `evpower-card` folder already exists, back it up before replacing that folder.
3. Open `https://evpower.et/evpower-card/` on the phone. This address will work **after the upload**; it has not been deployed by this project.
4. **iPhone:** open the link in Safari, tap **Share → Add to Home Screen**, and tap **Add**. Enable **Open as Web App** if offered.
5. **Android:** open the link in Chrome, then use **Install app** on the card or **⋮ → Install app / Add to Home screen**.
6. Open the new Evpower icon while online and wait for **Ready offline**. The contact details and QR can then reopen without internet. Calls, WhatsApp, email and website links still need their usual phone/network services.

Tap **Show my QR** when meeting someone. They scan it with their camera or a contact-capable QR reader and confirm saving the contact. They do not need to install this app. **Save contact** downloads a `.vcf` file that can also be opened in Contacts.

Phones can clear cached app data when storage is low or browser data is deleted. If that happens, open the app online once to prepare offline use again.

## Included details

| Field | Value |
| --- | --- |
| Name | Ahmed Kemal |
| Title | Founder & CEO |
| Company | Evpower |
| Call | +251 911 049 916 |
| WhatsApp | +971 56 355 8395 |
| Toll-free in Ethiopia | 8890 |
| Email | ahmed@evpower.et |
| Website | https://evpower.et |
| Address | Addis Ababa - Ethiopia |

The approved blue/cyan Evpower logo is included. There is no profile photo, account, tracking, WordPress plugin or server database.

## Source and verification

Edit `card-data.json` for the contact details and `ui/` for the design. `app/` is the generated, deployable app; `dist/` contains the download files. The offline worker only handles requests inside this app's folder.

To rebuild in a Python environment with Chromium installed:

```sh
python -m pip install -r digital-card/requirements-dev.txt
python digital-card/build.py
python digital-card/tests/browser.py
python digital-card/build.py
```

The browser check also exports the shareable card image and app preview. The final build refreshes the download checksums in `dist/manifest.json`. Browser tests use `/usr/bin/chromium`.

Verified in Chromium at widths 320, 390, 430, 768 and 1440 pixels: contact links, full-screen QR, exact decoded vCard contents, offline reopening and downloads, manifest/icon configuration, install guidance, sharing fallback and no-JavaScript QR access. The exported card image was independently decoded with ZXing. Installation on physical iPhone/Android devices has not been tested here.
