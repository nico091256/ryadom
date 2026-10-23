-- System actions (BullMQ auto-cancel, stale-order sweep) have no user behind them.
-- The FK to users stays as is (ON DELETE RESTRICT); only NULL becomes allowed.
ALTER TABLE "order_status_history" ALTER COLUMN "changed_by" DROP NOT NULL;
