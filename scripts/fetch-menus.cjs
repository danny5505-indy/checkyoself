// Reads the Noblesville Schools lunch menus and saves them to Supabase.
//
// It works like a parent clicking through the district website: it opens the
// "Menus & More" page, finds this month's and next month's lunch menus for each
// school level, opens each one, and reads the menu shown on the page.
//
// Run by GitHub Actions (.github/workflows/menus.yml). To run it yourself:
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/fetch-menus.cjs
// Days a parent fixed by hand in the app are never overwritten.

const { chromium } = require("playwright");

const DISTRICT_MENUS = "https://www.noblesvilleschools.org/departments/food-services/menus-more";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LEVELS = { Elementary: "elementary", "Middle School": "middle", "High School": "high" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  process.exit(1);
}

async function supabase(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Step 1: from the district page, the lunch menu links for this month and next.
async function findMenuLinks(page) {
  await page.goto(DISTRICT_MENUS, { waitUntil: "networkidle", timeout: 60000 });
  const picker = page.locator("#rootMenuPicker");
  await picker.getByText(/\w+ \d{4} Menus/).waitFor({ timeout: 30000 });

  const found = [];
  for (let step = 0; step < 2; step++) {
    const result = await picker.evaluate((root) => {
      const heading = root.innerText.match(/(\w+) (\d{4}) Menus/);
      const links = [];
      let level = null;
      for (const el of root.querySelectorAll("h3, a")) {
        if (el.tagName === "H3") level = el.textContent.trim();
        else if (/^Lunch/i.test(el.textContent.trim())) links.push({ level, href: el.href });
      }
      return { month: heading && heading[1], year: heading && Number(heading[2]), links };
    });
    for (const l of result.links) {
      if (LEVELS[l.level] && result.month) {
        found.push({ level: LEVELS[l.level], month: MONTHS.indexOf(result.month) + 1, year: result.year, href: l.href });
      }
    }
    if (step === 0) {
      const before = result.month;
      await picker.getByAltText("Next Month").click();
      await page.waitForFunction(
        (m) => !document.querySelector("#rootMenuPicker").innerText.includes(`${m} `),
        before,
        { timeout: 15000 },
      ).catch(() => {});
      // The heading changes before the links do; let the new month's links load.
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);
    }
  }
  return found;
}

// Step 2: open one menu and read each day's items.
async function readMenu(page, href) {
  await page.goto(href, { waitUntil: "networkidle", timeout: 60000 });
  // The menu viewer has a decorated layout and a plain one; the plain one is easier to read.
  if (page.url().includes("#/view?")) {
    await page.goto(page.url().replace("#/view?", "#/view-no-design?"), { waitUntil: "networkidle", timeout: 60000 });
  }
  await page.locator("ul.daySortable").first().waitFor({ timeout: 30000 });
  return page.evaluate(() => {
    const days = [];
    for (const ul of document.querySelectorAll("ul.daySortable")) {
      let cell = ul.parentElement;
      let header = null;
      for (let i = 0; i < 6 && cell; i++) {
        const m = cell.innerText.trim().match(/^(\d{1,2})\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
        if (m) { header = m; break; }
        cell = cell.parentElement;
      }
      if (!header) continue;
      const groups = [[]];
      for (const a of ul.querySelectorAll("a.menuItem")) {
        const t = a.innerText.replace(/\s+/g, " ").trim();
        if (!t) { if (groups[groups.length - 1].length) groups.push([]); continue; }
        const g = groups[groups.length - 1];
        // "w/ Garlic Knot", "& Croutons", "or Cheeseburger", "over Rice" continue the line above.
        if (g.length && /^(w\/|&|or\b|with\b|over\b)/i.test(t)) g[g.length - 1] += " " + t;
        else g.push(t);
      }
      days.push({ day: Number(header[1]), weekday: header[2].slice(0, 3).toLowerCase(), groups: groups.filter((g) => g.length) });
    }
    return days;
  });
}

const pad = (n) => String(n).padStart(2, "0");
const NOTE = /no (school|students)|break|holiday|professional development|e-?learning|teacher work day/i;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });
  let saved = 0;
  try {
    const links = await findMenuLinks(page);
    console.log(`Found ${links.length} lunch menus:`, links.map((l) => `${l.level} ${l.year}-${pad(l.month)}`).join(", "));

    for (const link of links) {
      let days;
      try {
        days = await readMenu(page, link.href);
      } catch (e) {
        console.warn(`Couldn't read ${link.level} ${link.year}-${pad(link.month)}: ${e.message}`);
        continue;
      }
      const last = new Date(Date.UTC(link.year, link.month, 0)).getUTCDate();
      // Safety check: each day's weekday on the page must match the real calendar.
      // If not, this is the wrong month's menu (e.g. next month isn't posted yet).
      const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const mismatched = days.filter(
        (d) => d.day >= 1 && d.day <= last && WD[new Date(Date.UTC(link.year, link.month - 1, d.day)).getUTCDay()] !== d.weekday,
      );
      if (mismatched.length) {
        console.warn(`Skipping ${link.level} ${link.year}-${pad(link.month)}: the days don't match that month's calendar.`);
        continue;
      }
      const rows = days
        .filter((d) => d.day >= 1 && d.day <= last)
        .map((d) => {
          const single = d.groups.length === 1 && d.groups[0].length === 1 ? d.groups[0][0] : null;
          const isNote = single && NOTE.test(single);
          return {
            level: link.level,
            meal: "lunch",
            day: `${link.year}-${pad(link.month)}-${pad(d.day)}`,
            groups: isNote ? [] : d.groups,
            note: isNote ? single : null,
            source: "auto",
            updated_at: new Date().toISOString(),
          };
        });
      if (!rows.length) continue;

      // Never overwrite a parent's manual fix.
      const manual = await supabase(
        `school_menus?select=day&source=eq.manual&level=eq.${link.level}&meal=eq.lunch&day=gte.${rows[0].day}&day=lte.${rows[rows.length - 1].day}`,
      );
      const skip = new Set(manual.map((m) => m.day));
      const toSave = rows.filter((r) => !skip.has(r.day));
      if (toSave.length) {
        await supabase("school_menus?on_conflict=level,meal,day", {
          method: "POST",
          body: toSave,
          prefer: "resolution=merge-duplicates,return=minimal",
        });
      }
      saved += toSave.length;
      console.log(`${link.level} ${link.year}-${pad(link.month)}: saved ${toSave.length} days${skip.size ? `, kept ${skip.size} manual` : ""}`);
    }
  } finally {
    await browser.close();
  }
  if (!saved) {
    console.error("No menu days were saved. The district website may have changed.");
    process.exit(1);
  }
  console.log(`Done: ${saved} days saved.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
