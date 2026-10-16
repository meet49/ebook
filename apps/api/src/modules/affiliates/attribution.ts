import type { CookieOptions, Request, Response } from 'express';
import { Types } from 'mongoose';
import { env, isProd } from '../../config/env';
import { generateToken, hashIp, signValue, unsignValue } from '../../lib/crypto';
import { AffiliateClick } from '../../models/AffiliateClick';
import { AffiliateProduct } from '../../models/AffiliateProduct';
import { AffiliateProfile } from '../../models/AffiliateProfile';
import type { ProductDoc } from '../../models/Product';
import { Product } from '../../models/Product';
import { User, type UserDoc } from '../../models/User';

export const REF_COOKIE = 'ebook_ref';
const VISITOR_COOKIE = 'ebook_vid';

export interface Attribution {
  type: 'affiliate' | 'direct';
  affiliateId?: Types.ObjectId;
  affiliateProductId?: Types.ObjectId;
  clickId?: Types.ObjectId;
  clickedAt?: Date;
  rule?: { type: 'percent' | 'fixed'; value: number };
}

const windowMs = () => env.ATTRIBUTION_WINDOW_DAYS * 86_400_000;

const cookieBase = (): CookieOptions => ({ httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });

/** Link-preview fetchers (WhatsApp, Slack, ...) and crawlers must not count as clicks. */
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|embedly|curl|wget|headless/i;

/** Same visitor clicking the same link again within this window reuses the earlier click. */
const DEDUPE_MS = 30 * 60_000;

/**
 * GET /r/:code — records a click and remembers it in a signed, HttpOnly cookie for the
 * attribution window. Last eligible click wins: a newer click from any affiliate replaces it.
 */
export async function handleReferralClick(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code ?? '');
  const link = /^[A-Za-z0-9]{6,16}$/.test(code) ? await AffiliateProduct.findOne({ linkCode: code }) : null;
  const [affiliate, product] = link
    ? await Promise.all([AffiliateProfile.findById(link.affiliateId), Product.findById(link.productId)])
    : [null, null];

  if (!link || !product || product.status !== 'published') {
    res.redirect(302, '/ebooks');
    return;
  }
  const destination = `/ebooks/${product.slug}`;
  const ua = req.get('user-agent') ?? '';
  const selfClick = req.auth && affiliate && affiliate.userId.equals(req.auth.user._id);
  if (affiliate?.status !== 'approved' || !product.affiliate?.enabled || BOT_UA.test(ua) || selfClick) {
    res.redirect(302, destination);
    return;
  }

  let visitorId = typeof req.cookies?.[VISITOR_COOKIE] === 'string' ? (req.cookies[VISITOR_COOKIE] as string).slice(0, 64) : '';
  if (!visitorId) {
    visitorId = generateToken(12);
    res.cookie(VISITOR_COOKIE, visitorId, { ...cookieBase(), maxAge: 365 * 86_400_000 });
  }

  const recent = await AffiliateClick.findOne({
    affiliateProductId: link._id,
    visitorId,
    createdAt: { $gte: new Date(Date.now() - DEDUPE_MS) },
  }).sort({ createdAt: -1 });

  const click =
    recent ??
    (await AffiliateClick.create({
      affiliateId: link.affiliateId,
      productId: link.productId,
      affiliateProductId: link._id,
      visitorId,
      ipHash: hashIp(req.ip),
      userAgent: ua.slice(0, 300),
      referrer: req.get('referer')?.slice(0, 500),
    }));
  if (!recent) await AffiliateProduct.updateOne({ _id: link._id }, { $inc: { clicks: 1 }, $set: { lastClickAt: new Date() } });

  res.cookie(REF_COOKIE, signValue(click._id.toString()), { ...cookieBase(), maxAge: windowMs() });
  if (req.auth) await User.updateOne({ _id: req.auth.user._id }, { $set: { referral: { clickId: click._id, at: click.createdAt } } });
  res.redirect(302, destination);
}

function cookieClickId(req: Request): Types.ObjectId | null {
  const id = unsignValue(req.cookies?.[REF_COOKIE]);
  return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

/** Copies the browser's referral onto the account at sign-in so it survives device switches. */
export async function rememberReferral(req: Request, userId: Types.ObjectId): Promise<void> {
  const clickId = cookieClickId(req);
  if (!clickId) return;
  const click = await AffiliateClick.findById(clickId).select('createdAt');
  if (!click) return;
  await User.updateOne(
    { _id: userId, $or: [{ 'referral.at': { $exists: false } }, { 'referral.at': null }, { 'referral.at': { $lt: click.createdAt } }] },
    { $set: { referral: { clickId: click._id, at: click.createdAt } } },
  );
}

/**
 * Decides who gets credit for a purchase, entirely server-side. The newest click (from the
 * cookie or the account) wins if it is inside the window, its affiliate is approved, the
 * product pays commission, and the buyer is not the affiliate. Otherwise the sale is direct.
 * Attribution applies to any eligible eBook bought within the window, not only the linked one.
 */
export async function resolveAttribution(req: Request, user: UserDoc, product: ProductDoc): Promise<Attribution> {
  if (!product.affiliate?.enabled) return { type: 'direct' };

  const ids = [cookieClickId(req), user.referral?.clickId ?? null].filter((v): v is Types.ObjectId => Boolean(v));
  if (!ids.length) return { type: 'direct' };

  const since = new Date(Date.now() - windowMs());
  const click = await AffiliateClick.findOne({ _id: { $in: ids }, createdAt: { $gte: since } }).sort({ createdAt: -1 });
  if (!click) return { type: 'direct' };

  const affiliate = await AffiliateProfile.findById(click.affiliateId);
  if (affiliate?.status !== 'approved' || affiliate.userId.equals(user._id)) return { type: 'direct' };

  // Only the signed-in owner of an account may update its stored referral. A guest checkout
  // that merely names an email must never write attribution onto that person's account.
  const isOwner = req.auth?.user._id.equals(user._id) ?? false;
  if (isOwner && (!user.referral?.at || user.referral.at < click.createdAt)) {
    await User.updateOne({ _id: user._id }, { $set: { referral: { clickId: click._id, at: click.createdAt } } });
  }
  return {
    type: 'affiliate',
    affiliateId: affiliate._id,
    affiliateProductId: click.affiliateProductId,
    clickId: click._id,
    clickedAt: click.createdAt,
    rule: { type: product.affiliate.type ?? 'percent', value: product.affiliate.value ?? 0 },
  };
}
