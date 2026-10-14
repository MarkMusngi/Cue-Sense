-- Runs once, when the postgres volume is first created.
-- Creates the separate database that pytest uses (TEST_DATABASE_URL).
CREATE DATABASE cuesense_test;
