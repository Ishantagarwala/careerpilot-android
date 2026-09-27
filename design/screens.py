#!/usr/bin/env python3
"""
CareerPilot Android — mockup screen definitions.

Each screen is authored here as HTML against android-shared.css, which carries
the real tokens from the web app's app/globals.css. build.py renders them to PNG.

Design bible (locked — every screen must obey):
  platform      Android-native premium (Material structure, punch-hole, gesture bar)
  language A    .brand  cream #f4f6e8 / lime #baf600 / 2px black borders / hard shadow
  language B    .hub    near-white #f7f8fa / near-black actions, lime only as accent
  type          Anybody (headings) · Hanken Grotesk (body) · Space Grotesk (labels)
  rhythm        4/8dp scale, generous section spacing (SPACING_GENEROSITY 9)
  radius        brand 8px hard-edged · hub 14px cards / 22px composer
  icons         drawn in CSS, never emoji, consistent 2px stroke
  mockup        identical Android frame, even canvas padding, content is hero
  nav           4 bottom tabs: Hub · Career · Build · Me  (Material max is 5)
"""

# --------------------------------------------------------------------------
# shared chrome
# --------------------------------------------------------------------------

STATUS = """<div class="statusbar">
  <span>9:41</span>
  <div class="punch"></div>
  <span class="icons">
    <span class="sig"><i></i><i></i><i></i><i></i></span>
    <span class="batt"></span>
  </span>
</div>"""

GESTURE = '<div class="gesture"><i></i></div>'


def navbar(active, brand=False):
    tabs = [("hub", "Hub", "n-hub"), ("career", "Career", "n-career"),
            ("build", "Build", "n-build"), ("me", "Me", "n-me")]
    out = []
    for key, label, glyph in tabs:
        on = " on" if key == active else ""
        pill = '<span class="pill"></span>' if key == active else ""
        out.append(
            f'<div class="tab{on}"><span class="ic">{pill}'
            f'<span class="{glyph}"></span></span><span>{label}</span></div>'
        )
    cls = "navbar brand" if brand else "navbar"
    return f'<div class="{cls}">{"".join(out)}</div>'


def device(inner, brand=False, caption=None, sub=None):
    cap = ""
    if caption:
        cap = f'<div class="caption"><b>{caption}</b>'
        cap += f"<span>{sub}</span>" if sub else ""
        cap += "</div>"
    cls = "screen brand" if brand else "screen"
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="android-shared.css"></head><body>
<div class="shot"><div class="device"><div class="{cls}">{inner}</div></div>{cap}</div>
</body></html>"""


# --------------------------------------------------------------------------
# 01 · Sign in  — language A. Register/redirect happens server-side, so the
#                 app talks to the same NextAuth credentials endpoint.
# --------------------------------------------------------------------------
SIGN_IN = device(f"""
{STATUS}
<div class="brand-top">
  <div class="wordmark"><span class="dot"></span><span>CareerPilot</span></div>
  <div class="brand-title">Get to your<br><em>career goal</em><br>faster.</div>
  <div class="brand-lede">Your study hub, roadmap and resume — one calm place to
    work from.</div>
</div>
<div class="content" style="padding:0 24px">
  <div class="field">
    <label>Email</label>
    <div class="input focus">ishant@careerpilot.cc</div>
  </div>
  <div class="field">
    <label>Password</label>
    <div class="input"><span style="letter-spacing:.28em">••••••••••</span>
      <span class="pw-toggle" style="margin-left:auto">Show</span></div>
  </div>
  <div class="captcha">
    <span class="box"></span>
    <span class="txt">I'm not a robot<small>hCaptcha · bot protection</small></span>
    <span class="logo">hCaptcha</span>
  </div>
  <div class="legal"><span class="lock"></span>
    <span>Signed in from a residential connection only. VPNs are refused by the
      server.</span></div>
</div>
<div style="padding:18px 24px 0">
  <div class="btn btn-primary">Sign in</div>
  <div style="height:12px"></div>
  <div class="btn btn-ghost">Create an account</div>
</div>
{GESTURE}
""", brand=True, caption="Sign in", sub="Credentials + hCaptcha, same NextAuth endpoint")

# --------------------------------------------------------------------------
# 02 · AI Hub — answering a concept, grounded on an uploaded PDF.
#      Deliberately restrained: black action, lime only in the reply mark,
#      the bullet dots and the streaming state.
# --------------------------------------------------------------------------
HUB_CHAT = device(f"""
{STATUS}
<div class="appbar">
  <div class="iconbtn"><span class="g g-menu"></span></div>
  <div style="min-width:0">
    <h1 style="font-size:19px">Normalization</h1>
    <div class="sub" style="font-size:12px">DBMS · Unit 3</div>
  </div>
  <div class="spacer"></div>
  <div class="modelpill"><span class="live"></span>DeepSeek V4 Flash</div>
</div>
<div class="content">
  <div class="thread">
    <div class="bubble-user">Explain 2NF vs 3NF with an example from my notes</div>
    <div class="reply">
      <div class="who"><span class="mark"></span><span class="nm">CareerPilot</span></div>
      <p>Both remove redundancy, but they attack different dependencies. A table
        is in <code>2NF</code> when every non-key column depends on the
        <em>whole</em> primary key; it is in <code>3NF</code> when no non-key
        column depends on another non-key column.</p>
      <h3>From your notes</h3>
      <ul>
        <li><b>2NF</b> — <code>(StudentID, CourseID) → Grade</code>. Grade needs
          both keys, so this is fine. But <code>CourseName</code> needs only
          <code>CourseID</code>: split it out.</li>
        <li><b>3NF</b> — after that split, if <code>CourseID → DeptID</code> and
          <code>DeptID → DeptName</code>, then <code>DeptName</code> is
          transitively dependent. Move it to a <code>Department</code> table.</li>
      </ul>
      <div class="sourcecard">
        <span class="pdf"></span>
        <span class="m"><b>DBMS-Unit3-Normalization.pdf</b>
          <small>page 14 · grounded on 3 chunks</small></span>
      </div>
      <div class="thinking"><i></i><i></i><i></i><span>writing summary…</span></div>
    </div>
  </div>
</div>
<div class="composer">
  <div class="shell">
    <div class="ph">Ask about your notes…</div>
    <div class="bar">
      <span class="chipbtn"><span class="g g-plus" style="transform:scale(.72)"></span>Attach</span>
      <span class="chipbtn">Study plan</span>
      <span class="sendbtn"><span class="g g-send"></span></span>
    </div>
  </div>
</div>
{navbar("hub")}
{GESTURE}
""", caption="AI Hub", sub="Streamed reply, grounded on an uploaded PDF, with citations")

# --------------------------------------------------------------------------
# 03 · Threads drawer — threads persist server-side (ai-hub/threads)
# --------------------------------------------------------------------------
HUB_THREADS = device(f"""
{STATUS}
<div style="flex:1;position:relative;overflow:hidden;background:var(--hub-bg)">
  <div class="appbar">
    <div class="iconbtn"><span class="g g-menu"></span></div>
    <div style="min-width:0"><h1 style="font-size:19px">Normalization</h1>
      <div class="sub" style="font-size:12px">DBMS · Unit 3</div></div>
    <div class="spacer"></div>
    <div class="modelpill"><span class="live"></span>V4 Flash</div>
  </div>
  <div class="content">
    <div class="greeting" style="font-size:22px">Threads</div>
  </div>
  <div class="scrim"></div>
  <div class="sheet">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="wordmark" style="padding:7px 11px;box-shadow:2px 2px 0 var(--border)">
        <span class="dot" style="width:9px;height:9px"></span>
        <span style="font-size:14px">CareerPilot</span></div>
      <div class="spacer"></div>
      <span class="tag">Demo</span>
    </div>
    <div class="searchbox"><span class="g-search"></span>Search threads</div>
    <div style="margin-top:20px" class="label">Pinned</div>
    <div style="margin-top:6px">
      <div class="rowline"><span class="av">N</span>
        <span class="m"><b>Normalization</b><small>DBMS · Unit 3 · 12 msgs</small></span></div>
      <div class="rowline"><span class="av">R</span>
        <span class="m"><b>React hooks</b><small>Frontend · 8 msgs</small></span></div>
    </div>
    <div style="margin-top:18px" class="label">Last 7 days</div>
    <div style="margin-top:6px">
      <div class="rowline"><span class="av">O</span>
        <span class="m"><b>OSI vs TCP/IP</b><small>Networks · yesterday</small></span>
        <span class="tail">2d</span></div>
      <div class="rowline"><span class="av">A</span>
        <span class="m"><b>Array vs linked list</b><small>DSA · yesterday</small></span>
        <span class="tail">3d</span></div>
      <div class="rowline"><span class="av">S</span>
        <span class="m"><b>SQL joins cheatsheet</b><small>DBMS · 4d</small></span>
        <span class="tail">4d</span></div>
      <div class="rowline"><span class="av">J</span>
        <span class="m"><b>Java OOP interview Qs</b><small>Placement · 6d</small></span>
        <span class="tail">6d</span></div>
    </div>
    <div style="margin-top:auto;padding:16px 0 24px">
      <div class="btn btn-primary" style="height:50px;box-shadow:none">
        <span class="g g-plus" style="transform:scale(.8)"></span>New thread</div>
    </div>
  </div>
</div>
{navbar("hub")}
{GESTURE}
""", caption="Threads", sub="Drawer over the hub — search, pinned, recency grouped")

# --------------------------------------------------------------------------
# 04 · Career — the pinned direction + today's next action.
#      This is the one product screen that keeps language A, because the
#      career flow is the brand's own voice.
# --------------------------------------------------------------------------
CAREER = device(f"""
{STATUS}
<div class="appbar">
  <div style="min-width:0"><h1>Career</h1></div>
  <div class="spacer"></div>
  <div class="iconbtn ghost-line"><span class="g g-mic"></span></div>
</div>
<div class="content scrollpad">
  <div style="border:2px solid var(--border);background:var(--card);border-radius:8px;
              box-shadow:4px 4px 0 var(--border);padding:18px">
    <div style="display:flex;align-items:center;gap:10px">
      <span class="tag dark" style="border-width:2px">Your direction</span>
      <span class="spacer"></span>
      <span style="font-family:var(--f-mono);font-size:11px;font-weight:600">CHANGED 6d AGO</span>
    </div>
    <div style="font-family:var(--f-head);font-weight:800;font-size:29px;
                letter-spacing:-.03em;line-height:1.05;margin-top:14px">
      Full Stack<br>Developer</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <span class="tag" style="border-color:var(--border);color:var(--foreground)">MERN</span>
      <span class="tag" style="border-color:var(--border);color:var(--foreground)">India · entry</span>
    </div>
    <div style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-family:var(--f-mono);font-size:11px;font-weight:600;
                     letter-spacing:.08em">ROADMAP</span>
        <span style="font-family:var(--f-head);font-weight:800;font-size:15px">38%</span>
      </div>
      <div class="track" style="margin-top:8px;height:9px;background:var(--muted);
           border:2px solid var(--border)"><i style="width:38%;border-radius:0"></i></div>
      <div style="font-size:12.5px;color:var(--muted-foreground);margin-top:8px">
        5 of 13 milestones complete</div>
    </div>
  </div>

  <div class="label" style="margin-top:24px">Today</div>
  <div style="border:2px solid var(--border);background:var(--primary);border-radius:8px;
              padding:16px;margin-top:8px;box-shadow:4px 4px 0 var(--border)">
    <div style="font-family:var(--f-head);font-weight:700;font-size:16.5px">
      Build a CRUD API with Express</div>
    <div style="font-size:13px;margin-top:5px;opacity:.78">
      Milestone 6 · ~90 min · then push to GitHub</div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <span class="btn" style="height:42px;font-size:14.5px;background:var(--card);
            padding:0 16px;box-shadow:3px 3px 0 var(--border)">Open in Hub</span>
      <span class="btn" style="height:42px;font-size:14.5px;background:transparent;
            border-style:dashed;padding:0 16px">Mark done</span>
    </div>
  </div>

  <div class="label" style="margin-top:24px">Recommended next</div>
  <div style="margin-top:8px">
    <div class="rowline" style="border-color:#cfd6b8">
      <span class="av" style="background:var(--card);border:2px solid var(--border);
            border-radius:8px">1</span>
      <span class="m"><b>Backend Engineer (Node)</b>
        <small>92% match · 4 missing skills</small></span>
      <span class="g g-chev" style="opacity:.5"></span>
    </div>
    <div class="rowline" style="border-color:#cfd6b8">
      <span class="av" style="background:var(--card);border:2px solid var(--border);
            border-radius:8px">2</span>
      <span class="m"><b>Full Stack (MERN)</b>
        <small>88% match · 6 missing skills</small></span>
      <span class="g g-chev" style="opacity:.5"></span>
    </div>
  </div>
</div>
{navbar("career", brand=True)}
{GESTURE}
""", brand=True, caption="Career", sub="Pinned direction, roadmap progress, today's milestone")

# --------------------------------------------------------------------------
# 05 · Roadmap — milestone spine, the app's progress backbone
# --------------------------------------------------------------------------
ROADMAP = device(f"""
{STATUS}
<div class="appbar">
  <div class="iconbtn"><span class="g g-back"></span></div>
  <div style="min-width:0"><h1 style="font-size:20px">Roadmap</h1>
    <div class="sub" style="font-size:12px">Full Stack Developer</div></div>
  <div class="spacer"></div>
  <span class="tag lime">38%</span>
</div>
<div class="content">
  <div class="segmented">
    <div class="on">All 13</div><div>Done 5</div><div>Left 8</div>
  </div>
  <div style="margin-top:22px">
    <div class="milestone done">
      <div class="rail"><span class="knob"></span><span class="line"></span></div>
      <div class="body"><b>HTML, CSS &amp; responsive layout</b>
        <div class="meta">DONE · 2 weeks</div>
        <p>Built 4 static pages, flexbox + grid, mobile-first.</p></div>
    </div>
    <div class="milestone done">
      <div class="rail"><span class="knob"></span><span class="line"></span></div>
      <div class="body"><b>JavaScript fundamentals</b>
        <div class="meta">DONE · 3 weeks</div>
        <p>Closures, async/await, array methods, fetch.</p></div>
    </div>
    <div class="milestone now">
      <div class="rail"><span class="knob"></span><span class="line"></span></div>
      <div class="body"><b>Node &amp; Express APIs</b>
        <div class="meta">IN PROGRESS · week 1 of 3</div>
        <p>REST routing, middleware, error handling, connecting Mongo.</p>
        <div style="display:flex;gap:8px;margin-top:12px">
          <span class="tag dark">3 tasks left</span>
          <span class="tag">Project: REST API</span>
        </div>
        <div style="margin-top:12px" class="track"><i style="width:34%"></i></div></div>
    </div>
    <div class="milestone">
      <div class="rail"><span class="knob"></span><span class="line"></span></div>
      <div class="body"><b>MongoDB &amp; Mongoose</b>
        <div class="meta">NEXT · 2 weeks</div>
        <p>Schemas, relations, aggregation basics.</p></div>
    </div>
    <div class="milestone">
      <div class="rail"><span class="knob"></span></div>
      <div class="body"><b>React &amp; state management</b>
        <div class="meta">LOCKED · 3 weeks</div></div>
    </div>
  </div>
</div>
{navbar("career")}
{GESTURE}
""", caption="Roadmap", sub="Milestone spine — completed, in-progress and locked states")

# --------------------------------------------------------------------------
# 06 · Build · Resume — ATS score is the screen's one focal number
# --------------------------------------------------------------------------
BUILD_RESUME = device(f"""
{STATUS}
<div class="appbar">
  <div style="min-width:0"><h1>Build</h1></div>
  <div class="spacer"></div>
  <div class="iconbtn ghost-line"><span class="g g-plus" style="transform:scale(.85)"></span></div>
</div>
<div class="content">
  <div class="segmented">
    <div class="on">Resume</div><div>Projects</div><div>Jobs</div>
  </div>

  <div class="card" style="margin-top:16px;display:flex;align-items:center;gap:18px">
    <div class="ring">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="57" fill="none" stroke="#eceef2" stroke-width="12"/>
        <circle cx="66" cy="66" r="57" fill="none" stroke="#baf600" stroke-width="12"
                stroke-linecap="round" stroke-dasharray="358"
                stroke-dashoffset="104" transform="rotate(-90 66 66)"/>
      </svg>
      <span class="val"><b>71</b><small>ATS score</small></span>
    </div>
    <div style="min-width:0">
      <div style="font-family:var(--f-head);font-weight:700;font-size:17px;
                  letter-spacing:-.01em">Fullstack_Resume_v4</div>
      <div style="font-size:13px;color:var(--hub-muted);margin-top:4px">
        Updated 2 days ago · 1 page</div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <span class="tag">3 keywords missing</span>
        <span class="tag">1 weak bullet</span>
      </div>
    </div>
  </div>

  <div class="label" style="margin-top:22px">Fix these to score higher</div>
  <div style="margin-top:8px">
    <div class="card tight" style="margin-bottom:8px;display:flex;gap:12px;
         align-items:flex-start">
      <span class="tag" style="background:#fdecec;border-color:#f6c9c9;
            color:#b91c1c;flex:0 0 auto">HIGH</span>
      <span style="font-size:14px;line-height:1.5">
        <b>Add “Docker” and “CI/CD”.</b><br>
        <span style="color:var(--hub-muted)">Present in 78% of the backend roles
          you match.</span></span>
    </div>
    <div class="card tight" style="margin-bottom:8px;display:flex;gap:12px;
         align-items:flex-start">
      <span class="tag" style="flex:0 0 auto">MED</span>
      <span style="font-size:14px;line-height:1.5">
        <b>Quantify the project bullet.</b><br>
        <span style="color:var(--hub-muted)">“Built an API” → add users or
          request volume.</span></span>
    </div>
  </div>

  <div class="label" style="margin-top:22px">Target a job description</div>
  <div class="card" style="margin-top:8px;display:flex;align-items:center;gap:12px">
    <span style="font-size:14px;color:var(--hub-muted);flex:1">
      Paste a JD to match against…</span>
    <span class="tag dark">Match</span>
  </div>
</div>
<div class="fab"><span class="g g-plus"></span></div>
{navbar("build")}
{GESTURE}
""", caption="Build · Resume", sub="ATS score as the focal metric, with ranked fixes")

# --------------------------------------------------------------------------
# 07 · Build · Jobs — application tracker states
# --------------------------------------------------------------------------
BUILD_JOBS = device(f"""
{STATUS}
<div class="appbar">
  <div style="min-width:0"><h1>Build</h1></div>
  <div class="spacer"></div>
  <div class="iconbtn ghost-line"><span class="g-search" style="color:var(--hub-text)"></span></div>
</div>
<div class="content">
  <div class="segmented">
    <div>Resume</div><div>Projects</div><div class="on">Jobs</div>
  </div>

  <div style="display:flex;gap:8px;margin-top:16px;overflow:hidden">
    <span class="tag dark">Applied 7</span>
    <span class="tag">Interview 2</span>
    <span class="tag">Offer 1</span>
  </div>

  <div class="label" style="margin-top:22px">Fresh matches</div>
  <div style="margin-top:8px">
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span class="av" style="width:42px;height:42px;border-radius:12px;
              background:var(--hub-soft);display:grid;place-items:center;
              font-family:var(--f-head);font-weight:800">Z</span>
        <span style="flex:1;min-width:0">
          <b style="font-size:15px;letter-spacing:-.01em">Backend Engineer — Node.js</b>
          <div style="font-size:12.5px;color:var(--hub-muted);margin-top:3px">
            Zoho · Chennai · ₹6–9 LPA</div>
        </span>
        <span class="tag lime">92%</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <span class="tag">Node</span><span class="tag">MongoDB</span>
        <span class="tag" style="border-style:dashed">Missing: Docker</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <span class="btn" style="height:40px;font-size:14px;background:var(--hub-strong);
              color:#fff;border-color:var(--hub-strong);flex:1">Apply</span>
        <span class="btn" style="height:40px;font-size:14px;padding:0 16px">Save</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span class="av" style="width:42px;height:42px;border-radius:12px;
              background:var(--hub-soft);display:grid;place-items:center;
              font-family:var(--f-head);font-weight:800">F</span>
        <span style="flex:1;min-width:0">
          <b style="font-size:15px;letter-spacing:-.01em">Full Stack Developer</b>
          <div style="font-size:12.5px;color:var(--hub-muted);margin-top:3px">
            Freshworks · Remote · ₹7–11 LPA</div>
        </span>
        <span class="tag">81%</span>
      </div>
    </div>
  </div>

  <div class="label" style="margin-top:22px">Your applications</div>
  <div class="card tight" style="margin-top:8px">
    <div class="rowline"><span class="av" style="width:34px;height:34px;flex:0 0 34px;
          border-radius:9px;font-size:13px">T</span>
      <span class="m"><b style="font-size:13.5px">TCS Digital</b>
        <small>Applied 4d ago</small></span>
      <span class="tag">Screening</span></div>
    <div class="rowline"><span class="av" style="width:34px;height:34px;flex:0 0 34px;
          border-radius:9px;font-size:13px">I</span>
      <span class="m"><b style="font-size:13.5px">Infosys Power Programmer</b>
        <small>Interview Tue, 11:00</small></span>
      <span class="tag lime">Interview</span></div>
  </div>
</div>
{navbar("build")}
{GESTURE}
""", caption="Build · Jobs", sub="Match score, missing-skill gap, application tracker")

# --------------------------------------------------------------------------
# 08 · Me — profile, study stats, and the account-security reality
# --------------------------------------------------------------------------
ME = device(f"""
{STATUS}
<div class="appbar">
  <div style="min-width:0"><h1>Me</h1></div>
  <div class="spacer"></div>
  <div class="iconbtn ghost-line"><span style="width:16px;height:16px;border:2px solid
       currentColor;border-radius:50%"></span></div>
</div>
<div class="content scrollpad">
  <div style="display:flex;align-items:center;gap:14px">
    <span style="width:62px;height:62px;border-radius:20px;background:var(--hub-strong);
          color:#fff;display:grid;place-items:center;font-family:var(--f-head);
          font-weight:800;font-size:24px;flex:0 0 62px">I</span>
    <span style="min-width:0">
      <b style="font-family:var(--f-head);font-size:20px;letter-spacing:-.02em;
         display:block">Ishant Agarwala</b>
      <span style="font-size:13px;color:var(--hub-muted)">ishant@careerpilot.cc</span>
      <div style="display:flex;gap:6px;margin-top:8px">
        <span class="tag tag lime">BCA · 3rd year</span>
        <span class="tag">Demo account</span>
      </div>
    </span>
  </div>

  <div style="display:flex;gap:10px;margin-top:22px">
    <div class="card tight" style="flex:1;text-align:center">
      <div style="font-family:var(--f-head);font-weight:800;font-size:24px;
                  letter-spacing:-.03em">18</div>
      <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:.08em;
                  color:var(--hub-muted);margin-top:3px">DAY STREAK</div>
    </div>
    <div class="card tight" style="flex:1;text-align:center">
      <div style="font-family:var(--f-head);font-weight:800;font-size:24px;
                  letter-spacing:-.03em">42</div>
      <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:.08em;
                  color:var(--hub-muted);margin-top:3px">THREADS</div>
    </div>
    <div class="card tight" style="flex:1;text-align:center">
      <div style="font-family:var(--f-head);font-weight:800;font-size:24px;
                  letter-spacing:-.03em">9</div>
      <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:.08em;
                  color:var(--hub-muted);margin-top:3px">DOCS</div>
    </div>
  </div>

  <div class="label" style="margin-top:24px">Appearance</div>
  <div class="card" style="margin-top:8px;padding:6px 16px">
    <div class="rowline" style="padding:14px 0">
      <span class="m"><b>Theme</b></span>
      <div class="segmented" style="width:172px">
        <div>Light</div><div class="on">Dark</div><div>Auto</div>
      </div>
    </div>
    <div class="rowline" style="padding:14px 0">
      <span class="m"><b>Voice replies</b><small>Sarvam TTS</small></span>
      <span class="tag lime">On</span>
    </div>
  </div>

  <div class="label" style="margin-top:24px">Account</div>
  <div class="card" style="margin-top:8px;padding:6px 16px">
    <div class="rowline" style="padding:14px 0"><span class="m"><b>Edit profile</b></span>
      <span class="g g-chev" style="opacity:.5"></span></div>
    <div class="rowline" style="padding:14px 0"><span class="m"><b>Remembered sign-in</b>
      <small>Biometric unlock is on</small></span>
      <span class="tag">Fingerprint</span></div>
    <div class="rowline" style="padding:14px 0"><span class="m"><b>Offline downloads</b>
      <small>3 documents · 12.4 MB</small></span>
      <span class="g g-chev" style="opacity:.5"></span></div>
  </div>

  <div class="banner" style="margin:22px 0 0">
    <span class="dot"></span>
    <span>Sign-in is restricted to residential IPs. Turn off VPN if login fails.</span>
  </div>

  <div class="btn" style="margin-top:16px;height:50px;font-size:15px;
       border-color:#f0c9c9;color:var(--hub-danger);background:#fffafa">
    Sign out</div>
</div>
{navbar("me")}
{GESTURE}
""", caption="Me", sub="Study stats, theme, biometric sign-in, security notice")

# --------------------------------------------------------------------------
# 09 · First run — permission explained in the app's own voice, and the
#      offline/refresh state that streaming apps must design for.
# --------------------------------------------------------------------------
ONBOARDING = device(f"""
{STATUS}
<div class="content" style="padding:0 24px;display:flex;flex-direction:column">
  <div style="margin-top:34px">
    <div class="wordmark"><span class="dot"></span><span>CareerPilot</span></div>
  </div>
  <div style="font-family:var(--f-head);font-weight:800;font-size:37px;
              letter-spacing:-.035em;line-height:1.04;margin-top:34px">
    Two things<br>before we<br><em style="font-style:normal;background:var(--primary);
    box-shadow:0 0 0 3px var(--primary);border-radius:3px">start.</em>
  </div>
  <div style="font-size:15px;line-height:1.6;color:var(--muted-foreground);
              margin-top:16px;max-width:31ch">
    Both are optional. The hub works without them — these just make it feel
    native.</div>

  <div style="margin-top:30px;display:flex;flex-direction:column;gap:14px">
    <div style="border:2px solid var(--border);background:var(--card);border-radius:8px;
                padding:16px;display:flex;gap:14px;box-shadow:3px 3px 0 var(--border)">
      <span style="width:44px;height:44px;border-radius:8px;background:var(--card);
            border:2px solid var(--border);display:grid;place-items:center;flex:0 0 44px">
        <span class="g g-mic" style="transform:scale(.86)"></span></span>
      <span style="flex:1">
        <b style="font-family:var(--f-head);font-size:16px">Microphone</b>
        <div style="font-size:13px;line-height:1.5;color:var(--muted-foreground);
                    margin-top:4px">
          Ask questions by voice and answer career assessment out loud.</div>
      </span>
    </div>
    <div style="border:2px solid var(--border);background:var(--card);border-radius:8px;
                padding:16px;display:flex;gap:14px;box-shadow:3px 3px 0 var(--border)">
      <span style="width:44px;height:44px;border-radius:8px;background:var(--card);
            border:2px solid var(--border);display:grid;place-items:center;flex:0 0 44px">
        <span style="width:13px;height:10px;border:2px solid currentColor;border-radius:2px;
              position:relative;display:block">
          <span style="position:absolute;left:2px;top:-6px;width:5px;height:6px;
                border:2px solid currentColor;border-bottom:0;border-radius:4px 4px 0 0;
                display:block"></span></span></span>
      <span style="flex:1">
        <b style="font-family:var(--f-head);font-size:16px">Biometric unlock</b>
        <div style="font-size:13px;line-height:1.5;color:var(--muted-foreground);
                    margin-top:4px">
          Stay signed in without retyping your password each session.</div>
      </span>
    </div>
  </div>

  <div style="margin-top:26px;border:2px dashed #b9bfa4;border-radius:8px;padding:15px 16px;
              display:flex;gap:13px;align-items:flex-start">
    <span style="width:36px;height:36px;flex:0 0 36px;border-radius:8px;background:var(--muted);
          display:grid;place-items:center">
      <span style="width:15px;height:12px;border:2px solid currentColor;border-radius:2px;
            position:relative;display:block;opacity:.75">
        <span style="position:absolute;left:4px;top:-7px;width:7px;height:9px;border:2px solid
              currentColor;border-bottom:0;border-radius:4px 4px 0 0;display:block"></span>
        <span style="position:absolute;left:5px;top:-3px;width:7px;height:2px;background:
              var(--background);display:block"></span></span></span>
    <span style="flex:1">
      <b style="font-family:var(--f-head);font-size:14.5px">Works offline</b>
      <div style="font-size:12.5px;line-height:1.5;color:var(--muted-foreground);
                  margin-top:3px">
        Threads and documents you open are cached on the device, so revision
        doesn't stop when the signal does.</div>
    </span>
  </div>

  <div style="margin-top:auto;padding-bottom:18px">
    <div class="btn btn-primary">Continue</div>
    <div style="text-align:center;font-size:13.5px;font-weight:600;margin-top:14px;
                color:var(--muted-foreground)">Not now</div>
  </div>
</div>
{GESTURE}
""", brand=True, caption="First run", sub="Permissions requested in-context, both refusable")

# --------------------------------------------------------------------------
# 10 · Dark hub + offline — the state that decides whether a streaming app
#      feels trustworthy. Language B, dark variant, straight from .dark .aihub
# --------------------------------------------------------------------------
OFFLINE = f"""
{STATUS}
<div class="appbar">
  <div class="iconbtn"><span class="g g-menu"></span></div>
  <div style="min-width:0"><h1 style="font-size:19px">Normalization</h1>
    <div class="sub" style="font-size:12px">DBMS · Unit 3</div></div>
  <div class="spacer"></div>
  <span class="tag" style="border-color:#3a3f4b;color:#9198a4">Cached</span>
</div>
<div class="banner" style="background:#2a2413;border-color:#4d4322;color:#e6d9a8">
  <span class="dot" style="background:#e0b13a"></span>
  <span>You're offline. This thread is read from your device.</span>
</div>
<div class="content">
  <div class="thread">
    <div class="bubble-user" style="background:#e6e8ee;color:#15171b">
      Explain 2NF vs 3NF with an example from my notes</div>
    <div class="reply">
      <div class="who"><span class="mark"></span><span class="nm">CareerPilot</span></div>
      <p style="color:#e6e8ee">Both remove redundancy, but they attack different
        dependencies. A table is in <code style="background:#1e2128;color:#e6e8ee">2NF</code>
        when every non-key column depends on the <em>whole</em> primary key.</p>
      <h3 style="color:#e6e8ee">From your notes</h3>
      <ul>
        <li style="color:#e6e8ee"><b>2NF</b> — <code style="background:#1e2128;
          color:#e6e8ee">(StudentID, CourseID) → Grade</code>.</li>
        <li style="color:#e6e8ee"><b>3NF</b> — move <code style="background:#1e2128;
          color:#e6e8ee">DeptName</code> to a Department table.</li>
      </ul>
      <div class="sourcecard" style="background:#16181d;border-color:#262a32">
        <span class="pdf" style="background:#1e2128;border-color:#262a32"></span>
        <span class="m"><b style="color:#e6e8ee">DBMS-Unit3-Normalization.pdf</b>
          <small style="color:#9198a4">saved offline · page 14</small></span>
      </div>
    </div>
  </div>

  <div class="label" style="margin-top:24px;color:#6b7280">Saved on this device</div>
  <div class="card tight" style="margin-top:8px;background:#16181d;border-color:#262a32;
       padding:4px 14px">
    <div class="rowline" style="border-color:#262a32">
      <span class="av" style="background:#1e2128;color:#e6e8ee;width:34px;height:34px;
            flex:0 0 34px;border-radius:9px;font-size:12px">OS</span>
      <span class="m"><b style="color:#e6e8ee;font-size:13.5px">OSI vs TCP/IP</b>
        <small style="color:#9198a4">2 days ago</small></span>
      <span class="tail" style="color:#6b7280">ready</span></div>
    <div class="rowline" style="border-color:#262a32">
      <span class="av" style="background:#1e2128;color:#e6e8ee;width:34px;height:34px;
            flex:0 0 34px;border-radius:9px;font-size:12px">SQ</span>
      <span class="m"><b style="color:#e6e8ee;font-size:13.5px">SQL joins cheatsheet</b>
        <small style="color:#9198a4">4 days ago</small></span>
      <span class="tail" style="color:#6b7280">ready</span></div>
  </div>
</div>
<div class="composer">
  <div class="shell" style="background:#16181d;border-color:#262a32;
       box-shadow:0 2px 12px #00000040">
    <div class="ph" style="color:#6b7280">Reconnect to ask a follow-up…</div>
    <div class="bar">
      <span class="chipbtn" style="border-color:#262a32;color:#6b7280">
        <span class="g g-plus" style="transform:scale(.72)"></span>Attach</span>
      <span class="chipbtn" style="border-color:#262a32;color:#6b7280">Study plan</span>
      <span class="sendbtn off" style="background:#1e2128;color:#4b5563">
        <span class="g g-send"></span></span>
    </div>
  </div>
</div>
{navbar("hub")}
{GESTURE}
"""

OFFLINE_SCREEN = device(
    OFFLINE.replace('<div class="screen', '<div class="screen')
    .replace('{STATUS}', STATUS),
    caption="Dark + offline",
    sub="Cached thread, disabled composer, honest reconnect state",
)
# dark variant: only the hub language has a dark theme (--hub tokens)
OFFLINE_SCREEN = OFFLINE_SCREEN.replace(
    '<div class="screen">',
    '<div class="screen" style="background:#0f1115;color:#e1e5cf">'
).replace(
    '<div class="statusbar">',
    '<div class="statusbar" style="color:#e1e5cf">'
).replace(
    '<div class="navbar">',
    '<div class="navbar" style="background:#16181d;border-color:#262a32">'
)


SCREENS = {
    "01-sign-in": SIGN_IN,
    "02-hub-chat": HUB_CHAT,
    "03-hub-threads": HUB_THREADS,
    "04-career": CAREER,
    "05-roadmap": ROADMAP,
    "06-build-resume": BUILD_RESUME,
    "07-build-jobs": BUILD_JOBS,
    "08-me": ME,
    "09-first-run": ONBOARDING,
    "10-dark-offline": OFFLINE_SCREEN,
}
