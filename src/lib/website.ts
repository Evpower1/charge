import { z } from 'zod';

export const corePages = ['/', '/services', '/locations', '/shop', '/shop/*', '/about', '/contact', '/faq', '/privacy', '/terms'];
export const safeLink = (value: string) => /^(\/(?!\/)[^\\\s]*|https:\/\/[^\s]+|mailto:[^\s]+|tel:\+?[0-9 -]+)$/.test(value);
export const safeImage = (value: string) => value === '' || !value.split('/').includes('..') && /^\/(?:images\/[a-zA-Z0-9/_ .-]+|api\/media\/[a-f0-9-]{36})$/.test(value);
const link = z.string().max(1500).refine(safeLink, 'Use a site path, HTTPS address, email, or phone link.');
const image = z.string().max(500).refine(safeImage, 'Choose an uploaded image or an image from this website.');
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/, 'Choose a valid colour.');
const copy = z.string().max(8000);
export const fieldKey = (scope: string, kind: string, value: string) => {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
  return `${scope}.${kind}.${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
};
export const normalizePage = (path: string) => path.startsWith('/shop/') ? '/shop/*' : path.replace(/\/$/, '') || '/';
export const pageScope = (path: string) => normalizePage(path).replace(/\*/g, 'product').replace(/^\/$/, 'home');
const itemSchema = z.object({ title: z.string().max(180), body: copy, image: image.default(''), href: link.or(z.literal('')).default('') });
export const sectionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,90}$/), label: z.string().max(120),
  type: z.enum(['builtin', 'text', 'hero', 'image', 'features', 'faq', 'cta']), hidden: z.boolean().default(false),
  background: z.enum(['default', 'paper', 'soft', 'dark', 'accent']).default('default'),
  align: z.enum(['left', 'center']).default('left'), padding: z.number().int().min(0).max(140).optional(),
  eyebrow: z.string().max(180).default(''), title: z.string().max(300).default(''), body: copy.default(''),
  image: image.default(''), imageAlt: z.string().max(300).default(''),
  buttonLabel: z.string().max(100).default(''), buttonHref: link.default('/contact'),
  columns: z.number().int().min(1).max(4).default(3), items: z.array(itemSchema).max(24).default([])
});
export type SiteSection = z.infer<typeof sectionSchema>;
export const pageSchema = z.object({ name: z.string().trim().min(1).max(80), enabled: z.boolean().default(true), seoTitle: z.string().max(160).default(''), seoDescription: z.string().max(400).default(''), sections: z.array(sectionSchema).max(40).default([]) });
const keySchema = z.string().regex(/^[a-z0-9/_-]+\.(text|image|link|alt|placeholder|title)\.[a-z0-9]+$/i);
export const websiteSchema = z.object({
  settings: z.object({
    companyName: z.string().trim().min(1).max(80), logoText: z.string().trim().min(1).max(40), logo: image, favicon: image,
    announcement: z.string().min(1).max(180), tagline: z.string().max(300),
    email: z.email(), phone: z.string().regex(/^\+?[0-9 -]{6,25}$/), phoneDisplay: z.string().min(3).max(40),
    tollFree: z.string().regex(/^[0-9+ -]{3,20}$/), whatsapp: z.string().regex(/^\+?[0-9]{7,18}$/), address: z.string().max(300),
    bookingLabel: z.string().min(1).max(60), seoTitle: z.string().max(160), seoDescription: z.string().max(400),
    navigation: z.array(z.object({ id: z.string().max(80), label: z.string().trim().min(1).max(60), href: link, hidden: z.boolean() })).min(1).max(12),
    theme: z.object({ ink: color, navy: color, accent: color, muted: color, soft: color, paper: color, background: color, font: z.enum(['dm', 'manrope', 'system']), headingFont: z.enum(['manrope', 'dm', 'system']), radius: z.number().int().min(0).max(28), width: z.number().int().min(960).max(1600) })
  }),
  pages: z.record(z.string().max(160), pageSchema).refine(pages => Object.keys(pages).length <= 35 && corePages.every(path=>!!pages[path]) && pages['/']?.enabled===true && Object.keys(pages).every(path => corePages.includes(path) || /^\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(path) && !['api', 'admin', 'account', 'checkout', 'shop', '_next'].includes(path.split('/')[1])), 'Choose valid, unique page paths.'),
  overrides: z.record(keySchema, copy).refine(v => Object.keys(v).length <= 2000, 'Too many content fields.').superRefine((values, ctx) => {
    for (const [key, value] of Object.entries(values)) {
      if (key.includes('.link.') && !safeLink(value)) ctx.addIssue({ code: 'custom', message: 'A link contains an unsupported address.', path: [key] });
      if (key.includes('.image.') && !safeImage(value)) ctx.addIssue({ code: 'custom', message: 'Choose an uploaded website image.', path: [key] });
    }
  }),
  textStyles: z.record(keySchema, z.object({ bold: z.boolean().optional(), italic: z.boolean().optional(), color: color.optional(), size: z.number().int().min(8).max(96).optional() })).refine(v => Object.keys(v).length <= 2000)
});
export type Website = z.infer<typeof websiteSchema>;
export type WebsitePage = z.infer<typeof pageSchema>;
const names = ['Home', 'Our services', 'Charging locations', 'Shop', 'Product details', 'About us', 'Contact us', 'FAQs', 'Privacy policy', 'Terms & conditions'];
export const defaultWebsite: Website = {
  settings: {
    companyName: 'Evpower', logoText: 'evpower', logo: '', favicon: '',
    announcement: 'A cleaner drive. A brighter Ethiopia.', tagline: 'Powering journeys.\nMoving Ethiopia forward.',
    email: 'info@evpower.et', phone: '+251911049916', phoneDisplay: '+251 911 049 916', tollFree: '8890', whatsapp: '+251911049916', address: 'Addis Ababa, Ethiopia',
    bookingLabel: 'Book Charging', seoTitle: 'Evpower — Powering your electric journey in Ethiopia', seoDescription: 'EV charging, chargers, and care in Addis Ababa and Adama. Your complete EV partner in Ethiopia.',
    navigation: [['Home','/'],['Our Services','/services'],['Charging Locations','/locations'],['Shop','/shop'],['About Us','/about'],['Contact Us','/contact']].map(([label,href],i)=>({id:`nav-${i}`,label,href,hidden:false})),
    theme: { ink:'#183330',navy:'#10292e',accent:'#c4f06b',muted:'#737e79',soft:'#f5f7f2',paper:'#ffffff',background:'#ffffff',font:'dm',headingFont:'manrope',radius:7,width:1328 }
  },
  pages: Object.fromEntries(corePages.map((path,i)=>[path,{name:names[i],enabled:true,seoTitle:'',seoDescription:'',sections:[]}])),
  overrides: {}, textStyles: {}
};
export type EditorField = { key: string; kind: string; original: string; value: string };
export type EditorSection = { id: string; label: string };
export type MediaItem = { id: string; name: string; mime: string; size: number; created_at: string; url: string };
