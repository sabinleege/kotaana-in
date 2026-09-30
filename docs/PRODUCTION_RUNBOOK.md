# Kotaana production runbook

1. Provision PostgreSQL and set `DATABASE_URL` and `DIRECT_URL`.
2. Set a long random `AUTH_SECRET` and the public `AUTH_URL`.
3. Configure Google OAuth redirect URLs if Google sign-in is enabled.
4. Run `npm ci`.
5. Run `npx prisma migrate deploy`.
6. Set `ADMIN_BOOTSTRAP_PASSWORD` only for the initial bootstrap and run `npm run db:seed`; rotate/remove the bootstrap secret afterwards.
7. Configure AI keys if AI reranking is desired; the deterministic workout engine remains functional without AI.
8. Configure live MTN MoMo collection credentials and `MOMO_WEBHOOK_SECRET` before enabling payments.
9. Configure Resend/email credentials before advertising password-reset email delivery.
10. Configure durable image storage (S3/R2) rather than database storage for production-scale progress photos/documents.
11. Run `npm run typecheck`, `npm test`, and `npm run build`.
12. Run authenticated E2E checks for signup/login, role routing, onboarding, workout generation/performance, nutrition, health, GPS tracking, coach connection, payment initiation/webhook, password reset and sign-out.
13. Verify backups and restore against the production PostgreSQL instance before launch.
