import React, { useState, useEffect, useMemo } from "react";

/**
 * CivicSource – Clay-style Frontend (single-file React)
 * ----------------------------------------------------
 * Visual language inspired by clay.earth:
 *  - Huge elegant type, airy spacing, soft gradients/blobs
 *  - Minimal chrome, high-contrast text, subtle motion
 *  - Cards with rounded-2xl, soft shadows, gentle borders
 *  - A calm neutral palette with accent gradients
 *
 * Notes
 *  - Tailwind utility classes are assumed to be available in this environment.
 *  - Replace API_BASE with your Flask host if different.
 */

const API_BASE = "http://127.0.0.1:5000";


const cn = (...xs) => xs.filter(Boolean).join(" ");

const currency = (n) => {
  try { return n?.toLocaleString?.("en-US", { style: "currency", currency: "USD"}); } catch { return `$${n}`; }
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function computeMatchScore(business, need) {
  // Lightweight, deterministic-ish score for demo purposes
  const base = 80;
  const rating = Math.min(20, (business?.rating || 4.5) * 3);
  const catBoost = (business?.categories || [])
    .join("|")
    .toLowerCase()
    .includes((need?.category || "").toLowerCase()) ? 5 : 0;
  const chainPenalty = business?.is_chain ? -8 : 0;
  const regBoost = business?.government_registered ? 4 : 0;
  return Math.max(50, Math.min(99, Math.round(base + rating + catBoost + chainPenalty + regBoost)));
}

// ——————————————————————————————————————————————————————————————————————————
// Shared UI Bits
// ——————————————————————————————————————————————————————————————————————————

function BlobBG() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full blur-3xl opacity-30"
           style={{background: "radial-gradient(40% 40% at 50% 50%, #c9e4ff 0%, #f3f7ff 100%)"}} />
      <div className="absolute -bottom-32 -right-24 h-[36rem] w-[36rem] rounded-full blur-3xl opacity-30"
           style={{background: "radial-gradient(40% 40% at 50% 50%, #ffe8cc 0%, #fff7ed 100%)"}} />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[24rem] w-[24rem] rounded-full blur-3xl opacity-25"
           style={{background: "conic-gradient(from 180deg at 50% 50%, #e9d5ff, #cffafe, #fde68a, #e9d5ff)"}} />
    </div>
  );
}

function Card({ className, children }) {
  return (
    <div className={cn(
      "rounded-3xl border border-black/5 bg-white/70 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.05),0_10px_30px_-10px_rgba(0,0,0,0.15)]",
      "p-6 md:p-8",
      className
    )}>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-medium tracking-wide text-neutral-700">
      {children}
    </span>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-4xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-neutral-600">{label}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function SectionTitle({ kicker, title, desc }) {
  return (
    <div className="mb-8">
      {kicker && <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-3">{kicker}</div>}
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">{title}</h2>
      {desc && <p className="mt-4 text-neutral-600 max-w-2xl">{desc}</p>}
    </div>
  );
}

function ProgressBar({ value, max=100 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#111827,#4b5563)" }} />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// Landing / Slides Rail
// ——————————————————————————————————————————————————————————————————————————

function Slide({ heading, lines, footer }) {
  return (
    <Card>
      <div className="space-y-6">
        <h3 className="text-2xl md:text-4xl font-semibold leading-tight">{heading}</h3>
        <div className="space-y-2 text-neutral-700">
          {lines?.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        {footer}
      </div>
    </Card>
  );
}

function SlidesRail() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Slide
        heading="Smarter Procurement for a Stronger Memphis"
        lines={[
          "Every year, millions in city contracts leave local communities. CivicSource uses AI to connect Memphis government with small, local, and minority-owned businesses — keeping opportunity where it belongs: here at home.",
        ]}
      />
      <Slide
        heading="$41M leaves underserved communities every year"
        lines={[
          "Memphis is 64% Black, but Black-owned businesses get 12% of city contracts.",
          "Why? 6‑week procurement, low visibility, intimidating bidding, zero public accountability.",
          "We're fixing all of that with AI.",
        ]}
      />
      <Slide
        heading="One Platform, Three Connected Sides"
        lines={[
          "Government Portal → instant AI matching",
          "Business Portal → AI bid assistant",
          "Public Dashboard → real-time transparency",
        ]}
      />
      <Slide
        heading="Watch It Work — The Full Procurement Flow"
        lines={[
          "1) Government posts need",
          "2) AI matches vendors",
          "3) Business gets AI help",
          "4) Government sees full value",
          "5) Public dashboard updates",
        ]}
      />
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// Government Portal
// ——————————————————————————————————————————————————————————————————————————

function GovernmentPortal({ onNotifyVendors }) {
  const [form, setForm] = useState({
    department: "Memphis Parks Department",
    title: "Overton Park Landscaping",
    description: "Routine mowing, trimming, and beds refresh across 60 acres.",
    category: "Services",
    budget: 15000,
    location: "Memphis, TN",
    deadline: new Date(Date.now() + 1000*60*60*24*14).toISOString().slice(0,10),
  });
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const postAndFind = async () => {
    setPosting(true);
    try {
      const res = await fetch(`${API_BASE}/api/procurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, postedDate: new Date().toISOString() })
      });
      const data = await res.json();
      setPosted(data?.procurement);
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }

    // Fetch live matches from your Flask backend
setLoadingMatches(true);
try {
  const searchQuery = encodeURIComponent(form.title || form.category || "services");
  const res = await fetch(
    `${API_BASE}/api/search?query=${searchQuery}&location=${encodeURIComponent(form.location)}&radius=25&limit=12`
  );
  const data = await res.json();
  console.log("Live API returned:", data);

  const top = (data?.businesses || [])
    .slice(0, 6)
    .map((b) => ({ ...b, matchScore: computeMatchScore(b, form) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
  setMatches(top);
} catch (e) {
  console.error("Error fetching matches:", e);
} finally {
  await delay(800);
  setLoadingMatches(false);
}

  };

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Government Portal"
        title="Post a need. Get perfect local matches in seconds."
        desc="AI scans certifications, reviews, distance, and fit. You get the top three—no 200 random bids."
      />

      <Card>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <label className="col-span-2">
              <div className="text-sm text-neutral-600 mb-1">Department</div>
              <input value={form.department} onChange={(e)=>update('department', e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"/>
            </label>
            <label className="col-span-2">
              <div className="text-sm text-neutral-600 mb-1">Title</div>
              <input value={form.title} onChange={(e)=>update('title', e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"/>
            </label>
            <label>
              <div className="text-sm text-neutral-600 mb-1">Budget</div>
              <input type="number" value={form.budget} onChange={(e)=>update('budget', Number(e.target.value))} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"/>
            </label>
            <label>
              <div className="text-sm text-neutral-600 mb-1">Category</div>
              <select value={form.category} onChange={(e)=>update('category', e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <option>Services</option>
                <option>Construction</option>
                <option>Goods</option>
                <option>IT</option>
              </select>
            </label>
            <label className="col-span-2">
              <div className="text-sm text-neutral-600 mb-1">Description</div>
              <textarea rows={3} value={form.description} onChange={(e)=>update('description', e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"/>
            </label>
            <label>
              <div className="text-sm text-neutral-600 mb-1">Location</div>
              <input value={form.location} onChange={(e)=>update('location', e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"/>
            </label>
            <label>
              <div className="text-sm text-neutral-600 mb-1">Deadline</div>
              <input type="date" value={form.deadline} onChange={(e)=>update('deadline', e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2"/>
            </label>
          </div>
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <Pill>85% faster than legacy RFP flow</Pill>
              <Pill>MBE/WBE matches prioritized</Pill>
              <Pill>Transparency by default</Pill>
            </div>
            <button onClick={postAndFind} disabled={posting} className={cn("rounded-2xl px-5 py-3 text-white font-medium",
              posting ? "bg-neutral-400" : "bg-neutral-900 hover:bg-neutral-800")}> {posting ? "Posting…" : "Post & Find Vendors"}</button>
            {posted && (
              <div className="text-xs text-neutral-600">Posted as ID #{posted.id}. Switching to matches…</div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xl font-semibold">Top Matches</h4>
          {loadingMatches && <div className="text-sm text-neutral-500">Finding matches…</div>}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {matches.map((m, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-neutral-500">{m.address}</div>
                </div>
                <div className="text-sm font-semibold">{m.matchScore}%</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600">
                <div>⭐ {m.rating ?? "4.8"} · {m.reviews ?? 23} reviews</div>
                <div>{m.distance_miles ? `${m.distance_miles} mi` : "nearby"}</div>
                <div className="col-span-2">{m.government_registered ? "Registered vendor" : "Verified local"}</div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {m.government_registered && <Pill>MBE certified</Pill>}
                {!m.is_chain && <Pill>Local</Pill>}
              </div>
              <div className="mt-4 flex gap-2">
                <a href={m.website || m.google_maps_url || "#"} target="_blank" className="text-sm underline">Open profile</a>
                <button onClick={() => onNotifyVendors?.(m)} className="ml-auto text-sm rounded-xl px-3 py-2 bg-neutral-900 text-white">Notify</button>
              </div>
            </div>
          ))}
          {!loadingMatches && matches.length === 0 && (
            <div className="text-sm text-neutral-500">No matches yet. Post first, then we’ll fetch top vendors.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// Business Portal
// ——————————————————————————————————————————————————————————————————————————

function BusinessPortal({ notifications }) {
  const [selected, setSelected] = useState(null);
  const [aiReply, setAiReply] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const askAI = async (q) => {
    setAiLoading(true);
    setAiReply("");
    await delay(900);
    // Static guidance to mirror the pitch script
    setAiReply(
      "Similar Memphis landscaping contracts run $12–18K. Your costs + margin place you at $14,500—competitive and profitable. Your MBE certification yields a ~1.8× local economic multiplier; highlight local hires and supplier spend to strengthen the bid."
    );
    setAiLoading(false);
  };

  const submitBid = async () => {
    if (!selected) return;
    // Minimal POST to backend proposals
    try {
      const res = await fetch(`${API_BASE}/api/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procurementId: selected.id,
          businessInfo: { name: "GreenScape", email: "hello@greenscape.biz" },
          price: 14500,
          timeline: "3 weeks",
          description: "Weekly mowing, edging, mulch refresh, light tree trimming.",
          experience: "23 municipal projects completed; 4.9★ avg.",
          submittedDate: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (data?.success) {
        alert("Bid submitted! Switching back to Government view will show comparison.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Business Portal"
        title="Notifications, guidance, and one‑click bids."
        desc="Get matched to real opportunities, then use the AI copilot to price and position your bid."
      />

      <Card>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="text-sm text-neutral-600 mb-2">Notifications</div>
            <div className="space-y-2">
              {notifications.length === 0 && (
                <div className="text-sm text-neutral-500">No notifications yet—get notified from Government portal.</div>
              )}
              {notifications.map((n, i) => (
                <button key={i} onClick={() => setSelected(n)} className={cn(
                  "w-full text-left rounded-xl border p-3",
                  selected?.id === n.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                )}>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-neutral-500">Budget {currency(n.budget)} · {n.category}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {!selected ? (
              <div className="text-sm text-neutral-500">Select a notification to view details.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-semibold">{selected.title}</div>
                    <div className="text-sm text-neutral-600">{selected.department} · {selected.location}</div>
                  </div>
                  <Pill>98% match</Pill>
                </div>
                <p className="text-neutral-700">{selected.description}</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border border-neutral-200 p-3">Budget <div className="font-medium">{currency(selected.budget)}</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3">Deadline <div className="font-medium">{selected.deadline}</div></div>
                  <div className="rounded-xl border border-neutral-200 p-3">Category <div className="font-medium">{selected.category}</div></div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium">AI Help with Bid</div>
                    <button onClick={() => askAI("How should I price this?")} className="rounded-xl bg-neutral-900 text-white px-3 py-2 text-sm">Ask: How should I price this?</button>
                  </div>
                  <div className="text-sm text-neutral-700 min-h-[3lh]">
                    {aiLoading ? "Thinking…" : (aiReply || "Ask a question about pricing, scope, or positioning.")}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={submitBid} className="rounded-2xl bg-neutral-900 text-white px-5 py-3">Submit Bid</button>
                  <button className="rounded-2xl border border-neutral-300 px-5 py-3">Download PDF</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// Public Dashboard
// ——————————————————————————————————————————————————————————————————————————

function PublicDashboard() {
  const [kpis] = useState({ awarded: 2400000, share: 47, jobs: 150, multiplier: 1.8, goal: 60 });

  return (
    <div className="space-y-6">
      <SectionTitle
        kicker="Public Dashboard"
        title="Radically simple transparency. No login required."
        desc="Track progress toward equity, understand the Memphis Multiplier, and explore where dollars go."
      />

      <Card>
        <div className="grid md:grid-cols-4 gap-6">
          <Kpi label="Awarded YTD" value={currency(kpis.awarded)} />
          <Kpi label="MBE/WBE Share" value={`${kpis.share}%`} sub={`Goal ${kpis.goal}%`} />
          <Kpi label="Jobs Created" value={`${kpis.jobs}`} />
          <Kpi label="Memphis Multiplier" value={`${kpis.multiplier}×`} sub="Local spend ripple effect" />
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm text-neutral-600 mb-2">
            <span>Equity progress</span>
            <span>{kpis.share}% / {kpis.goal}% goal</span>
          </div>
          <ProgressBar value={kpis.share} max={kpis.goal} />
        </div>
      </Card>

      <Card>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h4 className="text-xl font-semibold mb-2">The Memphis Multiplier</h4>
            <p className="text-neutral-700">Every $1 to a local MBE/WBE firm yields ≈ {kpis.multiplier}× in local economic impact via payroll, supplier purchases, and neighborhood recirculation. Choosing local can create more total value than chasing the lowest out‑of‑state bid.</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="text-sm text-neutral-600 mb-2">Illustration</div>
            <ul className="text-sm text-neutral-800 space-y-1 list-disc pl-5">
              <li>$14,500 to GreenScape → $26,100 total impact</li>
              <li>3 local jobs supported</li>
              <li>Suppliers: soil, mulch, equipment from 2 Memphis vendors</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// Comparison View (Gov side after bids)
// ——————————————————————————————————————————————————————————————————————————

function ComparisonView({ procurement }) {
  const [bids, setBids] = useState([]);

  useEffect(() => {
    async function load() {
      if (!procurement?.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/procurements/${procurement.id}/proposals`);
        const data = await res.json();
        setBids(data?.proposals || []);
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, [procurement?.id]);

  const outOfState = { vendor: "Out‑of‑State Contractor", price: 12000, impact: 12000 * 1.05, jobs: 0 };
  const local = { vendor: "GreenScape (MBE)", price: 14500, impact: 14500 * 1.8, jobs: 3 };

  return (
    <Card>
      <h4 className="text-xl font-semibold mb-4">Value Comparison</h4>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="font-medium">{outOfState.vendor}</div>
          <div className="text-sm text-neutral-600">Price: {currency(outOfState.price)}</div>
          <div className="text-sm text-neutral-600">Local impact: {currency(outOfState.impact)}</div>
          <div className="text-sm text-neutral-600">Jobs: {outOfState.jobs}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="font-medium">{local.vendor}</div>
          <div className="text-sm text-neutral-600">Price: {currency(local.price)}</div>
          <div className="text-sm text-neutral-600">Local impact: {currency(local.impact)}</div>
          <div className="text-sm text-neutral-600">Jobs: {local.jobs}</div>
        </div>
      </div>
      <div className="mt-4">
        <button className="rounded-2xl bg-neutral-900 text-white px-5 py-3">Award to GreenScape</button>
      </div>
      <div className="mt-3 text-sm text-neutral-600">Paying ${currency(local.price - outOfState.price)} more yields ≈ {currency(local.impact - outOfState.impact)} additional value for Memphis.</div>

      <div className="mt-6">
        <div className="text-sm text-neutral-500 mb-2">Live proposals</div>
        <div className="space-y-2">
          {bids.map((b) => (
            <div key={b.id} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{b.businessInfo?.name}</div>
                  <div className="text-xs text-neutral-500">{b.timeline} · {b.experience}</div>
                </div>
                <div className="text-sm">{currency(b.price)}</div>
              </div>
            </div>
          ))}
          {bids.length === 0 && <div className="text-sm text-neutral-500">No bids yet. Submit from Business portal to populate.</div>}
        </div>
      </div>
    </Card>
  );
}

// ——————————————————————————————————————————————————————————————————————————
// App Shell
// ——————————————————————————————————————————————————————————————————————————

export default function CivicSourceApp() {
  const [tab, setTab] = useState("landing");
  const [notifs, setNotifs] = useState([]);
  const [lastPost, setLastPost] = useState(null);
    const [showChat, setShowChat] = useState(false);


  const handleNotify = (match) => {
    // Create a faux notification using last posted procurement meta
    setNotifs((ns) => [
      {
        id: Date.now(),
        title: lastPost?.title || "Overton Park Landscaping",
        department: lastPost?.department || "Memphis Parks Department",
        location: lastPost?.location || "Memphis, TN",
        budget: lastPost?.budget || 14500,
        category: lastPost?.category || "Services",
        description: lastPost?.description || "Routine mowing, trimming, and beds refresh across 60 acres.",
        deadline: lastPost?.deadline || new Date().toISOString().slice(0,10),
      },
      ...ns,
    ]);
    alert(`${match?.name || "Vendor"} notified! Switch to Business portal to continue.`);
    setTab("business");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(40%_60%_at_50%_0%,#ffffff,rgba(255,255,255,0.9))] text-neutral-900">
      <BlobBG />

      {/* Nav */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
<div className="text-lg font-semibold tracking-tight">CivicSource</div>

</div>

          <nav className="ml-auto flex items-center gap-2">
            {[
              ["Home", "landing"],
              ["Government", "government"],
              ["Business", "business"],
              ["Public Dashboard", "public"],
              ["Comparison", "compare"],
            ].map(([label, key]) => (
              <button key={key} onClick={() => setTab(key)} className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                tab === key ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"
              )}>{label}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10">
        <div className="grid md:grid-cols-2 gap-8 items-end">
          <div>
            <h1 className="text-5xl md:text-7xl leading-[0.95] tracking-tight font-semibold">
              Empowering Memphis Through Smarter Procurement
            </h1>
            <p className="mt-6 text-neutral-700 max-w-xl">
              Three‑sided platform: <span className="font-medium">Government</span> gets instant matches, <span className="font-medium">Businesses</span> get an AI bid copilot, and the <span className="font-medium">Public</span> gets a live transparency dashboard.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setTab("government")} className="rounded-2xl bg-neutral-900 text-white px-5 py-3">Sign In</button>
              <button onClick={() => setTab("landing")} className="rounded-2xl border border-neutral-300 px-5 py-3">Get Started</button>
            </div>
          </div>
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="text-sm text-neutral-500 mb-1">Impact Snapshot</div>
                <div className="text-3xl font-semibold">Keep $41M circulating locally</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="text-xs text-neutral-500">Speed</div>
                <div className="text-lg font-semibold">6 weeks → 1 week</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-4">
                <div className="text-xs text-neutral-500">Equity</div>
                <div className="text-lg font-semibold">12% → 47% Local</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-neutral-500 mb-2">Progress to goal (60%)</div>
                <ProgressBar value={47} max={60} />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 pb-20 space-y-12">
        {tab === "landing" && (
          <section>
            <SlidesRail />
          </section>
        )}

        {tab === "government" && (
          <section>
            <GovernmentPortal onNotifyVendors={(m) => { setLastPost((lp)=>lp||{ title: "Overton Park Landscaping", department: "Memphis Parks Department", location: "Memphis, TN", budget: 14500, deadline: new Date().toISOString().slice(0,10), category: "Services", description: "Routine mowing, trimming, and beds refresh across 60 acres."}); handleNotify(m); }} />
          </section>
        )}

        {tab === "business" && (
          <section>
            <BusinessPortal notifications={notifs} />
          </section>
        )}

        {tab === "public" && (
          <section>
            <PublicDashboard />
          </section>
        )}

        {tab === "compare" && (
          <section>
            <SectionTitle kicker="Government View" title="See full value, not just lowest price." desc="Make award decisions with economic impact, equity progress, and jobs created right next to price." />
            <ComparisonView procurement={lastPost ? { id: lastPost.id || 1 } : { id: 1 }} />
          </section>
        )}
      </main>
{/* Floating Civic Helper Widget */}
<div className="fixed bottom-6 right-6 z-50">
  <button
    onClick={() => setShowChat((s) => !s)}
    className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold px-5 py-3 rounded-full shadow-lg backdrop-blur-sm border border-white/20 transition-all duration-300"
  >
    💬 Civic Helper
  </button>

  {showChat && (
    <div className="mt-3 w-80 h-96 bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-4 flex flex-col">
      <div className="font-semibold text-gray-800 mb-2 flex justify-between items-center">
        <span>Civic Helper</span>
        <button
          onClick={() => setShowChat(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ✖
        </button>
      </div>

      <div
        id="chatBox"
        className="flex-grow overflow-y-auto border border-gray-200 rounded-lg p-2 text-sm text-gray-700 mb-2 space-y-2"
      ></div>

      <div id="thinking" className="hidden text-gray-500 text-sm mb-2">
        <span className="animate-dots">Civic Helper is thinking...</span>
      </div>

      <input
        id="chatInput"
        type="text"
        placeholder="Ask about civic rights, government, or legal topics..."
        className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
        onKeyDown={async (e) => {
          if (e.key === "Enter" && e.target.value.trim()) {
            const msg = e.target.value.trim();
            const chatBox = document.getElementById("chatBox");
            const thinking = document.getElementById("thinking");
            chatBox.innerHTML += `<p><b>You:</b> ${msg}</p>`;
            e.target.value = "";
            thinking.classList.remove("hidden");

            try {
              const res = await fetch("http://localhost:5000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
              });
              const data = await res.json();
              thinking.classList.add("hidden");

              // Typing animation + Markdown-style formatting
const aiText = data.reply;

// Convert basic Markdown formatting first
const formattedText = aiText
  .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")                 // Bold **text**
  .replace(/^- (.*$)/gm, "• $1")                          // Bullet list
  .replace(/\n/g, "<br>")                                 // Newlines
  .replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>'
  );

const aiParagraph = document.createElement("p");
aiParagraph.innerHTML = "<b>Civic Helper:</b> ";
chatBox.appendChild(aiParagraph);

let i = 0;
const typeInterval = setInterval(() => {
  aiParagraph.innerHTML = `<b>Civic Helper:</b> ${formattedText
    .slice(0, i)}<span class='animate-pulse'>|</span>`;
  chatBox.scrollTop = chatBox.scrollHeight;
  i++;
  if (i > formattedText.length) clearInterval(typeInterval);
}, 25);

            } catch (err) {
              console.error(err);
              thinking.classList.add("hidden");
              chatBox.innerHTML += `<p><b>Civic Helper:</b> Sorry, I couldn't fetch a reply.</p>`;
            }
          }
        }}
      />
    </div>
  )}
</div>



      {/* Footer */}
      <footer className="border-t border-black/5 py-10">
        <div className="mx-auto max-w-6xl px-4 text-sm text-neutral-500 flex flex-wrap items-center gap-3 justify-between">
          <div>© {new Date().getFullYear()} CivicSource</div>
          <div className="flex gap-3">
            <a className="underline" href="#">GitHub</a>
            <a className="underline" href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
