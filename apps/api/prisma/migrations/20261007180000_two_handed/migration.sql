-- Two-handed weapons fill both hands (docs/design.md -> Hands). Whatever a Hero holds in the
-- off-hand beside a greatsword, greataxe, maul or bow goes back to its Bag, or to its Storage
-- when the Bag is full. Nothing is lost; the Player can choose again.
WITH beside AS (
  SELECT o.id,
         (SELECT count(*) FROM "Item" b WHERE b."heroId" = o."heroId" AND b.place = 'BAG') AS bag
  FROM "Item" o
  JOIN "Item" m ON m."heroId" = o."heroId" AND m.place = 'WORN' AND m.slot = 'main'
    AND m.base IN ('greatsword', 'greataxe', 'maul', 'shortbow', 'longbow', 'crossbow')
  WHERE o.place = 'WORN' AND o.slot = 'off'
)
UPDATE "Item" i
SET place = CASE WHEN beside.bag < 20 THEN 'BAG'::"ItemPlace" ELSE 'STORAGE'::"ItemPlace" END,
    slot = NULL,
    "updatedAt" = now()
FROM beside
WHERE i.id = beside.id;
