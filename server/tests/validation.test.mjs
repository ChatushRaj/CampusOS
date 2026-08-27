import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { registerSchema, loginSchema, changePasswordSchema } = await import('../dist/modules/auth/auth.schema.js');
const { createPostSchema, listPostsSchema } = await import('../dist/modules/posts/post.schema.js');
const { createBlogSchema, updateBlogSchema } = await import('../dist/modules/blogs/blog.schema.js');

const rejects = (schema, value) => assert.throws(() => schema.parse(value));
const accepts = (schema, value) => assert.doesNotThrow(() => schema.parse(value));

const valid = { name: 'Ann Lee', email: 'a@b.co', password: 'Abcdefg1', role: 'student' };

test('password policy', async (t) => {
  await t.test('rejects a password under eight characters', () =>
    rejects(registerSchema, { ...valid, password: 'Ab1' }),
  );
  await t.test('rejects a password with no uppercase letter', () =>
    rejects(registerSchema, { ...valid, password: 'abcdefg1' }),
  );
  await t.test('rejects a password with no digit', () => rejects(registerSchema, { ...valid, password: 'Abcdefgh' }));
  await t.test('accepts a compliant password', () => accepts(registerSchema, valid));
  await t.test('applies the same policy when changing password', () =>
    rejects(changePasswordSchema, { currentPassword: 'x', newPassword: 'weak' }),
  );
});

test('registration input', async (t) => {
  await t.test('rejects a malformed email', () => rejects(registerSchema, { ...valid, email: 'not-an-email' }));
  await t.test('rejects a one-character name', () => rejects(registerSchema, { ...valid, name: 'A' }));
  await t.test('rejects an unrecognised role', () => rejects(registerSchema, { ...valid, role: 'superuser' }));
  await t.test('normalises email to lowercase and trims whitespace', () => {
    const parsed = registerSchema.parse({ ...valid, name: '  Ann Lee  ', email: '  A@B.CO ' });
    assert.equal(parsed.email, 'a@b.co');
    assert.equal(parsed.name, 'Ann Lee');
  });
  await t.test('defaults an omitted role to student', () => {
    const { role, ...withoutRole } = valid;
    assert.equal(registerSchema.parse(withoutRole).role, 'student');
  });
  await t.test('rejects a blank password on sign-in', () => rejects(loginSchema, { email: 'a@b.co', password: '' }));
});

test('post input', async (t) => {
  await t.test('rejects a whitespace-only body', () => rejects(createPostSchema, { body: '   ' }));
  await t.test('rejects a body over the 3000 character limit', () =>
    rejects(createPostSchema, { body: 'x'.repeat(3001) }),
  );
  await t.test('accepts a body exactly at the limit', () => accepts(createPostSchema, { body: 'x'.repeat(3000) }));
  await t.test('lowercases and de-duplicates tags', () => {
    const { tags } = createPostSchema.parse({ body: 'hi', tags: 'Robotics, robotics , Clubs,,  ' });
    assert.deepEqual(tags, ['robotics', 'clubs']);
  });
  await t.test('caps tags at six', () => {
    const { tags } = createPostSchema.parse({ body: 'hi', tags: 'a,b,c,d,e,f,g,h' });
    assert.equal(tags.length, 6);
  });
  await t.test('defaults visibility to campus', () =>
    assert.equal(createPostSchema.parse({ body: 'hi' }).visibility, 'campus'),
  );
  await t.test('strips unknown keys so a client cannot set server-owned fields', () => {
    const parsed = createPostSchema.parse({ body: 'hi', likeCount: 9999, isAdmin: true });
    assert.deepEqual(Object.keys(parsed).sort(), ['body', 'tags', 'visibility']);
  });
});

test('list query input', async (t) => {
  await t.test('coerces page and limit to numbers', () => {
    const parsed = listPostsSchema.parse({ page: '3', limit: '20' });
    assert.equal(typeof parsed.page, 'number');
    assert.equal(typeof parsed.limit, 'number');
  });
  await t.test('rejects a limit above the ceiling', () => rejects(listPostsSchema, { limit: '999' }));
  await t.test('rejects an author id that is not a number', () => rejects(listPostsSchema, { author: 'not-an-id' }));
  await t.test('rejects a negative author id', () => rejects(listPostsSchema, { author: '-3' }));
  await t.test('coerces a numeric author id from the query string', () => {
    const parsed = listPostsSchema.parse({ author: '42' });
    assert.equal(parsed.author, 42);
  });
});

test('article input', async (t) => {
  const title = 'A perfectly good title';
  await t.test('rejects a body under forty characters', () =>
    rejects(createBlogSchema, { title, body: 'x'.repeat(39) }),
  );
  await t.test('accepts a body at forty characters', () => accepts(createBlogSchema, { title, body: 'x'.repeat(40) }));
  await t.test('allows a partial update with only a title', () => accepts(updateBlogSchema, { title: 'New title' }));
});
