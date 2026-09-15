# PhotoGuard Monetization Strategy & Workflow

## Overview
PhotoGuard uses a freemium SaaS model. The platform serves three main roles:
1. **Super Admin / Platform Owner:** Manages the entire SaaS, approves payments, upgrades tiers.
2. **Photographer:** Uploads photos, manages client galleries, upgrades their account.
3. **Client:** Receives a 6-digit code to securely view and select photos.

## Plan Tiers

### 1. Starter Plan (Default upon signup)
* **Limits:** Can create up to 3 albums, upload up to 50 photos per album.
* **Watermark Constraint:** ALL photos uploaded to the client gallery get an automated "PhotoGuard" watermark overlaid via Cloudinary.
* **Purpose:** Allows photographers to try the platform for free but incentivizes them to upgrade to remove the watermark for professional client delivery.

### 2. Pro Plan
* **Limits:** Up to 20 albums, 500 photos per album.
* **Feature Unlock:** **No Watermarks.** Photos are delivered to the client gallery completely clean.
* **Cost:** E.g., 1000 ETB / month.

### 3. Studio Plan
* **Limits:** Unlimited albums, unlimited photos.
* **Feature Unlock:** No Watermarks, custom branding (ability to add their own logo instead of PhotoGuard), priority support, and multi-user access (assistant accounts).
* **Cost:** E.g., 2500 ETB / month.

## Payment & Upgrade Workflow (As built in the code)
1. **Photographer Action:** The photographer navigates to the "Billing/Upgrade" section in their dashboard. They see the Telebirr/CBE account numbers.
2. **Submission:** They transfer the money and submit the Transaction ID and a screenshot of the receipt via the UI.
3. **Database Entry:** The backend saves a `PaymentReceipt` record with status `PENDING`.
4. **Admin Approval:** The Super Admin logs into the Admin Dashboard, sees the "Pending Upgrades", and clicks "Approve".
5. **Upgrade Execution:** The user's `tier` in the `User` table is updated from 'starter' to 'pro' or 'studio'.
6. **Result:** The next time the photographer uploads a photo, the `storage.py` logic checks their `tier` and skips the watermark step.

## Client Workflow (End-to-End)
1. **Photographer Creates Album:** Gets a 6-digit code (e.g., `6A9B2C`).
2. **Photographer Uploads Photos:** Backend sends low-res to Cloudinary (watermarked if Starter plan) and original to S3.
3. **Client Access:** Client enters `6A9B2C` in the frontend (or mobile app).
4. **Gallery View:** Client sees the Cloudinary images. The UI prevents right-click/download.
5. **Selection:** Client selects their favorite photos and clicks "Submit to Photographer".
6. **Final Delivery:** Photographer gets a notification of selected IDs and can generate a secure ZIP download link for the client using the private S3 bucket.
