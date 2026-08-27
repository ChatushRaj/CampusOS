import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { escapeLike, containsPattern, getPageParams, paginated } = await import('../dist/utils/pagination.js');
const { slugify, estimateReadMinutes } = await import('../dist/modules/blogs/blog.schema.js');
const { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } =
  await import('../dist/utils/tokens.js');
const { ApiError } = await import('../dist/utils/ApiError.js');

test('search input is escaped before reaching a LIKE pattern', async (t) => {
  await t.test('escapes LIKE wildcards so they match literally', () => {
    assert.equal(escapeLike('100%'), '100\\%');
    assert.equal(escapeLike('user_name'), 'user\\_name');
    assert.equal(escapeLike('back\\slash'), 'back\\\\slash');
  });
  await t.test('wraps an escaped term for a contains search', () => assert.equal(containsPattern('50%'), '%50\\%%'));
  await t.test('leaves ordinary text untouched', () => assert.equal(escapeLike('robotics club'), 'robotics club'));
  await t.test('neutralises a catastrophic backtracking pattern', () =>
    assert.equal(containsPattern('(a+)+$'), '%(a+)+$%'),
  );
  await t.test('still matches the literal text a user meant', () => assert.equal(containsPattern('C++'), '%C++%'));
});

test('pagination is clamped', async (t) => {
  const params = (query) => getPageParams({ query });
  await t.test('caps limit at the maximum', () => assert.equal(params({ limit: '9999' }).limit, 50));
  await t.test('floors a negative page at one', () => assert.equal(params({ page: '-5' }).page, 1));
  await t.test('falls back to page one for non-numeric input', () => assert.equal(params({ page: 'abc' }).page, 1));
  await t.test('falls back to the default limit for zero', () => assert.equal(params({ limit: '0' }).limit, 12));
  await t.test('computes skip from page and limit', () => assert.equal(params({ page: '3', limit: '10' }).skip, 20));
});

test('pagination metadata', async (t) => {
  await t.test('rounds total pages up', () => assert.equal(paginated([], 25, { page: 1, limit: 10 }).totalPages, 3));
  await t.test('reports more results mid-list', () =>
    assert.equal(paginated([], 25, { page: 1, limit: 10 }).hasMore, true),
  );
  await t.test('reports no more results on the last page', () =>
    assert.equal(paginated([], 25, { page: 3, limit: 10 }).hasMore, false),
  );
  await t.test('reports one page when there are no results', () =>
    assert.equal(paginated([], 0, { page: 1, limit: 10 }).totalPages, 1),
  );
});

test('article helpers', async (t) => {
  await t.test('builds a slug without punctuation', () =>
    assert.equal(slugify('What I Learned: Running a DB!'), 'what-i-learned-running-a-db'),
  );
  await t.test('trims leading and trailing dashes', () => assert.equal(slugify('  --Hello--  '), 'hello'));
  await t.test('never reports less than one minute', () => assert.equal(estimateReadMinutes('short'), 1));
  await t.test('estimates roughly two hundred words a minute', () =>
    assert.equal(estimateReadMinutes(Array(400).fill('word').join(' ')), 2),
  );
});

test('tokens', async (t) => {
  const accessToken = signAccessToken({ sub: '507f1f77bcf86cd799439011', role: 'admin' });

  await t.test('round-trips the role claim', () => assert.equal(verifyAccessToken(accessToken).role, 'admin'));
  await t.test('rejects a tampered signature', () =>
    assert.throws(() => verifyAccessToken(`${accessToken.slice(0, -3)}xyz`)),
  );
  await t.test('rejects an access token presented as a refresh token', () =>
    assert.throws(() => verifyRefreshToken(accessToken)),
  );
  await t.test('carries the token version used to revoke sessions', () =>
    assert.equal(verifyRefreshToken(signRefreshToken('507f1f77bcf86cd799439011', 7)).v, 7),
  );
});

test('error envelope', async (t) => {
  await t.test('maps forbidden to 403', () => assert.equal(ApiError.forbidden().status, 403));
  await t.test('maps conflict to 409', () => assert.equal(ApiError.conflict().status, 409));
  await t.test('uses a message safe to show a user', () =>
    assert.equal(ApiError.notFound().message, 'That resource does not exist.'),
  );
});
