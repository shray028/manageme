"""
End-to-end browser tests for the DSA tracker.

Runs the real app (vite dev server, VITE_E2E=1) in Chromium against a local stand-in server that
the tests can make fail, hang, or refuse writes. This lets us prove the important promise: whatever
goes wrong, a person's notes are never lost.

Usage:  python3 tests/e2e/run.py            (starts the dev server itself if needed)
Needs:  pip install playwright && playwright install chromium   (or set CHROMIUM_PATH)
"""
import json
import re
import os
import subprocess
import sys
import time
import traceback
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('E2E_BASE', 'http://localhost:5173')
SHOTS = Path(os.environ.get('E2E_SHOTS', ROOT / 'tests' / 'e2e' / 'screenshots'))
SERVER_KEY = 'manageme:e2e:server:v1'
UID = 'test-user'

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


# ----------------------------------------------------------------------------- helpers

def server_docs(page: Page) -> dict:
    raw = page.evaluate(f"localStorage.getItem('{SERVER_KEY}')")
    return json.loads(raw or '{}')


def server_doc(page: Page, collection: str, doc_id: str) -> dict:
    return server_docs(page).get(f'users/{UID}/{collection}/{doc_id}', {})


def set_mode(page: Page, mode: str, persist=False):
    page.evaluate(f"window.__manageMeTest && (window.__manageMeTest.mode = '{mode}')")
    if persist:
        page.evaluate(f"localStorage.setItem('manageme:e2e:mode', '{mode}')")
    else:
        page.evaluate("localStorage.removeItem('manageme:e2e:mode')")


def wait_saved(page: Page, timeout=15000):
    expect(page.get_by_test_id('save-status')).to_have_attribute('data-state', 'saved', timeout=timeout)


def sign_in(page: Page):
    page.goto(f'{BASE}/#/dsa')
    page.get_by_role('button', name='Sign in with Google').click()
    expect(page.get_by_role('heading', level=1)).to_contain_text('practising')


SHEET_TITLES = ['LeetCode Top Interview Questions (Easy collection)', "Striver's 180 – Master DSA Patterns"]


def start_sheet(page: Page, index: int):
    card = page.locator('li.dsa-panel').filter(has=page.get_by_role('heading', name=SHEET_TITLES[index], exact=True))
    card.get_by_role('button', name='Start this sheet').or_(card.get_by_role('button', name='Open')).click()
    expect(page.get_by_role('link', name='All lists').or_(page.get_by_role('button', name='All lists'))).to_be_visible()


def row(page: Page, title: str):
    """A problem in the left-hand list."""
    return page.get_by_test_id('problem-item').filter(has=page.get_by_text(title, exact=True)).first


def tick(page: Page, title: str, which='Done'):
    """Tick Done/Revised straight from the left-hand list."""
    box = row(page, title).get_by_role('checkbox', name=f'{which}: {title}')
    if box.get_attribute('aria-checked') != 'true':
        box.click()
    expect(box).to_have_attribute('aria-checked', 'true')


def open_row(page: Page, title: str):
    """Open a problem in the centre workspace and return it."""
    row(page, title).locator('.dsa-item-main').click()
    r = page.get_by_test_id('problem-detail')
    expect(r.get_by_role('heading', level=1)).to_contain_text(title)
    expect(r.get_by_test_id('code-editor')).to_be_visible(timeout=10000)
    return r


def type_code(page: Page, r, text: str):
    r.locator('.cm-content').click()
    page.keyboard.type(text)


# ----------------------------------------------------------------------------- tests

@test
def first_visit_shows_simple_dsa_start(page: Page):
    page.goto(f'{BASE}/#/dsa')
    expect(page.get_by_role('heading', name='Track your DSA practice in one place')).to_be_visible()
    sign_in(page)
    expect(page.get_by_text('LeetCode Top Interview Questions (Easy collection)')).to_be_visible()
    expect(page.get_by_text("Striver's 180 – Master DSA Patterns")).to_be_visible()
    page.screenshot(path=str(SHOTS / 'home.png'), full_page=True)


@test
def everything_written_on_a_problem_survives_a_reload(page: Page):
    sign_in(page)
    start_sheet(page, 1)  # Striver
    expect(page.get_by_role('progressbar', name='Problems done').and_(page.locator('[aria-valuetext=\"0 of 179 done\"]'))).to_be_visible()
    tick(page, 'Majority Element-I', 'Done')
    r = open_row(page, 'Majority Element-I')
    r.get_by_role('checkbox', name='Revised', exact=True).click()
    # Default reference link from the sheet
    expect(r.get_by_role('link', name="Striver's video explanation")).to_have_attribute('href', 'https://youtu.be/nP_ns3uSh80')
    type_code(page, r, 'def majority(nums):\nreturn max(nums)')
    r.get_by_label('When I solved it').fill('Moore voting: keep a candidate and a count.')
    r.get_by_label('When I revised it').fill('Forgot to reset the candidate when count hits 0.')
    r.get_by_label('Mistake to remember').fill('Reset candidate when count == 0')
    r.get_by_role('button', name='Add to weak list').click()
    r.get_by_placeholder('Name (optional)').fill('NeetCode explanation')
    r.get_by_placeholder('https://…').fill('https://www.youtube.com/watch?v=7pnhv842keE')
    r.get_by_role('button', name='Add link').click()
    wait_saved(page)

    saved = server_doc(page, 'dsaProgress', 'majority-element')
    assert saved['completed'] is True and saved['revised'] is True, saved
    # Auto-indent: the body line was indented by the editor, not by us.
    assert saved['code'] == 'def majority(nums):\n    return max(nums)', repr(saved['code'])
    assert saved['bookmarked'] is True
    assert [l['label'] for l in saved['links']] == ["Striver's video explanation", 'NeetCode explanation']
    assert saved['title'] == 'Majority Element-I'

    page.reload()
    r = open_row(page, 'Majority Element-I')
    expect(r.get_by_role('checkbox', name='Done', exact=True)).to_have_attribute('aria-checked', 'true')
    expect(r.get_by_role('checkbox', name='Revised', exact=True)).to_have_attribute('aria-checked', 'true')
    expect(r.locator('.cm-content')).to_contain_text('return max(nums)')
    expect(r.get_by_label('Mistake to remember')).to_have_value('Reset candidate when count == 0')
    expect(r.get_by_role('link', name='NeetCode explanation')).to_be_visible()
    expect(page.get_by_role('progressbar', name='Problems done').and_(page.locator('[aria-valuetext=\"1 of 179 done\"]'))).to_be_visible()
    page.screenshot(path=str(SHOTS / 'problem-open.png'))


@test
def server_outage_never_loses_notes_even_across_reload(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    wait_saved(page)
    set_mode(page, 'fail', persist=True)
    r = open_row(page, 'Two Sum')
    r.get_by_label('When I solved it').fill('Hash map of value -> index. One pass.')
    r.get_by_role('checkbox', name='Done', exact=True).click()
    expect(page.get_by_test_id('save-status')).to_have_attribute('data-state', 'retrying', timeout=10000)
    expect(page.get_by_text('Not saved yet')).to_be_visible()
    assert 'completedNote' not in server_doc(page, 'dsaProgress', 'two-sum')
    page.screenshot(path=str(SHOTS / 'save-failing.png'))

    # The tab is reloaded (or crashes) while the server is still down.
    page.evaluate("window.onbeforeunload = null")
    page.reload()
    r = open_row(page, 'Two Sum')
    expect(r.get_by_label('When I solved it')).to_have_value('Hash map of value -> index. One pass.')
    expect(r.get_by_role('checkbox', name='Done', exact=True)).to_have_attribute('aria-checked', 'true')

    # Server comes back: automatic retries deliver everything without anyone pressing a button.
    set_mode(page, 'ok')
    wait_saved(page, timeout=30000)
    saved = server_doc(page, 'dsaProgress', 'two-sum')
    assert saved['completedNote'] == 'Hash map of value -> index. One pass.', saved
    assert saved['completed'] is True
    journal = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('manageme:dsa:journal'))")
    assert journal == [], journal


@test
def permission_denied_is_explained_and_data_kept(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    wait_saved(page)
    set_mode(page, 'deny')
    r = open_row(page, 'Plus One')
    r.get_by_label('Mistake to remember').fill('Carry at the front: [9,9] -> [1,0,0]')
    expect(page.get_by_test_id('save-status')).to_have_attribute('data-state', 'blocked', timeout=10000)
    expect(page.get_by_test_id('save-status')).to_have_attribute('title', re.compile('permission denied'))
    stored = page.evaluate("Object.entries(localStorage).filter(([k]) => k.startsWith('manageme:dsa:journal')).map(([,v]) => v).join('')")
    assert 'Carry at the front' in stored
    set_mode(page, 'ok')
    page.get_by_role('button', name='Retry now').click()
    wait_saved(page)
    assert server_doc(page, 'dsaProgress', 'plus-one')['mistake'].startswith('Carry at the front')


@test
def failed_load_never_shows_or_saves_empty_data(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    tick(page, 'Two Sum')
    wait_saved(page)
    before = server_docs(page)
    set_mode(page, 'fail-load', persist=True)
    page.reload()
    expect(page.get_by_role('heading', name='Couldn’t open your DSA data')).to_be_visible()
    assert server_docs(page) == before
    set_mode(page, 'ok')
    page.get_by_role('button', name='Try again').click()
    expect(page.get_by_role('progressbar', name='Problems done').and_(page.locator('[aria-valuetext=\"1 of 48 done\"]'))).to_be_visible()


@test
def add_problems_by_name_and_by_leetcode_link(page: Page):
    sign_in(page)
    start_sheet(page, 1)
    page.get_by_label('Problem name or LeetCode link').fill('https://leetcode.com/problems/zigzag-conversion/description/')
    page.get_by_role('button', name='Add problem').click()
    # LeetCode is unreachable from the test machine, so the app must fall back gracefully.
    expect(page.get_by_text('LeetCode couldn’t be reached, so the name comes from the link', exact=False)).to_be_visible(timeout=20000)
    expect(row(page, 'Zigzag Conversion')).to_be_visible()
    # Adding a problem that is already in the sheet does not duplicate it.
    page.get_by_label('Problem name or LeetCode link').fill('https://leetcode.com/problems/lru-cache/')
    page.get_by_role('button', name='Add problem').click()
    expect(page.get_by_text('is already in this list', exact=False)).to_be_visible(timeout=20000)
    expect(row(page, 'LRU Cache')).to_have_count(1)

    page.get_by_label('Problem name or LeetCode link').fill('Count distinct elements in every window')
    page.get_by_label('Link to the problem (optional)').fill('www.geeksforgeeks.org/count-distinct-elements-in-every-window-of-size-k/')
    page.get_by_label('Put it under').select_option('Added by me')
    page.get_by_role('button', name='Add problem').click()
    expect(page.get_by_text('Added “Count distinct elements in every window”.')).to_be_visible()
    wait_saved(page)
    r = open_row(page, 'Count distinct elements in every window')
    expect(r.get_by_role('link', name='Open problem')).to_have_attribute(
        'href', 'https://www.geeksforgeeks.org/count-distinct-elements-in-every-window-of-size-k/'
    )
    lists = {k: v for k, v in server_docs(page).items() if '/dsaLists/' in k}
    extra = list(lists.values())[0]['extraProblems']
    assert any(p['title'] == 'Count distinct elements in every window' for p in extra), extra


@test
def add_by_link_fills_number_and_title_when_leetcode_answers(page: Page):
    sign_in(page)
    page.route('**/api/leetcode', lambda route: route.fulfill(
        status=200, content_type='application/json',
        body=json.dumps({'kind': 'problem', 'problem': {'key': 'koko-eating-bananas', 'title': 'Koko Eating Bananas', 'number': '875', 'difficulty': 'Medium', 'url': 'https://leetcode.com/problems/koko-eating-bananas/', 'group': 'x'}}),
    ))
    page.get_by_role('button', name='Start an empty list').click()
    page.get_by_label('Problem name or LeetCode link').fill('https://leetcode.com/problems/koko-eating-bananas/')
    page.get_by_role('button', name='Add problem').click()
    expect(page.get_by_text('Added 875. Koko Eating Bananas.')).to_be_visible()
    r = row(page, 'Koko Eating Bananas')
    expect(r).to_contain_text('875.')
    expect(r).to_contain_text('Medium')


@test
def import_the_leetcode_link_from_the_study_group(page: Page):
    sign_in(page)
    page.get_by_label('LeetCode list link').fill('https://leetcode.com/explore/interview/card/top-interview-questions-easy/')
    page.get_by_role('button', name='Import list').click()
    expect(page.get_by_role('progressbar', name='Problems done').and_(page.locator('[aria-valuetext=\"0 of 48 done\"]'))).to_be_visible()
    expect(page.get_by_role('button', name='Array', exact=False).first).to_be_visible()
    page.get_by_label('Group by').select_option('difficulty')
    expect(page.locator('.dsa-group-head').first).to_contain_text('Easy')
    expect(page.locator('.dsa-group-head').nth(1)).to_contain_text('Medium')
    page.screenshot(path=str(SHOTS / 'by-difficulty.png'))
    # Importing again opens the same list instead of creating a duplicate.
    page.get_by_role('button', name='All lists').click()
    page.get_by_label('LeetCode list link').fill('leetcode.com/explore/interview/card/top-interview-questions-easy')
    page.get_by_role('button', name='Import list').click()
    page.get_by_role('button', name='All lists').click()
    expect(page.get_by_role('button', name='Open list')).to_have_count(1)


@test
def paste_links_to_create_a_list(page: Page):
    sign_in(page)
    page.get_by_label('List name').fill('Study group week 1')
    page.get_by_label('Paste problem links').fill(
        'Day 1: https://leetcode.com/problems/two-sum/\nDay 2: https://leetcode.com/problems/valid-anagram/ and again https://leetcode.com/problems/two-sum/'
    )
    page.on('dialog', lambda d: d.accept())
    page.get_by_role('button', name='Create list from links').click()
    expect(page.get_by_role('heading', name='Study group week 1').first).to_be_visible(timeout=60000)
    expect(page.get_by_test_id('problem-item')).to_have_count(2)
    expect(row(page, 'Two Sum')).to_be_visible()
    expect(row(page, 'Valid Anagram')).to_be_visible()


@test
def progress_is_shared_between_lists_for_the_same_problem(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    tick(page, 'Two Sum')
    wait_saved(page)
    page.get_by_role('button', name='All lists').click()
    start_sheet(page, 1)
    expect(row(page, 'Two Sum').get_by_role('checkbox', name='Done: Two Sum')).to_have_attribute('aria-checked', 'true')


@test
def removing_things_never_deletes_notes(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    r = open_row(page, 'Rotate Array')
    r.get_by_label('When I solved it').fill('Reverse all, then reverse both parts.')
    page.on('dialog', lambda d: d.accept())
    r.get_by_role('button', name='Remove from this list').click()
    expect(row(page, 'Rotate Array')).to_have_count(0)
    page.get_by_role('button', name='Bring them back').click()
    r = open_row(page, 'Rotate Array')
    expect(r.get_by_label('When I solved it')).to_have_value('Reverse all, then reverse both parts.')

    page.get_by_role('button', name='All lists').click()
    page.get_by_role('button', name='Remove').first.click()
    expect(page.get_by_role('heading', name='Removed lists')).to_be_visible()
    page.get_by_role('button', name='Bring back').click()
    page.get_by_role('button', name='Open list').click()
    r = open_row(page, 'Rotate Array')
    expect(r.get_by_label('When I solved it')).to_have_value('Reverse all, then reverse both parts.')
    wait_saved(page)
    lists = [v for k, v in server_docs(page).items() if '/dsaLists/' in k]
    assert lists[0]['archived'] is False


@test
def filters_find_weak_list_and_due_revisions(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    open_row(page, 'Single Number').get_by_role('button', name='Add to weak list').click()
    tick(page, 'Move Zeroes')
    wait_saved(page)
    # Make Move Zeroes look like it was solved three days ago.
    page.evaluate(
        """() => { const k = 'manageme:e2e:server:v1'; const all = JSON.parse(localStorage.getItem(k));
        const d = all['users/test-user/dsaProgress/move-zeroes']; d.completedAt = Date.now() - 3*86400000; d.clientUpdatedAt = Date.now();
        localStorage.setItem(k, JSON.stringify(all)); }"""
    )
    page.reload()
    page.get_by_role('button', name='Weak list (1)').click()
    expect(page.get_by_test_id('problem-item')).to_have_count(1)
    expect(row(page, 'Single Number')).to_be_visible()
    page.get_by_role('button', name='Due (1)').click()
    expect(page.get_by_test_id('problem-item')).to_have_count(1)
    expect(row(page, 'Move Zeroes')).to_contain_text('Due')
    page.get_by_role('button', name='All', exact=True).click()
    page.get_by_label('Search problems and notes').fill('anagram')
    expect(page.get_by_test_id('problem-item')).to_have_count(1)


@test
def earlier_versions_can_be_restored_after_deleting_code(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    r = open_row(page, 'Climbing Stairs')
    long_code = 'def climb(n):\n' + ''.join(f'# step {i} explained in detail\n' for i in range(12)) + 'return n'
    type_code(page, r, long_code)
    wait_saved(page)
    r.locator('.cm-content').click()
    page.keyboard.press('Control+a')
    page.keyboard.press('Delete')
    page.get_by_label('Search problems and notes').click()  # blur → save
    wait_saved(page)
    assert server_doc(page, 'dsaProgress', 'climbing-stairs')['code'] == ''
    r.get_by_role('button', name='Earlier versions').click()
    dialog = page.get_by_role('dialog')
    expect(dialog.get_by_text('Saved before a large deletion')).to_be_visible()
    dialog.get_by_role('button', name='Restore this version').first.click()
    wait_saved(page)
    assert 'step 11 explained' in server_doc(page, 'dsaProgress', 'climbing-stairs')['code']
    expect(r.locator('.cm-content')).to_contain_text('step 11 explained')


@test
def backup_download_and_restore(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    r = open_row(page, 'Fizz Buzz')
    r.get_by_label('When I solved it').fill('Check 15 first.')
    wait_saved(page)
    page.get_by_role('button', name='All lists').click()
    with page.expect_download() as info:
        page.get_by_role('button', name='Download backup').click()
    path = info.value.path()
    backup = json.loads(Path(path).read_text())
    assert backup['format'] == 'manageme-dsa-backup'
    assert backup['dsaProgress']['fizz-buzz']['completedNote'] == 'Check 15 first.'

    # Lose the note (e.g. edited on another device by mistake), then restore from the file.
    page.get_by_role('button', name='Open list').click()
    r = open_row(page, 'Fizz Buzz')
    r.get_by_label('When I solved it').fill('')
    wait_saved(page)
    page.get_by_role('button', name='All lists').click()
    page.get_by_label('Choose a backup file').set_input_files(path)
    expect(page.get_by_text('Restoring will add or update', exact=False)).to_be_visible()
    page.get_by_role('button', name='Restore', exact=True).click()
    wait_saved(page)
    assert server_doc(page, 'dsaProgress', 'fizz-buzz')['completedNote'] == 'Check 15 first.'

    page.get_by_label('Choose a backup file').set_input_files(files=[{'name': 'x.json', 'mimeType': 'application/json', 'buffer': b'{"hello":1}'}])
    expect(page.get_by_text('not a ManageMe DSA backup')).to_be_visible()


@test
def two_tabs_editing_different_fields_do_not_overwrite_each_other(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    wait_saved(page)
    url = page.url
    other = page.context.new_page()
    other.goto(url)
    expect(other.get_by_role('progressbar', name='Problems done').and_(other.locator('[aria-valuetext=\"0 of 48 done\"]'))).to_be_visible()
    a = open_row(page, 'Valid Sudoku')
    b = open_row(other, 'Valid Sudoku')
    a.get_by_label('When I solved it').fill('Three sets: rows, cols, boxes.')
    b.get_by_label('Mistake to remember').fill('Box index = (r//3)*3 + c//3')
    wait_saved(page)
    wait_saved(other)
    saved = server_doc(page, 'dsaProgress', 'valid-sudoku')
    assert saved['completedNote'] == 'Three sets: rows, cols, boxes.', saved
    assert saved['mistake'] == 'Box index = (r//3)*3 + c//3', saved
    other.close()


@test
def keyboard_only_use(page: Page):
    sign_in(page)
    start_sheet(page, 0)
    done = row(page, 'Two Sum').get_by_role('checkbox', name='Done: Two Sum')
    done.focus()
    page.keyboard.press('Space')
    expect(done).to_have_attribute('aria-checked', 'true')
    row(page, 'Two Sum').locator('.dsa-item-main').focus()
    page.keyboard.press('Enter')
    r = page.get_by_test_id('problem-detail')
    expect(r.get_by_test_id('code-editor')).to_be_visible()
    r.locator('.cm-content').focus()
    page.keyboard.type('x = 1')
    page.keyboard.press('Escape')
    page.keyboard.press('Tab')
    focused = page.evaluate('document.activeElement && document.activeElement.className')
    assert 'cm-content' not in (focused or ''), 'Focus is trapped in the editor'


@test
def accessibility_scan(page: Page):
    axe = (ROOT / 'node_modules' / 'axe-core' / 'axe.min.js').read_text()
    sign_in(page)
    issues = []

    def scan(label):
        page.add_script_tag(content=axe)
        result = page.evaluate("""async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa','best-practice'] });
            return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].html.slice(0, 160) })); }""")
        for v in result:
            issues.append((label, v))

    scan('home')
    start_sheet(page, 1)
    open_row(page, 'Majority Element-I')
    scan('list with open problem')
    serious = [i for i in issues if i[1]['impact'] in ('serious', 'critical')]
    for i in issues:
        print('   axe:', i)
    assert not serious, serious


@test
def phone_layout(page: Page):
    page.set_viewport_size({'width': 390, 'height': 844})
    sign_in(page)
    start_sheet(page, 1)
    page.screenshot(path=str(SHOTS / 'phone-list.png'))
    open_row(page, 'Majority Element-I')
    # On a phone the list and the problem are separate screens.
    expect(page.get_by_role('navigation', name='Problem list')).to_be_hidden()
    expect(page.get_by_role('button', name='All problems')).to_be_visible()
    overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
    page.screenshot(path=str(SHOTS / 'phone.png'))
    assert not overflow
    page.get_by_role('button', name='All problems').click()
    expect(page.get_by_role('navigation', name='Problem list')).to_be_visible(), 'Page scrolls sideways on a phone'


@test
def workspace_links_to_dsa_and_back(page: Page):
    page.goto(f'{BASE}/')
    page.get_by_role('link', name='Track DSA practice').first.click()
    expect(page).to_have_url(f'{BASE}/#/dsa')
    sign_in(page)
    page.get_by_role('link', name='Full workspace').click()
    expect(page).to_have_url(f'{BASE}/#/')
    # A DSA-only person who comes back to the bare address lands on DSA.
    page.evaluate("localStorage.setItem('manageme:start', 'dsa')")
    page.goto(f'{BASE}/')
    expect(page).to_have_url(f'{BASE}/#/dsa')


# ----------------------------------------------------------------------------- runner

def ensure_server():
    try:
        urllib.request.urlopen(BASE, timeout=2)
        return None
    except Exception:
        env = {**os.environ, 'VITE_E2E': '1'}
        proc = subprocess.Popen(['npx', 'vite', '--port', '5173', '--strictPort'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE, timeout=2)
                return proc
            except Exception:
                time.sleep(0.5)
        proc.kill()
        sys.exit('Dev server did not start')


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    proc = ensure_server()
    only = sys.argv[1:]
    failures = 0
    try:
        with sync_playwright() as p:
            launch = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
            browser = p.chromium.launch(**launch)
            for fn in TESTS:
                if only and fn.__name__ not in only:
                    continue
                context = browser.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
                context.set_default_timeout(10000)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                started = time.time()
                try:
                    fn(page)
                    if errors:
                        raise AssertionError(f'Uncaught page errors: {errors}')
                    print(f'PASS {fn.__name__} ({time.time() - started:.1f}s)')
                except Exception:
                    failures += 1
                    print(f'FAIL {fn.__name__}')
                    traceback.print_exc()
                    page.screenshot(path=str(SHOTS / f'FAIL-{fn.__name__}.png'), full_page=True)
                finally:
                    context.close()
            browser.close()
    finally:
        if proc:
            proc.kill()
    print(f'\n{len(TESTS) - failures if not only else len(only) - failures} passed, {failures} failed')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
