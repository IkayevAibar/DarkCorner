-- Runs once when the dev volume is first created: a second database for tests,
-- so `npm test` never wipes the one you play on.
CREATE DATABASE dark_corner_test OWNER dark;
