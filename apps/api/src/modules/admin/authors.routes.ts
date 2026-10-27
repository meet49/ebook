import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AUTHOR_STATUSES, authorApprovalSchema, authorPayoutSchema, authorReviewNoteSchema, type AdminAuthor } from '@ebook/shared';
import { audit } from '../../lib/audit';
import { decryptField } from '../../lib/crypto';
import { HttpError, badRequest, notFound } from '../../lib/errors';
import { parse } from '../../middleware/validate';
import { AuthorEarning } from '../../models/AuthorEarning';
import { AuthorPayout } from '../../models/AuthorPayout';
import { AuthorProfile, type AuthorProfileDoc } from '../../models/AuthorProfile';
import { Product } from '../../models/Product';
import { User } from '../../models/User';
import { promotePayableAuthorEarnings } from '../authors/earnings';

export const adminAuthorsRouter = Router();

const listQuery = z.object({ status: z.enum(AUTHOR_STATUSES).optional() });

async function loadAuthor(req: Request): Promise<AuthorProfileDoc> {
  const id = String(req.params.id);
  const author = Types.ObjectId.isValid(id) ? await AuthorProfile.findById(id) : null;
  if (!author) throw notFound('Author not found');
  return author;
}

async function toDtos(authors: AuthorProfileDoc[]): Promise<AdminAuthor[]> {
  const ids = authors.map((a) => a._id);
  const [users, books, money] = await Promise.all([
    User.find({ _id: { $in: authors.map((a) => a.userId) } }).select('name email'),
    Product.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { authorProfileId: { $in: ids } } }, { $group: { _id: '$authorProfileId', n: { $sum: 1 } } }]),
    AuthorEarning.aggregate<{ _id: { a: Types.ObjectId; s: string }; amount: number }>([
      { $match: { authorProfileId: { $in: ids }, status: { $in: ['payable', 'paid'] } } },
      { $group: { _id: { a: '$authorProfileId', s: '$status' }, amount: { $sum: '$amountPaise' } } },
    ]),
  ]);
  const userBy = new Map(users.map((u) => [u._id.toString(), u]));
  const booksBy = new Map(books.map((b) => [b._id.toString(), b.n]));
  const amount = (id: Types.ObjectId, s: string) => money.find((m) => m._id.a.equals(id) && m._id.s === s)?.amount ?? 0;
  return authors.map((a) => {
    const user = userBy.get(a.userId.toString());
    return {
      id: a._id.toString(),
      status: a.status,
      penName: a.penName,
      bio: a.bio ?? '',
      website: a.website ?? '',
      aboutBooks: a.aboutBooks ?? '',
      sharePercent: a.sharePercent,
      user: { name: user?.name ?? '', email: user?.email ?? '' },
      books: booksBy.get(a._id.toString()) ?? 0,
      payablePaise: amount(a._id, 'payable'),
      paidPaise: amount(a._id, 'paid'),
      hasPayoutDetails: Boolean(a.payoutDetails?.method),
      reviewNote: a.review?.note ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  });
}

adminAuthorsRouter.get('/', async (req, res) => {
  const { status } = parse(listQuery, req.query);
  await promotePayableAuthorEarnings();
  const authors = await AuthorProfile.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(500);
  res.json({ items: await toDtos(authors) });
});

/** Approves an application (or re-activates a suspended author) with their share of each sale. */
adminAuthorsRouter.post('/:id/approve', async (req, res) => {
  const author = await loadAuthor(req);
  const { sharePercent, note } = parse(authorApprovalSchema, req.body);
  if (author.status === 'approved') throw new HttpError(409, 'INVALID_STATUS', 'This author is already approved');
  author.status = 'approved';
  author.sharePercent = sharePercent;
  author.set('review', { by: req.auth!.user._id, at: new Date(), note });
  await author.save();
  await User.updateOne({ _id: author.userId }, { $addToSet: { roles: 'author' } });
  await audit({ action: 'author.approved', entityType: 'AuthorProfile', entityId: author._id, meta: { sharePercent }, req });
  res.json({ author: (await toDtos([author]))[0] });
});

for (const action of ['reject', 'suspend'] as const) {
  adminAuthorsRouter.post(`/:id/${action}`, async (req, res) => {
    const author = await loadAuthor(req);
    const { note } = parse(authorReviewNoteSchema, req.body);
    const from = action === 'reject' ? ['pending'] : ['approved'];
    if (!from.includes(author.status)) throw new HttpError(409, 'INVALID_STATUS', `A ${author.status} author cannot be ${action}ed`);
    author.status = action === 'reject' ? 'rejected' : 'suspended';
    author.set('review', { by: req.auth!.user._id, at: new Date(), note });
    await author.save();
    await audit({ action: `author.${action}ed`, entityType: 'AuthorProfile', entityId: author._id, meta: { note }, req });
    res.json({ author: (await toDtos([author]))[0] });
  });
}

/** Changes the share for future sales; orders already placed keep the share they were made with. */
adminAuthorsRouter.put('/:id/share', async (req, res) => {
  const author = await loadAuthor(req);
  const { sharePercent } = parse(authorApprovalSchema, req.body);
  author.sharePercent = sharePercent;
  await author.save();
  await audit({ action: 'author.share_changed', entityType: 'AuthorProfile', entityId: author._id, meta: { sharePercent }, req });
  res.json({ author: (await toDtos([author]))[0] });
});

/** Full payout destination (bank number decrypted) for the admin making the transfer. */
adminAuthorsRouter.get('/:id/destination', async (req, res) => {
  const author = await AuthorProfile.findById(String(req.params.id)).select('+payoutDetails.accountNumberEnc');
  if (!author) throw notFound('Author not found');
  await audit({ action: 'author.destination_viewed', entityType: 'AuthorProfile', entityId: author._id, req });
  res.setHeader('Cache-Control', 'no-store');
  const d = author.payoutDetails;
  res.json({
    method: d?.method ?? null,
    upiId: d?.upiId ?? null,
    accountName: d?.accountName ?? null,
    accountNumber: d?.accountNumberEnc ? decryptField(d.accountNumberEnc) : null,
    ifsc: d?.ifsc ?? null,
  });
});

/**
 * Records a payment the admin has ALREADY made outside the platform, settling every payable
 * earning of the author. The platform never moves money itself.
 */
adminAuthorsRouter.post('/:id/payouts', async (req, res) => {
  const author = await loadAuthor(req);
  const { reference, note } = parse(authorPayoutSchema, req.body);
  await promotePayableAuthorEarnings();
  const earnings = await AuthorEarning.find({ authorProfileId: author._id, status: 'payable' });
  if (!earnings.length) throw badRequest('Nothing is payable to this author yet');
  const amountPaise = earnings.reduce((s, e) => s + e.amountPaise, 0);
  const d = author.payoutDetails;
  const destination = d?.method === 'upi' ? `UPI ${d.upiId}` : d?.method === 'bank_transfer' ? `Bank ••${d.accountNumberLast4} (${d.ifsc})` : '';

  const payout = await AuthorPayout.create({
    authorProfileId: author._id,
    amountPaise,
    earningIds: earnings.map((e) => e._id),
    reference,
    note,
    destination,
    paidBy: req.auth!.user._id,
  });
  // Only earnings still payable are settled, so a refund that landed meanwhile is never paid.
  const settled = await AuthorEarning.updateMany(
    { _id: { $in: earnings.map((e) => e._id) }, status: 'payable' },
    { $set: { status: 'paid', payoutId: payout._id }, $push: { history: { status: 'paid', at: new Date(), note: `Paid: ${reference}` } } },
  );
  if (settled.modifiedCount !== earnings.length) {
    const paid = await AuthorEarning.find({ payoutId: payout._id });
    payout.amountPaise = paid.reduce((s, e) => s + e.amountPaise, 0);
    payout.earningIds = paid.map((e) => e._id);
    await payout.save();
  }
  await audit({ action: 'author.payout_recorded', entityType: 'AuthorProfile', entityId: author._id, meta: { amountPaise: payout.amountPaise, reference }, req });
  res.status(201).json({ payout: { id: payout._id.toString(), amountPaise: payout.amountPaise, reference, destination, createdAt: payout.createdAt.toISOString() } });
});

adminAuthorsRouter.get('/:id/payouts', async (req, res) => {
  const author = await loadAuthor(req);
  const payouts = await AuthorPayout.find({ authorProfileId: author._id }).sort({ createdAt: -1 }).limit(100);
  res.json({
    items: payouts.map((p) => ({ id: p._id.toString(), amountPaise: p.amountPaise, reference: p.reference, destination: p.destination, note: p.note, createdAt: p.createdAt.toISOString() })),
  });
});
