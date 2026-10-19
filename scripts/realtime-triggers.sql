CREATE SCHEMA IF NOT EXISTS ecorewards;

CREATE OR REPLACE FUNCTION ecorewards.notify_realtime_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'ecorewards_data_changed',
    '{}'
  );
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  target_table record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'ecorewards'
      AND tablename = 'RewardWallet'
  ) THEN
    RAISE EXCEPTION 'The ecorewards.RewardWallet table is missing; apply the Prisma schema before enabling realtime notifications.';
  END IF;

  FOR target_table IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'ecorewards'
      AND tablename <> '_prisma_migrations'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'ecorewards_realtime_change'
        AND tgrelid = format('%I.%I', target_table.schemaname, target_table.tablename)::regclass
        AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER ecorewards_realtime_change
         AFTER INSERT OR UPDATE OR DELETE ON %I.%I
         FOR EACH STATEMENT
         EXECUTE FUNCTION ecorewards.notify_realtime_change()',
        target_table.schemaname,
        target_table.tablename
      );
    END IF;
  END LOOP;
END;
$$;
