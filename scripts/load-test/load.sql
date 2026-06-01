-- Write load: batch insert of 500 rows with random payload
INSERT INTO load_test (k, payload)
SELECT (random()*100000)::int, repeat(md5(random()::text), 8)
FROM generate_series(1, 500);

-- CPU/RAM load: large hash aggregate + sort over an in-memory series
SELECT count(*), avg(x), max(md5(x::text))
FROM (
  SELECT (random()*1000000)::int AS x
  FROM generate_series(1, 50000)
) s
GROUP BY x % 1000
ORDER BY 1 DESC;
