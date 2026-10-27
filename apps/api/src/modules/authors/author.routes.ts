import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  authorApplicationSchema,
  authorProfileInputSchema,
  authorSignupSchema,
  payoutDetailsSchema,
  productInputSchema,
  type AuthorEarningDto,
  type AuthorProfileDto,
  type AuthorStats,
} from '@ebook/shared';
import { audit } from '../../lib/audit';
import { encryptField, hashPassword } from '../../lib/crypto';
import { HttpError, conflict, forbidden, notFound } from '../../lib/errors';
import { requireRole } from '../../middleware/auth';
import { sensitiveLimiter } from '../../middleware/rateLimit';
import { imageUpload, pdfUpload } from '../../middleware/upload';
import { parse } from '../../middleware/validate';
import { AuthorEarning } from '../../models/AuthorEarning';
import { AuthorProfile, type AuthorProfileDoc } from '../../models/AuthorProfile';
import { Product, type ProductDoc } from '../../models/Product';
import { User } from '../../models/User';
import { startSession } from '../auth/session';
import { assertPagesExist, deleteUnsoldProduct } from '../products/admin-products.routes';
import { reprocessPdf, saveCover, savePdf, sendCover, sendOriginalPdf } from '../products/product-files';
import { applyInput, publishBlockers, resolveSlug, toAdmin } from '../products/products.service';
import { promotePayableAuthorEarnings } from './earnings';

export const authorRouter = Router();

const BASE = '/author/products';
/** An author edits a book only while it is not in the store or with the admin. */
const EDITABLE = ['draft', 'unpublished'];

export function toAuthorProfileDto(p: AuthorProfileDoc): AuthorProfileDto {
  return {
    id: p._id.toString(),
    status: p.status,
    penName: p.penName,
    bio: p.bio ?? '',
    website: p.website ?? '',
    sharePercent: p.sharePercent,
    payout: p.payoutDetails?.method
      ? {
          method: p.payoutDetails.method,
          upiId: p.payoutDetails.upiId ?? null,
          accountName: p.payoutDetails.accountName ?? null,
          accountNumberLast4: p.payoutDetails.accountNumberLast4 ?? null,
          ifsc: p.payoutDetails.ifsc ?? null,
        }
      : null,
    reviewNote: p.status === 'rejected' || p.status === 'suspended' ? (p.review?.note ?? null) : null,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Apply to publish on ReadnShare. Signed-in users apply with their account; visitors create one.
 * Applying grants the author role (so they can see their status); books can be added once an
 * admin approves the profile.
 */
authorRouter.post('/apply', sensitiveLimiter, async (req, res) => {
  let user = req.auth?.user;
  let input;
  if (user) {
    input = parse(authorApplicationSchema, req.body);
  } else {
    const signup = parse(authorSignupSchema, req.body);
    if (await User.exists({ email: signup.email })) {
      throw conflict('An account with this email already exists. Sign in first, then apply.');
    }
    user = await User.create({ name: signup.name, email: signup.email, passwordHash: await hashPassword(signup.password), roles: ['author'] });
    await startSession(req, res, user._id);
    input = signup;
  }

  const existing = await AuthorProfile.findOne({ userId: user._id });
  if (existing && existing.status !== 'rejected') throw conflict('You have already applied as an author');
  const fields = { penName: input.penName, bio: input.bio, website: input.website, aboutBooks: input.aboutBooks };
  const profile = existing ? Object.assign(existing, { ...fields, status: 'pending', review: {} }) : new AuthorProfile({ userId: user._id, ...fields });
  await profile.save();
  await User.updateOne({ _id: user._id }, { $addToSet: { roles: 'author' } });
  await audit({ action: 'author.applied', actorId: user._id, entityType: 'AuthorProfile', entityId: profile._id, req });
  res.status(201).json({ profile: toAuthorProfileDto(profile) });
});

// Everything below requires the author role.
authorRouter.use(requireRole('author'));

async function myProfile(req: Request): Promise<AuthorProfileDoc> {
  const profile = await AuthorProfile.findOne({ userId: req.auth!.user._id });
  if (!profile) throw notFound('You have not applied as an author yet');
  return profile;
}

async function myApprovedProfile(req: Request): Promise<AuthorProfileDoc> {
  const profile = await myProfile(req);
  if (profile.status !== 'approved') throw forbidden('Your author account is not active');
  return profile;
}

authorRouter.get('/me', async (req, res) => {
  res.json({ profile: toAuthorProfileDto(await myProfile(req)) });
});

authorRouter.put('/me', async (req, res) => {
  const profile = await myProfile(req);
  const input = parse(authorProfileInputSchema, req.body);
  profile.set({ penName: input.penName, bio: input.bio, website: input.website });
  await profile.save();
  await audit({ action: 'author.profile_updated', entityType: 'AuthorProfile', entityId: profile._id, req });
  res.json({ profile: toAuthorProfileDto(profile) });
});

authorRouter.put('/me/payout', async (req, res) => {
  const profile = await myProfile(req);
  const details = parse(payoutDetailsSchema, req.body);
  profile.set(
    'payoutDetails',
    details.method === 'upi'
      ? { method: 'upi', upiId: details.upiId, updatedAt: new Date() }
      : {
          method: 'bank_transfer',
          accountName: details.accountName,
          accountNumberEnc: encryptField(details.accountNumber),
          accountNumberLast4: details.accountNumber.slice(-4),
          ifsc: details.ifsc,
          updatedAt: new Date(),
        },
  );
  await profile.save();
  await audit({ action: 'author.payout_details_updated', entityType: 'AuthorProfile', entityId: profile._id, meta: { method: details.method }, req });
  res.json({ profile: toAuthorProfileDto(profile) });
});

authorRouter.get('/stats', async (req, res) => {
  const profile = await myProfile(req);
  await promotePayableAuthorEarnings();
  const [books, earnings] = await Promise.all([
    Product.aggregate<{ _id: string; n: number }>([{ $match: { authorProfileId: profile._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    AuthorEarning.aggregate<{ _id: string; n: number; amount: number }>([
      { $match: { authorProfileId: profile._id } },
      { $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$amountPaise' } } },
    ]),
  ]);
  const count = (s: string) => books.find((b) => b._id === s)?.n ?? 0;
  const amount = (s: string) => earnings.find((e) => e._id === s)?.amount ?? 0;
  const stats: AuthorStats = {
    books: { total: books.reduce((s, b) => s + b.n, 0), published: count('published'), inReview: count('in_review') },
    sales: earnings.filter((e) => e._id !== 'reversed').reduce((s, e) => s + e.n, 0),
    earnings: { pendingPaise: amount('pending'), payablePaise: amount('payable'), paidPaise: amount('paid') },
  };
  res.json({ stats });
});

const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1) });

authorRouter.get('/earnings', async (req, res) => {
  const profile = await myProfile(req);
  await promotePayableAuthorEarnings();
  const { page } = parse(pageQuery, req.query);
  const pageSize = 20;
  const [items, total] = await Promise.all([
    AuthorEarning.find({ authorProfileId: profile._id }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    AuthorEarning.countDocuments({ authorProfileId: profile._id }),
  ]);
  const dto: AuthorEarningDto[] = items.map((e) => ({
    id: e._id.toString(),
    orderNumber: e.orderNumber,
    books: e.lines.map((l) => ({ title: l.title ?? '', pricePaise: l.pricePaise, amountPaise: l.amountPaise })),
    amountPaise: e.amountPaise,
    status: e.status,
    holdUntil: e.holdUntil.toISOString(),
    createdAt: e.createdAt.toISOString(),
  }));
  res.json({ items: dto, page, pageSize, total });
});

// ── The author's books ──

async function myBook(req: Request, profile: AuthorProfileDoc): Promise<ProductDoc> {
  const id = String(req.params.id);
  const product = Types.ObjectId.isValid(id) ? await Product.findOne({ _id: id, authorProfileId: profile._id }) : null;
  if (!product) throw notFound('eBook not found');
  return product;
}

/** The admin-controlled commission rule, kept as is when the author saves. */
const affiliateOf = (p: ProductDoc) => ({ enabled: p.affiliate?.enabled ?? true, type: p.affiliate?.type ?? ('percent' as const), value: p.affiliate?.value ?? 0 });

function assertEditable(product: ProductDoc) {
  if (!EDITABLE.includes(product.status)) {
    throw new HttpError(
      409,
      'NOT_EDITABLE',
      product.status === 'in_review'
        ? 'This eBook is being reviewed. Withdraw it to make changes.'
        : product.status === 'published'
          ? 'This eBook is live. Take it out of the store to make changes, then submit it again.'
          : 'This eBook cannot be changed.',
    );
  }
}

authorRouter.get('/products', async (req, res) => {
  const profile = await myProfile(req);
  const items = await Product.find({ authorProfileId: profile._id, status: { $ne: 'archived' } }).sort({ updatedAt: -1 }).limit(200);
  res.json({ items: await Promise.all(items.map((p) => toAdmin(p, BASE))), page: 1, pageSize: 200, total: items.length });
});

/**
 * Creates a draft. Store settings (featured, affiliate commission, membership) stay with the
 * admin: an author's book starts outside the membership and with the default commission.
 */
authorRouter.post('/products', async (req, res) => {
  const profile = await myApprovedProfile(req);
  const input = parse(productInputSchema, req.body);
  const product = new Product({ status: 'draft', authorProfileId: profile._id });
  applyInput(product, { ...input, author: input.author || profile.penName, featured: false, includedInMembership: false, affiliate: affiliateOf(product) });
  product.slug = await resolveSlug(input.title, input.slug);
  await product.save();
  await audit({ action: 'product.created', entityType: 'Product', entityId: product._id, meta: { slug: product.slug, byAuthor: true }, req });
  res.status(201).json({ product: await toAdmin(product, BASE) });
});

authorRouter.get('/products/:id', async (req, res) => {
  res.json({ product: await toAdmin(await myBook(req, await myProfile(req)), BASE) });
});

authorRouter.put('/products/:id', async (req, res) => {
  const profile = await myApprovedProfile(req);
  const product = await myBook(req, profile);
  assertEditable(product);
  const input = parse(productInputSchema, req.body);
  assertPagesExist(input, product.pageCount);
  applyInput(product, {
    ...input,
    author: input.author || profile.penName,
    featured: product.featured,
    includedInMembership: product.includedInMembership ?? false,
    affiliate: affiliateOf(product),
  });
  product.slug = await resolveSlug(input.title, input.slug ?? product.slug, product._id);
  await product.save();
  await audit({ action: 'product.updated', entityType: 'Product', entityId: product._id, meta: { byAuthor: true }, req });
  res.json({ product: await toAdmin(product, BASE) });
});

/** Sends a draft to the admin, who publishes it or asks for changes. */
authorRouter.post('/products/:id/submit', async (req, res) => {
  const product = await myBook(req, await myApprovedProfile(req));
  assertEditable(product);
  const blockers = publishBlockers(product);
  if (blockers.length) throw new HttpError(409, 'NOT_READY', 'This eBook is not ready to submit', { publish: blockers });
  product.status = 'in_review';
  product.set('review', { submittedAt: new Date(), note: null });
  await product.save();
  await audit({ action: 'product.submitted_for_review', entityType: 'Product', entityId: product._id, req });
  res.json({ product: await toAdmin(product, BASE) });
});

/** Takes a book back from review (to drafts) or out of the store (to unpublished) to change it. */
authorRouter.post('/products/:id/withdraw', async (req, res) => {
  const product = await myBook(req, await myProfile(req));
  if (product.status !== 'in_review' && product.status !== 'published') {
    throw new HttpError(409, 'INVALID_STATUS', 'Only an eBook in review or in the store can be withdrawn');
  }
  product.status = product.status === 'in_review' ? 'draft' : 'unpublished';
  await product.save();
  await audit({ action: 'product.withdrawn_by_author', entityType: 'Product', entityId: product._id, req });
  res.json({ product: await toAdmin(product, BASE) });
});

authorRouter.delete('/products/:id', async (req, res) => {
  const product = await myBook(req, await myProfile(req));
  if (product.status !== 'draft') throw new HttpError(409, 'INVALID_STATUS', 'Only a draft can be deleted');
  await deleteUnsoldProduct(product);
  await audit({ action: 'product.deleted', entityType: 'Product', entityId: product._id, meta: { title: product.title, byAuthor: true }, req });
  res.json({ ok: true });
});

authorRouter.post('/products/:id/cover', imageUpload, async (req, res) => {
  const product = await myBook(req, await myApprovedProfile(req));
  assertEditable(product);
  await saveCover(product, req);
  res.json({ product: await toAdmin(product, BASE) });
});

authorRouter.post('/products/:id/pdf', pdfUpload, async (req, res) => {
  const product = await savePdf(async () => {
    const book = await myBook(req, await myApprovedProfile(req));
    assertEditable(book);
    return book;
  }, req);
  res.status(202).json({ product: await toAdmin(product, BASE) });
});

authorRouter.post('/products/:id/reprocess', async (req, res) => {
  const product = await myBook(req, await myApprovedProfile(req));
  await reprocessPdf(product);
  res.status(202).json({ product: await toAdmin(product, BASE) });
});

authorRouter.get('/products/:id/cover', async (req, res) => {
  await sendCover(res, await myBook(req, await myProfile(req)));
});

authorRouter.get('/products/:id/pdf', async (req, res) => {
  await sendOriginalPdf(res, await myBook(req, await myProfile(req)));
});
