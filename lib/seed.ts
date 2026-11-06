// The river opens blank.
//
// The site originally shipped with eight seed wishes (verbatim from the
// first version of the site, each with a translation for the other
// language tab). Faiq asked on 2026-11-06 for a blank river instead, so
// the seeds were removed from what the site shows. They are not lost:
// the full list lives in git history (commit 22af37c5, this file) and can
// be restored by putting the entries back in SEED_WISHES below.
//
// Seeds were merged into every GET /api/wishes response but never
// written to Redis; with this list empty, the river only ever shows
// wishes real visitors have floated.

import type { Wish } from './data';

export const SEED_WISHES: Wish[] = [];
