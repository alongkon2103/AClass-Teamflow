-- Progress updates, replies and meeting notes become rich text.
--
-- Content is stored as a TipTap (ProseMirror) document rather than HTML, so
-- rendering needs no sanitiser. Existing plain text is wrapped into a document
-- in place: one paragraph holding the original string, so nothing anyone wrote
-- is lost or reflowed.
--
-- Empty strings become an empty document rather than a paragraph containing an
-- empty text node, which ProseMirror rejects as invalid.
--
-- Every step is guarded so a re-run after a partial failure is safe.

CREATE OR REPLACE FUNCTION tf_text_to_doc(content TEXT) RETURNS JSONB AS $$
  SELECT CASE
    WHEN content IS NULL OR btrim(content) = '' THEN
      jsonb_build_object('type', 'doc', 'content', '[]'::jsonb)
    ELSE
      jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', content)
            )
          )
        )
      )
  END;
$$ LANGUAGE SQL IMMUTABLE;

DO $$
DECLARE
  -- Meeting fields are optional, so a NULL must stay NULL: "no summary written
  -- yet" has to remain distinguishable from "an empty summary".
  target RECORD;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('ProgressEntry', 'body',        FALSE),
      ('ProgressComment', 'body',      FALSE),
      ('Meeting', 'summary',           TRUE),
      ('Meeting', 'description',       TRUE)
    ) AS t(table_name, column_name, nullable)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = target.table_name
        AND column_name = target.column_name
        AND data_type <> 'jsonb'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE JSONB USING %s',
        target.table_name,
        target.column_name,
        CASE WHEN target.nullable
          THEN format('CASE WHEN %I IS NULL THEN NULL ELSE tf_text_to_doc(%I) END',
                      target.column_name, target.column_name)
          ELSE format('tf_text_to_doc(%I)', target.column_name)
        END
      );
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS tf_text_to_doc(TEXT);

-- Being @-mentioned is its own kind of notification.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTIONED';
