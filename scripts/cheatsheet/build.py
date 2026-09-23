import html, re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from content import SECTIONS, WIRES

CASES = {"Nominativ": "nom", "Akkusativ": "akk", "Dativ": "dat", "Genitiv": "gen"}

def md(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\((#[\w-]+)\)", r'<a href="\2">\1</a>', s)
    s = re.sub(r"\{(m|f|n|p|nom|akk|dat|gen):([^{}]+?)\}",
               lambda m: f'<span class="{"g" if len(m[1]) == 1 else "k"}-{m[1]}">{m[2]}</span>', s)
    s = re.sub(r"`([^`]+)`", r'<span class="de">\1</span>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\w)_([^_]+)_(?!\w)", r'<i class="en">\1</i>', s)
    return s.replace("\n", "<br>")

def plain_len(s):
    return len(re.sub(r"[`*_{}]|\b(m|f|n|p|nom|akk|dat|gen):", "", s))

def attr(c):
    return ' class="%s"' % ' '.join(c) if c else ''

def table(t):
    head = t["head"]
    gcols = []
    ths = []
    for h in head:
        m = re.match(r"^([mfnp]):(.*)$", h, re.S)
        g = m.group(1) if m else None
        txt = m.group(2) if m else h
        gcols.append(g)
        ths.append(("<th class=\"h-%s\">" % g if g else "<th>") + md(txt) + "</th>")
    out = []
    cls = "t full" if t["full"] else "t"
    out.append(f'<div class="{cls}">')
    if t["cap"]:
        out.append(f'<div class="cap">{md(t["cap"])}</div>')
    out.append('<div class="scroll"><table>')
    if any(h.strip() for h in head):
        out.append("<thead><tr>" + "".join(ths) + "</tr></thead>")
    out.append("<tbody>")
    for row in t["rows"]:
        cells = []
        for i, c in enumerate(row):
            classes = []
            if plain_len(c) > 44:
                classes.append("w")
            if i == 0 and t["rh"]:
                k = CASES.get(c)
                if k:
                    classes.append("c-" + k)
                cells.append('<th scope="row"%s>%s</th>' % (attr(classes), md(c)))
                continue
            if t["gc"] and i < len(gcols) and gcols[i]:
                classes.append("g-" + gcols[i])
            cells.append('<td%s>%s</td>' % (attr(classes), md(c)))
        out.append("<tr>" + "".join(cells) + "</tr>")
    out.append("</tbody></table></div></div>")
    return "".join(out)

def notes(n):
    rows = []
    for label, text in n["rows"]:
        hack = label.startswith("!")
        label = label.lstrip("!")
        rows.append('<tr%s><th scope="row">%s</th><td>%s</td></tr>' % (' class="hack"' if hack else '', md(label), md(text)))
    return ('<div class="t full"><div class="scroll"><table class="notes"><tbody>'
            + "".join(rows) + "</tbody></table></div></div>")

toc, body = [], []
n = 0
for sid, stitle, blocks in SECTIONS:
    toc.append(f'<div class="toc-sec">{md(stitle)}</div>')
    body.append(f'<h2 class="sec" id="{sid}">{md(stitle)}</h2>')
    for b in blocks:
        n += 1
        toc.append(f'<a href="#{b["id"]}" data-for="{b["id"]}"><span class="no">{n}</span>'
                   f'<span class="tt">{md(b["title"])}</span><span class="tick" aria-hidden="true">✓</span></a>')
        items = "".join(table(i) if i["k"] == "t" else notes(i) for i in b["items"])
        body.append(
            f'<section class="blk" id="{b["id"]}" data-lvl="{b["lvl"]}">'
            f'<header class="bh"><span class="no">{n}</span><h3>{md(b["title"])}</h3>'
            f'<span class="lvl {b["lvl"]}">{b["lvl"]}</span><span class="tags">{md(b["tags"])}</span>'
            f'<button class="done" type="button" aria-pressed="false" title="Als gelernt markieren">sitzt</button></header>'
            f'<div class="tbls">{items}</div></section>')

# Stolperfallen
n += 1
toc.append('<div class="toc-sec">Stolperfallen</div>')
toc.append(f'<a href="#ref-wires" data-for="ref-wires"><span class="no">{n}</span><span class="tt">Stolperfallen</span><span class="tick" aria-hidden="true">✓</span></a>')
wrows = "".join(
    f'<tr data-lvl="{l}"><td><span class="lvl {l}">{l}</span></td><td class="bad">{md(b)}</td>'
    f'<td class="good">{md(g)}</td><td class="w">{md(e)}</td></tr>' for l, b, g, e in WIRES)
body.append('<h2 class="sec" id="sec-wires">Stolperfallen</h2>')
body.append(
    f'<section class="blk" id="ref-wires" data-lvl="all"><header class="bh"><span class="no">{n}</span>'
    f'<h3>Stolperfallen</h3><span class="tags">{len(WIRES)} Fehler, die Punkte kosten</span>'
    f'<button class="done" type="button" aria-pressed="false" title="Als gelernt markieren">sitzt</button></header>'
    f'<div class="tbls"><div class="t full"><div class="scroll"><table class="wires"><thead><tr><th></th><th>✗ falsch</th><th>✓ richtig</th><th>warum</th></tr></thead>'
    f'<tbody>{wrows}</tbody></table></div></div></div></section>')

TOTAL = n
tpl = open(__file__.rsplit("/", 1)[0] + "/template.html").read()
out = (tpl.replace("%%TOC%%", "\n".join(toc))
          .replace("%%BODY%%", "\n".join(body))
          .replace("%%TOTAL%%", str(TOTAL)))
open(sys.argv[1], "w").write(out)
print("blocks", TOTAL, "bytes", len(out))
