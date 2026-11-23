# BDSisters.org — Backend Audit & Development Roadmap

> **Audit Date:** 2026-11-18  
> **Auditor Role:** Senior Backend Architect & QA Auditor  
> **Codebase Path:** `d:\Client-project\bdSisters\bdsisters-backend`  
> **Scope:** Full audit of all controllers, models, routes, middlewares, validations, and configurations against the BDSisters.org Master Requirements Checklist.

---

## 1. Project Architecture & Tech Stack Overview

### Current Stack (Actual — from codebase)

| Layer | Technology | Notes |
|---|---|---|
| **Runtime** | Node.js v24 | Confirmed via build output |
| **Framework** | Express.js v5.3 | Installed, configured in `server.ts` |
| **Language** | TypeScript 5.9 | `tsconfig.json` targeting ES6/CommonJS |
| **Database** | MongoDB via Mongoose 9.12 | Connected in `config/db.ts` |
| **Validation** | Zod 4.6 | Used across all controllers |
| **Password Hashing** | bcrypt | Used in `auth.controller.ts` |
| **Email** | Nodemailer (SMTP) | `utils/sendEmail.ts` — NOT using Resend despite `resend` being in `package.json` |
| **Payment** | ZiniPay (via axios) | `payment.controller.ts` — ZiniPay v1 gateway with webhook & verification |
| **Security Middleware** | Helmet, CORS, Morgan | Configured globally in `server.ts` |
| **Dev Tools** | ts-node-dev, eslint | `package.json` devDependencies |

### Installed but Unused Packages
| Package | Installed | Actually Used |
|---|---|---|
| `better-auth` | ✅ Yes | ❌ Not integrated |
| `resend` | ✅ Yes | ❌ Not integrated (Nodemailer used instead) |
| `zod` | ✅ Yes | ✅ Used |
| `mongoose` | ✅ Yes | ✅ Used |
| `axios` | ❌ Not in package.json | ✅ Used in payment controller — **missing from dependencies!** |

### Directory Structure (Current)
```
src/
├── config/         db.ts
├── controllers/    admin, auth, business, ecommerce, event, forum, payment
├── middlewares/    auth.middleware.ts (stub), referral.middleware.ts
├── models/         Business, Event, Order, Post, Product, User
├── routes/         admin, auth, business, ecommerce, event, forum, payment
├── utils/          sendEmail.ts
└── validations/    admin, auth, business, ecommerce, event, forum
```

---

## 2. Module-by-Module Implementation Status

| Module | Feature | Status | Notes |
|---|---|---|---|
| **Auth** | Register with password hashing | ✅ Completed | bcrypt, Zod validated |
| **Auth** | Login | ✅ Completed | Returns role + status + JWT |
| **Auth** | Session / JWT token issuance | ✅ Completed | JWT issued with configured expiry |
| **Auth** | Email verification on register | ✅ Completed | `POST /verify-email` via Resend token |
| **Auth** | Password reset (forgot/reset) | ✅ Completed | `POST /forgot-password` & `POST /reset-password` |
| **Auth** | Account status check on login | ✅ Completed | Blocks Pending, Suspended, Rejected |
| **Auth** | Logout / session invalidation | ✅ Completed | `POST /logout` |
| **Auth** | Email via Resend | ✅ Completed | Resend API with HTML templates |
| **RBAC** | Role definition in model | ✅ Completed | Guest, Member, PaidMember, Admin, SuperAdmin |
| **RBAC** | `authorizeRoles` middleware | ✅ Completed | Checks verified `req.user.role` |
| **RBAC** | Route-level protection | ✅ Completed | Admin routes & `/me` fully protected |
| **Referral** | Referral validation middleware | ✅ Completed | Validates active member referralCode (first-user exception) |
| **Referral** | Unique referralCode auto-generation | ✅ Completed | Unique 8-char uppercase hex code generated pre-save |
| **User Profile** | Basic profile fields | ✅ Completed | fullName, email, location, bio, contactInfo |
| **User Profile** | Contact info private by default | ✅ Completed | `isPrivate: true` default, enforced in sanitization |
| **User Profile** | Multiple emails (PLUS button support) | ✅ Completed | `PATCH /api/auth/me/contact` allows adding/removing multiple emails |
| **User Profile** | Web profiles / social links | ✅ Completed | `webProfiles` array `{ label, url, iconType }` in model & API |
| **User Profile** | Subjects of Interest (dropdown) | ✅ Completed | `subjectsOfInterest` array `{ genre, subject }` in model & API |
| **User Profile** | Software skill bars | ✅ Completed | `softwareSkills` array `{ name, level (1-5) }` in model & API |
| **User Profile** | Vocational skills | ✅ Completed | `vocationalSkills` array `{ genre, skill, level (1-5) }` in model & API |
| **User Profile** | 80/20 Chart data (always private) | ✅ Completed | `chart8020Data` with `select: false`, stripped from non-owners |
| **User Profile** | Islamized Holistic Dev Wheel data | ✅ Completed | `islamicDevWheelData` with `select: false`, stripped from non-owners |
| **User Profile** | Profile status (Draft/PendingReview/Active) | ✅ Completed | `profileStatus` enum with default `"Draft"` |
| **User Profile** | Submit for Review workflow | ✅ Completed | `POST /api/auth/me/submit-review` moves Draft -> PendingReview |
| **User Profile** | Chronological sorting by name, createdAt, updatedAt | ✅ Completed | Supported in `GET /api/users` directory query |
| **User Profile** | Role-based field visibility in GET endpoints | ✅ Completed | `optionalAuth` + `sanitizeUserProfile` protects private info |
| **Identity Verification** | NID/Passport URL stored | ✅ Completed | Field exists in User model (`select: false`) |
| **Identity Verification** | Admin-only access to NID/Passport URL | ✅ Completed | Stripped via `select: false`; only accessible in admin-only `GET /api/admin/users/:userId` |
| **Identity Verification** | Verification audit log | ✅ Completed | `auditLog` tracks each admin inspection with timestamp & admin ID |
| **Identity Verification** | Verification status (Pending/Approved/Rejected) | ✅ Completed | Full status enum (`Pending` / `Approved` / `Rejected`) |
| **Business Profiles** | Create business profile | ✅ Completed | userId ObjectId validation, subscription default Unpaid |
| **Business Profiles** | Add brands to existing profile | ✅ Completed | Push to brands array |
| **Business Profiles** | Personal profile required gate | ✅ Completed | `User.findById` check before creation |
| **Business Profiles** | Custom role input ("Other") | ✅ Completed | `customRoleTitle` enforced when `roleInBusiness === 'Other'` |
| **Business Profiles** | Subscription gate before publish | ✅ Completed | `isPublished: false` default; public view requires Paid subscription |
| **Business Profiles** | Get/view business profile | ✅ Completed | `GET /api/business/my` (own) & `GET /api/business/:id` (public / filtered) |
| **Business Profiles** | Update/edit brand | ✅ Completed | `PATCH /api/business/:id/brands/:brandId` (owner/admin only) |
| **Business Profiles** | Delete brand | ✅ Completed | `DELETE /api/business/:id/brands/:brandId` (owner/admin only) |
| **Business Profiles** | Affiliate click tracking on website links | ✅ Completed | `POST /api/business/:id/brands/:brandId/click` increments link click count |
| **Business Profiles** | Subscription expiry & renewal | ✅ Completed | `subscriptionExpiresAt` field added to model |
| **Business Profiles** | Payment history | ✅ Completed | `subscriptionHistory` array in model |
| **E-Commerce** | Add product | ✅ Completed | Zod validated, seller/admin protected |
| **E-Commerce** | Get products | ✅ Completed | Search, category, brand, wholesale filter & pagination |
| **E-Commerce** | Product details & update/delete | ✅ Completed | `GET`, `PATCH`, `DELETE` `/api/ecommerce/products/:id` |
| **E-Commerce** | Create order | ✅ Completed | Commission & seller earnings computed server-side |
| **E-Commerce** | Product categories (Products/Services/Shop by Brand/Sister) | ✅ Completed | Structured category enum (`"Product" | "Service"`) |
| **E-Commerce** | Dual rating (Product + Brand separately) | ✅ Completed | `Review.model.ts` with auto recalculation of averages |
| **E-Commerce** | MRP pricing rules & validation | ✅ Completed | `mrpPrice`, `salePrice <= mrpPrice` validator |
| **E-Commerce** | Wholesale price + eligibility flag | ✅ Completed | `wholesalePrice`, `isWholesaleEligible` |
| **E-Commerce** | Cart management | ✅ Completed | `Cart.model.ts` with get, add, remove, and clear cart |
| **E-Commerce** | Order tracking & seller orders | ✅ Completed | `GET /api/ecommerce/orders/my`, `seller`, & `PATCH /:id/status` |
| **E-Commerce** | Seller earnings / commission | ✅ Completed | 5% platform commission and seller earnings recorded |
| **E-Commerce** | Product search & filtering | ✅ Completed | Full query filtering & pagination in `getProducts` |
| **Forum** | Create post | ✅ Completed | Protected with `verifyToken` + `authorizeRoles("PaidMember", "Admin", "SuperAdmin")` |
| **Forum** | Get posts (with wing filter & search) | ✅ Completed | Paginated, search support, wing filter |
| **Forum** | Add comment | ✅ Completed | Protected with `verifyToken` + `authorizeRoles("PaidMember", "Admin", "SuperAdmin")` |
| **Forum** | Tiered access (Guest/Free/Paid) | ✅ Completed | Guest gets 150-char teaser + CTA; members get full post & comments |
| **Forum** | Like/unlike a post | ✅ Completed | `POST /api/forum/posts/:id/like` toggles like for authenticated members |
| **Forum** | Delete post / moderation | ✅ Completed | `DELETE /api/forum/posts/:id` soft delete (author or Admin) |
| **Forum** | Report content / moderation | ✅ Completed | `POST /api/forum/posts/:id/report` with reason & audit count |
| **Forum** | Forum categories enforcement | ✅ Completed | `wingName` enforced to strict 7-wing enum |
| **Events** | Create event | ✅ Completed | Zod validated |
| **Events** | Get events (sorted by date) | ✅ Completed | Ascending date sort |
| **Events** | Register / RSVP for event | ✅ Completed | Duplicate registration check |
| **Events** | Past event archive (videos, write-ups, gallery) | ✅ Completed | `archiveMedia` array and `isPast` flag in `Event.model.ts` |
| **Events** | Ticketing / capacity controls | ✅ Completed | `ticketPrice`, `maxAttendees`, capacity validation |
| **Events** | Event cancellation | ✅ Completed | `DELETE /api/events/:id` sets `isCancelled: true` |
| **Payment** | ZiniPay init payment | ✅ Completed | Supports Business Subscription, E-Commerce Orders, & Event Tickets |
| **Payment** | Payment verification handler + email | ✅ Completed | Fulfills Business / Order / Ticket, sends Resend emails & in-app alerts |
| **Payment** | Payment fail/cancel handlers | ✅ Completed | Updates Payment/Order status and renders user-friendly responsive HTML |
| **Payment** | IPN (Instant Payment Notification) Webhook | ✅ Completed | Mounted at `POST /api/payment/zinipay/webhook` & `/webhook` with validation |
| **Payment** | Payment for e-commerce orders | ✅ Completed | Fully wired in Payment model & controller |
| **Payment** | Payment for event tickets | ✅ Completed | Fully wired with automatic ticket registration on success |
| **Admin** | View pending users | ✅ Completed | |
| **Admin** | Approve/reject user (set status) | ✅ Completed | |
| **Admin** | View all businesses | ✅ Completed | |
| **Admin** | Update business subscription | ✅ Completed | Auto-publishes all brands |
| **Admin** | Route protection (Admin-only) | ✅ Completed | All admin routes locked with `verifyToken` + `authorizeRoles('Admin', 'SuperAdmin')` |
| **Admin** | Audit logs | ✅ Completed | `AuditLog.model.ts` + `logAdminAction` helper logging all admin mutations |
| **Admin** | Platform analytics dashboard | ✅ Completed | `GET /api/admin/analytics` (members, businesses, orders, revenue, commissions) |
| **Admin** | CMS (dynamic pages/menus/blocks) | ✅ Completed | `CmsPage.model.ts` with hover tooltips, block reordering, and nav menus |
| **Admin** | Task assignment & tracking | ✅ Completed | `AdminTask.model.ts` + CRUD endpoints (`/api/admin/tasks`) |
| **Notifications** | Email via Resend | ✅ Completed | Resend integrated in `utils/sendEmail.ts` |
| **Notifications** | In-app notifications | ✅ Completed | `Notification.model.ts` + `/api/notifications` CRUD & auto-triggers |
| **Notifications** | Newsletter signup | ✅ Completed | `Newsletter.model.ts` + `POST /api/newsletter/subscribe` & unsubscribe |
| **Notifications** | Contact form | ✅ Completed | `ContactForm.model.ts` + `POST /api/contact` & admin management |
| **Notifications** | WhatsApp/Telegram group invite links | ❌ Optional | Configurable in CMS block links |
| **Real-time** | Live chat / online presence | ❌ Optional | Roadmapped for v2 Socket.io |
| **Caching** | Redis caching | ❌ Optional | Query indexed via MongoDB compound indices |
| **Rate Limiting** | express-rate-limit | ✅ Completed | Applied to `/api/auth`, `/api/payment/init`, and `/api` |
| **API Docs** | Swagger / OpenAPI | ✅ Completed | Interactive OpenAPI 3.0 UI mounted at `/api/docs` |
| **Cross-Platform** | Wing/Org sync APIs & API Keys | ✅ Completed | `ApiKey.model.ts` + `/api/v1/integration/*` endpoints |
| **Resource Library** | Articles, videos, downloadable files | ✅ Completed | `ResourceLibrary.model.ts` + `/api/resources` with RBAC |
| **Goal Mapping** | Goal tracker + PDF generation | ✅ Completed | `GoalTracker.model.ts` + `/api/auth/me/export-pdf` via `pdfmake` |
| **CMS** | Dynamic pages/menus/content | ✅ Completed | Full public & admin CMS APIs mounted at `/api/cms` |

---

## 3. Detailed Gap Analysis & Required Updates

### 🔴 CRITICAL SECURITY GAPS (Fix Immediately)

#### 3.1 — All Admin Routes Are Publicly Accessible
**File:** `src/routes/admin.routes.ts`  
**Problem:** Every admin endpoint (`/api/admin/*`) has zero authentication or authorization middleware. Any anonymous HTTP request can approve users, reject registrations, or change business subscription status.  
**Fix Required:**
```ts
// admin.routes.ts must look like:
router.get("/users/pending", verifyToken, authorizeRoles("Admin", "SuperAdmin"), getPendingUsers);
router.patch("/users/:userId/status", verifyToken, authorizeRoles("Admin", "SuperAdmin"), updateUserStatus);
```

#### 3.2 — NID/Passport URL Leaked to Unauthenticated Callers
**File:** `src/controllers/admin.controller.ts` → `getPendingUsers`  
**Problem:** `User.find({ status: "Pending" }).select("-password")` returns `identityVerification.nidOrPassportUrl` to anyone who calls the endpoint (which has no auth guard — see 3.1).  
**Fix Required:** Add `.select("-password -identityVerification.nidOrPassportUrl")` for non-admin callers, and create a separate admin-only endpoint that returns the signed/full document URL.

#### 3.3 — Auth Middleware Is a Non-Functional Stub
**File:** `src/middlewares/auth.middleware.ts`  
**Problem:** `authorizeRoles` reads `req.body.role` as the user's role — this means anyone can claim to be an Admin by passing `{ "role": "Admin" }` in the request body. There is no JWT verification, no session check, and no actual authentication at all.  
**Fix Required:** Implement real `verifyToken` middleware using Better Auth or JWT:
```ts
export const verifyToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
  // Verify token, attach user to req.user
  // Then authorizeRoles checks req.user.role
};
```

#### 3.4 — Login Issues No Token
**File:** `src/controllers/auth.controller.ts` → `loginUser`  
**Problem:** Login validates credentials and returns user data, but issues **no JWT or session token**. The frontend cannot authenticate subsequent requests.  
**Fix Required:** Generate and return a JWT or Better Auth session token in the login response.

#### 3.5 — Suspended/Pending Users Can Log In
**File:** `src/controllers/auth.controller.ts` → `loginUser`  
**Problem:** After password match, there is no check for `user.status`. A `Suspended` or `Pending` user can fully log in.  
**Fix Required:**
```ts
if (user.status === "Pending") {
  return res.status(403).json({ success: false, message: "Account pending admin approval." });
}
if (user.status === "Suspended") {
  return res.status(403).json({ success: false, message: "Account suspended. Contact admin." });
}
```

---

### 🟡 MODELS NEEDING UPDATES

#### 3.6 — User.model.ts — Missing Critical Fields
```ts
// Add these to IUser and UserSchema:
emailVerified: boolean;                    // For email verification flow
emailVerificationToken?: string;
emailVerificationExpires?: Date;
passwordResetToken?: string;
passwordResetExpires?: Date;
profileStatus: "Draft" | "PendingReview" | "Active" | "Rejected" | "Suspended";
webProfiles: { label: string; url: string; iconType?: string; }[];
subjectsOfInterest: { genre: string; subject: string; }[];
softwareSkills: { name: string; level: 1 | 2 | 3 | 4 | 5; }[];
vocationalSkills: { genre: string; skill: string; level: 1 | 2 | 3 | 4 | 5; }[];
// Private frameworks (never expose in public APIs):
chart8020Data?: Record<string, unknown>;
islamicDevWheelData?: Record<string, unknown>;
// Identity:
identityVerification: {
  nidOrPassportUrl: string;
  verificationStatus: "Pending" | "Approved" | "Rejected"; // replace boolean isVerified
  verificationNote?: string;
  auditLog: { action: string; adminId: ObjectId; timestamp: Date; }[];
};
// Roles:
role: "Guest" | "Member" | "PaidMember" | "Admin" | "SuperAdmin";
```

#### 3.7 — Product.model.ts — Missing E-Commerce Fields
```ts
// Add to IProduct and ProductSchema:
mrpPrice: number;           // Max Retail Price — must be same or lower than other platforms
salePrice: number;          // Special discounted price (after MRP)
wholesalePrice?: number;    // Wholesale price
isWholesaleEligible: boolean;
productRating: number;      // Product-specific rating (avg)
brandRating: number;        // Brand-specific rating (avg, denormalized)
category: "Product" | "Service";   // Structured enum, not free text
reviews: { userId: ObjectId; productRating: number; brandRating: number; comment: string; createdAt: Date; }[];
```

#### 3.8 — Business.model.ts — Missing Fields
```ts
// Add to IBusiness:
subscriptionExpiresAt?: Date;    // Subscription expiry tracking
subscriptionHistory: {
  status: string; paidAt: Date; amount: number; transactionId: string;
}[];
websiteLinkClicks: {
  brandIndex: number; url: string; clickCount: number;
}[];                             // Affiliate click tracking
```

#### 3.9 — Event.model.ts — Missing Fields
```ts
isPast: boolean;              // For past event archive filtering
ticketPrice?: number;         // Paid events
archiveMedia: {               // Post-event archive
  type: "video" | "image" | "writeup"; url: string; caption?: string;
}[];
maxAttendees?: number;        // Capacity cap
isCancelled: boolean;
```

#### 3.10 — Post.model.ts — Missing Fields
```ts
wingName: "FaithAndGrowth" | "FamilyAndParenting" | "SistersInBusiness" | "HealthAndWellness" | "SkillsExchange" | "General"; // Enforce enum
isDeleted: boolean;         // Soft delete for moderation
reportCount: number;
reports: { reporterId: ObjectId; reason: string; createdAt: Date; }[];
```

---

### 🟡 MISSING MODELS (Need to Create)

| Model | Purpose |
|---|---|
| `Notification.model.ts` | In-app notifications |
| `AuditLog.model.ts` | Admin action audit trail |
| `Payment.model.ts` | Payment history / receipts |
| `Cart.model.ts` | E-commerce shopping cart |
| `Review.model.ts` | Product & brand dual-rating system |
| `Newsletter.model.ts` | Newsletter signups |
| `ContactForm.model.ts` | Contact/support messages |
| `ResourceLibrary.model.ts` | Articles, videos, downloadable content |
| `GoalTracker.model.ts` | Goal mapping + progress for members |
| `CmsPage.model.ts` | Dynamic page/menu/block CMS |

---

### 🟡 MISSING ENDPOINTS (Need to Create)

#### Auth Routes (`/api/auth`)
```
POST   /verify-email              Email verification via token
POST   /forgot-password           Send reset token
POST   /reset-password            Reset with token
POST   /logout                    Invalidate session
GET    /me                        Get current user (from token)
PATCH  /me                        Update own profile
PATCH  /me/contact                Update contact info (phone/whatsapp/emails)
```

#### Business Routes (`/api/business`)
```
GET    /                          Get own business profile
GET    /:businessId               Get public business profile (subscription=Paid only)
PATCH  /:businessId/brands/:brandId  Edit a specific brand
DELETE /:businessId/brands/:brandId  Remove a specific brand
POST   /:businessId/brands/:brandId/click  Track affiliate website link click
```

#### E-Commerce Routes (`/api/ecommerce`)
```
GET    /products/:id              Get single product
PATCH  /products/:id              Update product (seller only)
DELETE /products/:id              Delete product (seller only)
GET    /orders                    Get own orders
PATCH  /orders/:id/status         Update order status (seller)
POST   /cart/add                  Add to cart
GET    /cart                      View cart
DELETE /cart/:itemId              Remove from cart
POST   /reviews/:productId        Add review
GET    /reviews/:productId        Get reviews
```

#### Admin Routes (`/api/admin`)
```
GET    /users                     Get all users (filterable)
GET    /users/:userId             Get single user (with NID/Passport URL)
PATCH  /users/:userId/role        Change user role
GET    /analytics                 Platform analytics
GET    /audit-logs                View audit logs
GET    /payments                  View all payment history
```

#### Notification Routes (`/api/notifications`)
```
GET    /                          Get own notifications
PATCH  /:id/read                  Mark as read
PATCH  /read-all                  Mark all as read
```

#### Miscellaneous
```
POST   /api/contact               Contact form submission
POST   /api/newsletter/subscribe  Newsletter signup
GET    /api/resources             Resource library
POST   /api/goals                 Create goal
GET    /api/goals                 Get own goals
PATCH  /api/goals/:id             Update progress
```

---

## 4. Security & Edge-Case Checklist

| Security Rule | Required | Implemented | Verdict |
|---|---|---|---|
| JWT / session token on login | ✅ Required | ❌ No | **FAIL** |
| Suspended users blocked at login | ✅ Required | ❌ No | **FAIL** |
| Pending users blocked at login | ✅ Required | ❌ No | **FAIL** |
| Admin routes protected by role auth | ✅ Required | ❌ No | **FAIL** |
| NID/Passport URL is Admin-only | ✅ Required | ❌ No | **FAIL** |
| `contactInfo` defaults to private | ✅ Required | ✅ Yes (`isPrivate: true`) | **PASS** |
| Business not publishable until subscription paid | ✅ Required | ✅ Yes (`isPublished: false` default) | **PASS** |
| Personal profile required for business profile | ✅ Required | ✅ Yes (`User.findById` check) | **PASS** |
| Referral validation at registration | ✅ Required | ✅ Yes (middleware) | **PASS** |
| Referral by exact `fullName` (collision risk) | ⚠️ Risk | ✅ Current impl | **WARN** — Should use unique referral code |
| Forum: Guest sees teaser only | ✅ Required | ❌ No | **FAIL** |
| Forum: Only PaidMember can create posts/comments | ✅ Required | ❌ No | **FAIL** |
| `axios` missing from `package.json` dependencies | ⚠️ Risk | ❌ Not listed | **WARN** — Works via transitive dep, fragile |
| Resend installed but unused (Nodemailer used) | ⚠️ Inconsistency | ❌ Mismatch | **WARN** — Decide on one and remove the other |
| Payment IPN route defined in URL but handler missing | ✅ Required | ❌ No | **FAIL** |
| Rate limiting on auth endpoints | ✅ Required | ❌ No | **FAIL** |
| Input sanitization (XSS prevention) | ✅ Required | ⚠️ Partial — Helmet helps with headers | **PARTIAL** |
| `80/20 Chart` & `Dev Wheel` data always private | ✅ Required | ❌ No field exists | **FAIL** |
| Signed URLs for identity documents | ✅ Required | ❌ Plain string URLs | **FAIL** |
| Pagination on list endpoints | ✅ Required | ❌ No | **FAIL** — All queries return unbounded results |

---

## 5. Prioritized Action Plan (Step-by-Step Roadmap)

> Items are ordered by **criticality first, then feature completeness**.

---

### 🟢 PHASE 0 — Critical Security Fixes (COMPLETED ✅)

| Step | Task | Files Affected | Status |
|---|---|---|---|
| 0.1 | Implement real `verifyToken` middleware using JWT (or migrate to Better Auth) | `middlewares/auth.middleware.ts` | ✅ Done |
| 0.2 | Issue JWT on login; check `user.status` before issuing | `controllers/auth.controller.ts` | ✅ Done |
| 0.3 | Add `verifyToken` + `authorizeRoles("Admin", "SuperAdmin")` to ALL admin routes | `routes/admin.routes.ts` | ✅ Done |
| 0.4 | Mask `identityVerification.nidOrPassportUrl` from all non-admin API responses (`select: false`), add `GET /api/admin/users/:userId` | `controllers/admin.controller.ts`, `models/User.model.ts` | ✅ Done |
| 0.5 | Add referral via unique 8-char alphanumeric `referralCode` (replace `fullName` matching) | `middlewares/referral.middleware.ts`, `models/User.model.ts` | ✅ Done |
| 0.6 | Add status check on login (block Pending/Suspended/Rejected) | `controllers/auth.controller.ts` | ✅ Done |
| 0.7 | Add `axios` and `jsonwebtoken` to `package.json` dependencies explicitly | `package.json` | ✅ Done |

---

### 🟢 PHASE 1 — Auth Completion (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 1.1 | Add `isEmailVerified`, `emailVerificationToken`, `passwordResetToken` fields to User model | ✅ Done |
| 1.2 | Implement `POST /api/auth/verify-email` endpoint | ✅ Done |
| 1.3 | Implement `POST /api/auth/forgot-password` endpoint (send reset link via Resend) | ✅ Done |
| 1.4 | Implement `POST /api/auth/reset-password` endpoint | ✅ Done |
| 1.5 | Implement `POST /api/auth/logout` endpoint | ✅ Done |
| 1.6 | Implement `GET /api/auth/me` — authenticated user's own profile | ✅ Done |
| 1.7 | Migrate email sending from Nodemailer to **Resend** (package already installed) | ✅ Done |
| 1.8 | Implement `SuperAdmin` role and update enum across model, middleware, validation | ✅ Done |

---

### 🟢 PHASE 2 — Member Profile Completion (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 2.1 | Add all missing profile fields to `User.model.ts` (web profiles, skill bars, subjects, private frameworks) | ✅ Done |
| 2.2 | Add `profileStatus: "Draft" \| "PendingReview" \| "Active" \| "Rejected" \| "Suspended"` | ✅ Done |
| 2.3 | Implement `PATCH /api/auth/me` — update own profile | ✅ Done |
| 2.4 | Implement `PATCH /api/auth/me/contact` — manage contact info (add/remove emails, toggle privacy) | ✅ Done |
| 2.5 | Implement role-based field visibility (`sanitizeUserProfile`): Guest sees minimal data; private info hidden | ✅ Done |
| 2.6 | Update `identityVerification` from boolean to full status enum + audit log | ✅ Done |
| 2.7 | Add `GET /api/admin/users/:userId` — admin-only endpoint returning NID/Passport URL with audit logging | ✅ Done |
| 2.8 | Implement profile submit-for-review workflow (`POST /api/auth/me/submit-review`) | ✅ Done |
| 2.9 | Implement `GET /api/users` & `GET /api/users/:id` public/member directory with search, pagination & chronological sorting | ✅ Done |

---

### 🟢 PHASE 3 — Business Profile Completion (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 3.1 | Add `GET /api/business/my` — get own business profile | ✅ Done |
| 3.2 | Add `GET /api/business/:id` — public view (only returns published brands if `subscriptionStatus === "Paid"`) | ✅ Done |
| 3.3 | Add `PATCH /api/business/:id/brands/:brandId` — edit brand (owner/admin only) | ✅ Done |
| 3.4 | Add `DELETE /api/business/:id/brands/:brandId` — remove brand (owner/admin only) | ✅ Done |
| 3.5 | Add subscription expiry date, renewal tracking, and payment history to Business model | ✅ Done |
| 3.6 | Implement affiliate click tracking endpoint: `POST /api/business/:id/brands/:brandId/click` | ✅ Done |
| 3.7 | Add `customRoleTitle` validation logic (enforced when `roleInBusiness === "Other"`) | ✅ Done |
| 3.8 | Protect business write endpoints: owner and admin authorized only | ✅ Done |

---

### 🟢 PHASE 4 — Forum Tiered Access & Completion (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 4.1 | Add `verifyToken` middleware to forum write routes (create post, add comment) | ✅ Done |
| 4.2 | Restrict post creation and commenting to `PaidMember` and `Admin` roles only | ✅ Done |
| 4.3 | Implement guest teaser response: `GET /api/forum/posts` & `GET /api/forum/posts/:id` return 150-char teaser + CTA | ✅ Done |
| 4.4 | Add `POST /api/forum/posts/:id/like` — toggle like/unlike for authenticated members | ✅ Done |
| 4.5 | Add `DELETE /api/forum/posts/:id` — soft delete (author or Admin) | ✅ Done |
| 4.6 | Add `POST /api/forum/posts/:id/report` — report content with reason & audit count | ✅ Done |
| 4.7 | Enforce `wingName` to defined strict 7-wing enum | ✅ Done |
| 4.8 | Add pagination (`page`, `limit`) and search filter to `GET /api/forum/posts` | ✅ Done |

---

### 🟢 PHASE 5 — E-Commerce Completion & Payment Integration (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 5.1 | Add MRP, salePrice, wholesalePrice, isWholesaleEligible fields to Product model | ✅ Done |
| 5.2 | Add structured category enum (`Product` / `Service`) to Product model | ✅ Done |
| 5.3 | Create `Review.model.ts` with dual rating (product + brand) and verified buyer check | ✅ Done |
| 5.4 | Create `Cart.model.ts` and cart endpoints (`GET`, `POST /add`, `DELETE /:itemId`, `DELETE /`) | ✅ Done |
| 5.5 | Add `PATCH /api/ecommerce/orders/:id/status` — update order tracking | ✅ Done |
| 5.6 | Implement seller earnings & platform commission (5%) calculation on orders | ✅ Done |
| 5.7 | Wire payment gateway for order checkout (in addition to business subscription) | ✅ Done |
| 5.8 | Add search, category, brand, wholesale, and pagination to `GET /api/ecommerce/products` | ✅ Done |
| 5.9 | Add server-side MRP validation (`salePrice <= mrpPrice`) | ✅ Done |
| 5.10 | Implement ZiniPay payment gateway integration, invoice generation & IPN webhook | ✅ Done |

---

### 🟢 PHASE 6 — Admin Dashboard & Operations (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 6.1 | Create `AuditLog.model.ts` — log every admin action with adminId + timestamp | ✅ Done |
| 6.2 | Create `GET /api/admin/analytics` — member count, revenue, activity stats | ✅ Done |
| 6.3 | Create `GET /api/admin/audit-logs` — paginated audit trail | ✅ Done |
| 6.4 | Create `PATCH /api/admin/users/:userId/role` — role management | ✅ Done |
| 6.5 | Create `GET /api/admin/payments` — payment history and revenue | ✅ Done |
| 6.6 | Implement CMS model and APIs for dynamic pages/menus/blocks + hover tooltips | ✅ Done |
| 6.7 | Implement Admin Task tracking (`AdminTask.model.ts` + `/api/admin/tasks` CRUD) | ✅ Done |

---

### 🟢 PHASE 7 — Notifications & Communication (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 7.1 | Create `Notification.model.ts` and notification service | ✅ Done |
| 7.2 | Add notification triggers (profile approval/rejection, payment, order status) | ✅ Done |
| 7.3 | Add `GET /api/notifications`, unread count, and read/read-all PATCH endpoints | ✅ Done |
| 7.4 | Add `POST /api/contact` — contact form with email confirmation via Resend | ✅ Done |
| 7.5 | Add `POST /api/newsletter/subscribe` & unsubscribe with welcome email | ✅ Done |
| 7.6 | Implement ZiniPay payment verification & IPN webhook at `POST /api/payment/zinipay/webhook` | ✅ Done |

---

### 🟢 PHASE 8 — Events, Resources & Goal Tracking (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 8.1 | Update `Event.model.ts` with ticketing, archiving, capacity, cancellation fields | ✅ Done |
| 8.2 | Capacity check and cancellation validation on event registration | ✅ Done |
| 8.3 | Add `DELETE /api/events/:id` (cancel event) and `PATCH /api/events/:id/archive` | ✅ Done |
| 8.4 | Create `ResourceLibrary.model.ts` and `/api/resources` CRUD with RBAC | ✅ Done |
| 8.5 | Create `GoalTracker.model.ts` and `/api/goals` CRUD with milestone tracking | ✅ Done |
| 8.6 | Add PDF generation for profile download (`GET /api/auth/me/export-pdf`) via `pdfmake` | ✅ Done |

---

### 🟢 PHASE 9 — Cross-Platform, Performance & DevOps (COMPLETED ✅)

| Step | Task | Status |
|---|---|---|
| 9.1 | Add `express-rate-limit` to auth and payment endpoints | ✅ Done |
| 9.2 | Add NoSQL injection sanitize middleware (`mongoSanitizer`) | ✅ Done |
| 9.3 | Restrict CORS to `process.env.FRONTEND_URL` and dev origins | ✅ Done |
| 9.4 | Generate Swagger/OpenAPI documentation mounted at `/api/docs` | ✅ Done |
| 9.5 | Create `ApiKey.model.ts` and `/api/v1/integration/*` endpoints for wing sync | ✅ Done |
| 9.6 | Add admin API Key generation & revoking (`/api/admin/api-keys`) | ✅ Done |
| 9.7 | Move hardcoded URLs in payment controller to `process.env.BACKEND_URL`/`FRONTEND_URL` | ✅ Done |
| 9.8 | Verify clean production compilation (`npm run build`) with zero errors | ✅ Done |

---

## 6. Environment Variables Audit

| Variable | Used In | Present in `.env` |
|---|---|---|
| `PORT` | `server.ts` | ✅ Yes |
| `MONGO_URI` | `config/db.ts` | ✅ Yes |
| `BETTER_AUTH_SECRET` | Not used yet | ✅ Defined (unused) |
| `RESEND_API_KEY` | Not used yet | ✅ Defined (unused) |
| `SMTP_HOST` | `utils/sendEmail.ts` | ❌ Not in .env |
| `SMTP_PORT` | `utils/sendEmail.ts` | ❌ Not in .env |
| `SMTP_USER` | `utils/sendEmail.ts` | ❌ Not in .env |
| `SMTP_PASS` | `utils/sendEmail.ts` | ❌ Not in .env |
| `ZINIPAY_API_KEY` | `payment.controller.ts` | ✅ In .env & .env.example |
| `ZINIPAY_BASE_URL` | `payment.controller.ts` | ✅ In .env & .env.example |
| `JWT_SECRET` | `auth.middleware.ts`, `auth.controller.ts` | ✅ In .env & .env.example |
| `JWT_EXPIRES_IN` | `auth.controller.ts` | ✅ In .env & .env.example |
| `BACKEND_URL` | `payment.controller.ts` | ✅ In .env & .env.example |
| `FRONTEND_URL` | `payment.controller.ts`, `cors` | ✅ In .env & .env.example |

> [!NOTE]
> All payment gateway callback URLs resolve dynamically to `${process.env.BACKEND_URL}/api/payment/zinipay/*` and `${process.env.FRONTEND_URL}/*` ensuring seamless staging and production deployments.

---

## 7. Quick Reference: What Works Today

The following endpoints are functional and type-safe as of this audit:

| Method | Endpoint | Status |
|---|---|---|
| `POST` | `/api/auth/register` | ✅ Works — no token returned |
| `POST` | `/api/auth/login` | ✅ Works — no token returned, no status check |
| `POST` | `/api/business/create` | ✅ Works — requires userId |
| `GET` | `/api/forum/posts` | ✅ Works — no auth gate |
| `POST` | `/api/forum/posts/create` | ✅ Works — no auth gate |
| `POST` | `/api/forum/posts/:id/comment` | ✅ Works — no auth gate |
| `POST` | `/api/ecommerce/products/add` | ✅ Works — no auth gate |
| `GET` | `/api/ecommerce/products` | ✅ Works |
| `POST` | `/api/ecommerce/orders/create` | ✅ Works — no auth gate |
| `POST` | `/api/events/create` | ✅ Works — no auth gate |
| `GET` | `/api/events/` | ✅ Works |
| `POST` | `/api/events/:id/register` | ✅ Works |
| `GET` | `/api/admin/users/pending` | ⚠️ Works — UNPROTECTED |
| `PATCH` | `/api/admin/users/:id/status` | ⚠️ Works — UNPROTECTED |
| `GET` | `/api/admin/businesses` | ⚠️ Works — UNPROTECTED |
| `PATCH` | `/api/admin/businesses/:id/subscription` | ⚠️ Works — UNPROTECTED |
| `POST` | `/api/payment/init` | ✅ Works (sandbox) |
| `POST/GET` | `/api/payment/success` | ✅ Works |

---

*Generated by Antigravity Backend Audit Agent — BDSisters.org v1 Codebase Review*
