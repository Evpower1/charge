# Kedir Kemal · Evpower phone card

The same approved blue/cyan Evpower design, with Kedir's own contact QR and a separate home-screen app.

**Card address after deployment:** https://evpower1.github.io/charge/kedir/

| Field | Value |
| --- | --- |
| Name | Kedir Kemal |
| Title | Managing Director |
| Call | +251 933 606 669 |
| WhatsApp | +971 52 117 0330 |
| Email | Kedir@evpower.et |
| Toll-free in Ethiopia | 8890 |
| Website | https://www.evpower.et |
| Address | Addis Ababa - Ethiopia |

## Use on your phone

Open the card address on your phone. On iPhone use Safari → Share → Add to Home Screen. On Android use the browser's Install app / Add to Home screen option. The phone icon is labelled **Kedir Evpower**. Wait for **Ready offline**, then use **Show my QR** when meeting someone.

The QR contains a vCard with Kedir's contact information and company website. It does not contain the card app's address, an installation link or an access key. A person who scans it can preview and save the contact using their camera or a contact-capable QR reader. Scanning does not install the app. **Share contact** also shares the contact details, without the app address.

The user selected no access key. The page is public: someone who already has its address can open or install it. Keeping the app address for personal use does not provide access control.

## Downloads

- [Single-file card](dist/evpower-card-standalone.html)
- [Card image for Photos/Gallery](dist/evpower-kedir-contact-card.png)
- [Contact file](dist/evpower-kedir-kemal.vcf)
- [QR PNG](dist/evpower-contact-qr.png)
- [App package](dist/evpower-card-app.zip)
- [Phone preview](dist/evpower-card-phone-preview.png)

The HTML and card image can be saved on the phone. Home-screen installation uses the HTTPS card address; the ZIP is a hosting package. Browser support for installation and offline storage varies. The QR image can always be kept in Photos/Gallery for offline display.

## Rebuild

From the repository root, run:

```sh
python digital-card/build.py
python digital-card/build.py --profile kedir
python digital-card/tests/kedir.py
python digital-card/build.py --profile kedir
```

The first build refreshes shared icons and Ahmed's app. Kedir's app and downloads are written only inside this profile directory. The test exports the two Kedir preview images and independently decodes the QR. The final build refreshes the download checksum manifest.

For Pages, deploy Ahmed's `digital-card/app/` at the hosting branch root and this profile's `app/` inside its `kedir/` folder. Each app has its own manifest identity, worker registration scope and cache namespace. The root worker ignores child-page navigations and assets, so the two cards do not replace each other's offline content.
