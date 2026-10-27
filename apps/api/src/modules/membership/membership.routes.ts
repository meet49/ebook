import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import {
  membershipPlanInputSchema,
  type AdminMembershipPlan,
  type MembershipOverview,
  type MembershipPlan,
  type MembershipPlanInputParsed,
} from '@ebook/shared';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { parse } from '../../middleware/validate';
import { MembershipPass } from '../../models/MembershipPass';
import { Order } from '../../models/Order';
import { Product, type ProductDoc } from '../../models/Product';
import { resolveSlug, toSummary } from '../products/products.service';
import { countMembers, currentMembership } from './passes';

/** Published books that members can read. */
export const MEMBER_BOOKS = { status: 'published', kind: { $ne: 'membership' }, includedInMembership: { $ne: false } } as const;

function toPlan(p: ProductDoc): MembershipPlan {
  const summary = toSummary(p);
  return {
    id: summary.id,
    slug: p.slug,
    title: p.title,
    description: p.description ?? '',
    benefits: p.benefits,
    durationDays: p.membership?.durationDays ?? 0,
    pricePaise: p.pricePaise,
    salePricePaise: p.salePricePaise ?? null,
    effectivePricePaise: p.effectivePricePaise,
    discountPercent: summary.discountPercent,
    intlPriceCents: p.intlPriceCents ?? null,
    featured: p.featured,
  };
}

// ── Public ──

export const membershipRouter = Router();

membershipRouter.get('/', async (_req, res) => {
  const [plans, bookCount, books] = await Promise.all([
    Product.find({ kind: 'membership', status: 'published' }).sort({ 'membership.durationDays': 1 }),
    Product.countDocuments(MEMBER_BOOKS),
    Product.find(MEMBER_BOOKS).sort({ featured: -1, publishedAt: -1 }).limit(12),
  ]);
  const overview: MembershipOverview = { plans: plans.map(toPlan), bookCount, books: books.map(toSummary) };
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(overview);
});

/** The signed-in buyer's running membership, if any. */
export async function membershipFor(userId: Types.ObjectId): Promise<{ endsAt: string } | null> {
  const m = await currentMembership(userId);
  return m ? { endsAt: m.endsAt.toISOString() } : null;
}

// ── Admin ──

export const adminMembershipRouter = Router();

async function toAdminPlans(plans: ProductDoc[]): Promise<AdminMembershipPlan[]> {
  const sold = await MembershipPass.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { productId: { $in: plans.map((p) => p._id) } } },
    { $group: { _id: '$productId', n: { $sum: 1 } } },
  ]);
  const soldBy = new Map(sold.map((s) => [s._id.toString(), s.n]));
  return plans.map((p) => ({
    ...toPlan(p),
    status: p.status,
    affiliate: { enabled: p.affiliate?.enabled ?? true, type: p.affiliate?.type ?? 'percent', value: p.affiliate?.value ?? 0 },
    sold: soldBy.get(p._id.toString()) ?? 0,
    createdAt: p.createdAt.toISOString(),
  }));
}

function applyPlan(p: ProductDoc, input: MembershipPlanInputParsed) {
  p.title = input.title;
  p.description = input.description;
  p.benefits = input.benefits;
  p.set('membership.durationDays', input.durationDays);
  p.pricePaise = input.pricePaise;
  p.salePricePaise = input.salePricePaise;
  p.intlPriceCents = input.intlPriceCents;
  p.featured = input.featured;
  p.set('affiliate', input.affiliate);
}

async function loadPlan(req: Request): Promise<ProductDoc> {
  const id = String(req.params.id);
  const plan = Types.ObjectId.isValid(id) ? await Product.findOne({ _id: id, kind: 'membership' }) : null;
  if (!plan) throw notFound('Plan not found');
  return plan;
}

adminMembershipRouter.get('/plans', async (_req, res) => {
  const plans = await Product.find({ kind: 'membership', status: { $ne: 'archived' } }).sort({ 'membership.durationDays': 1 });
  res.json({ items: await toAdminPlans(plans), members: await countMembers() });
});

adminMembershipRouter.post('/plans', async (req, res) => {
  const input = parse(membershipPlanInputSchema, req.body);
  const plan = new Product({
    kind: 'membership',
    slug: await resolveSlug(`${input.title} pass`, undefined),
    status: 'draft',
    categories: [],
  });
  applyPlan(plan, input);
  await plan.save();
  await audit({ action: 'membership_plan.created', entityType: 'Product', entityId: plan._id, meta: { title: plan.title }, req });
  res.status(201).json({ plan: (await toAdminPlans([plan]))[0] });
});

adminMembershipRouter.put('/plans/:id', async (req, res) => {
  const plan = await loadPlan(req);
  applyPlan(plan, parse(membershipPlanInputSchema, req.body));
  await plan.save();
  await audit({ action: 'membership_plan.updated', entityType: 'Product', entityId: plan._id, req });
  res.json({ plan: (await toAdminPlans([plan]))[0] });
});

async function setPlanStatus(req: Request, publish: boolean) {
  const plan = await loadPlan(req);
  plan.status = publish ? 'published' : 'unpublished';
  if (publish && !plan.publishedAt) plan.publishedAt = new Date();
  await plan.save();
  await audit({ action: `membership_plan.${publish ? 'published' : 'unpublished'}`, entityType: 'Product', entityId: plan._id, req });
  return (await toAdminPlans([plan]))[0];
}

adminMembershipRouter.post('/plans/:id/publish', async (req, res) => {
  res.json({ plan: await setPlanStatus(req, true) });
});

adminMembershipRouter.post('/plans/:id/unpublish', async (req, res) => {
  res.json({ plan: await setPlanStatus(req, false) });
});

/** Deletes a plan nobody has ordered; a sold plan is archived instead, keeping order history intact. */
adminMembershipRouter.delete('/plans/:id', async (req, res) => {
  const plan = await loadPlan(req);
  if (await Order.exists({ 'items.productId': plan._id })) {
    plan.status = 'archived';
    await plan.save();
    await audit({ action: 'membership_plan.archived', entityType: 'Product', entityId: plan._id, req });
    res.json({ ok: true, archived: true });
    return;
  }
  await Product.deleteOne({ _id: plan._id });
  await audit({ action: 'membership_plan.deleted', entityType: 'Product', entityId: plan._id, meta: { title: plan.title }, req });
  res.json({ ok: true, archived: false });
});

