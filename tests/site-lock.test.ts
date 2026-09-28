import assert from 'node:assert/strict';
import test from 'node:test';
import { alwaysOpen, holdingPage, lockDecision } from '../src/lib/site-lock';

const ask = (over: Partial<Parameters<typeof lockDecision>[0]> = {}) =>
  lockDecision({ locked: true, pathname: '/en', presented: null, cookie: undefined, secret: 'sesame', ...over });

test('an unlocked site is simply open', () => {
  assert.equal(ask({ locked: false }), 'open');
  assert.equal(ask({ locked: false, pathname: '/en/projects' }), 'open');
});

test('a locked site holds the public pages', () => {
  assert.equal(ask(), 'hold');
  assert.equal(ask({ pathname: '/zh/projects/some-case-study' }), 'hold');
  assert.equal(ask({ pathname: '/' }), 'hold');
});

test('the admin, its API and an already-sent share link stay open behind the curtain', () => {
  for (const path of ['/admin', '/admin/files', '/admin/login', '/api/admin/assets', '/en/share/abc', '/zh/share/abc/download']) {
    assert.equal(ask({ pathname: path }), 'open', path);
    assert.equal(alwaysOpen(path), true, path);
  }
  // A page that merely mentions sharing is not a share link.
  assert.equal(alwaysOpen('/en/sharing'), false);
  assert.equal(alwaysOpen('/en/projects'), false);
});

test('the secret is traded once for a cookie, and the cookie is what carries afterwards', () => {
  assert.equal(ask({ presented: 'sesame' }), 'unlock');
  assert.equal(ask({ cookie: 'sesame' }), 'open');
  assert.equal(ask({ presented: 'wrong' }), 'hold');
  assert.equal(ask({ cookie: 'wrong' }), 'hold');
});

test('with no secret configured there is no way past the curtain', () => {
  assert.equal(ask({ secret: undefined, presented: 'sesame' }), 'hold');
  assert.equal(ask({ secret: '   ', cookie: '   ' }), 'hold');
});

test('the holding note tells crawlers to keep away and names nobody else', () => {
  const page = holdingPage();
  assert.match(page, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(page, /lang="en"/);
  assert.doesNotMatch(page, /@/, 'no address to harvest while the site is closed');
});
