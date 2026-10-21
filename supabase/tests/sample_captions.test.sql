BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);

SELECT extensions.is(
  public.valid_sample_captions(ARRAY['Günlük bir not.', 'Bugün buradayım.']),
  true,
  'accepts a short list of sample captions'
);
SELECT extensions.is(
  public.valid_sample_captions(ARRAY['1','2','3','4','5','6','7','8','9','10','11']),
  false,
  'rejects more than ten sample captions'
);
SELECT extensions.is(
  public.valid_sample_captions(ARRAY[repeat('a', 2201)]),
  false,
  'rejects a caption over 2,200 characters'
);
SELECT extensions.is(
  public.valid_sample_captions(ARRAY['   ']),
  false,
  'rejects blank sample captions'
);

SELECT * FROM extensions.finish();
ROLLBACK;
