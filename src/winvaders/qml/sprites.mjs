import { ROSTER, BOSSES, POWERUPS } from "logic.mjs"

export const SPRITE_TYPES = [...Object.keys(ROSTER), ...BOSSES, ...POWERUPS]

const INK = "#05070a"
const WHITE = "#ffffff"

function hexToRgb(hex) {
    return [parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)]
}

export function tint(hex, menace) {
    const k = menace * 0.1
    const [r, g, b] = hexToRgb(hex)
    return `rgb(${Math.round(r + (230 - r) * k)},${Math.round(g * (1 - k))},${Math.round(b * (1 - k))})`
}

export function withAlpha(hex, a) {
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r},${g},${b},${a})`
}

function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

function oval(ctx, cx, cy, rx, ry, rot, a0, a1) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.scale(rx, ry)
    ctx.arc(0, 0, 1, a0, a1)
    ctx.restore()
}

function fillRR(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color
    rrect(ctx, x, y, w, h, r)
    ctx.fill()
}

function dot(ctx, x, y, r, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
}

function text(ctx, str, x, y, size, color, weight) {
    ctx.fillStyle = color
    ctx.font = `${weight || 800} ${Math.round(size)}px sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(str, x, y)
}

function line(ctx, pts, color, width) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1])
    ctx.stroke()
}

// Office-style icon: a pale "document" behind, a colored letter tile in front.
function officeIcon(ctx, x, y, w, h, color, letter, decorate) {
    fillRR(ctx, x + w * 0.3, y, w * 0.7, h, 3, color)
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    for (let i = 0; i < 3; i++) ctx.fillRect(x + w * 0.62, y + h * (0.22 + i * 0.22), w * 0.3, h * 0.08)
    if (decorate) decorate()
    fillRR(ctx, x, y + h * 0.18, w * 0.58, h * 0.64, 3, INK)
    fillRR(ctx, x + 1.5, y + h * 0.18 + 1.5, w * 0.58 - 3, h * 0.64 - 3, 2, color)
    text(ctx, letter, x + w * 0.29, y + h * 0.51, h * 0.48, WHITE)
}

const DRAW = {
    word(ctx, x, y, w, h, c) { officeIcon(ctx, x, y, w, h, c("#2b7cd3"), "W") },
    excel(ctx, x, y, w, h, c) {
        officeIcon(ctx, x, y, w, h, c("#21a366"), "X", () => {
            ctx.strokeStyle = "rgba(255,255,255,0.4)"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x + w * 0.78, y); ctx.lineTo(x + w * 0.78, y + h)
            ctx.stroke()
        })
    },
    powerpoint(ctx, x, y, w, h, c) {
        officeIcon(ctx, x, y, w, h, c("#d35230"), "P", () => {
            ctx.fillStyle = "rgba(255,255,255,0.45)"
            ctx.beginPath()
            ctx.moveTo(x + w * 0.77, y + h * 0.5)
            ctx.arc(x + w * 0.77, y + h * 0.5, h * 0.3, -Math.PI / 2, Math.PI * 0.4)
            ctx.closePath()
            ctx.fill()
        })
    },
    onenote(ctx, x, y, w, h, c) { officeIcon(ctx, x, y, w, h, c("#7719aa"), "N") },
    access(ctx, x, y, w, h, c) { officeIcon(ctx, x, y, w, h, c("#a4373a"), "A") },
    publisher(ctx, x, y, w, h, c) { officeIcon(ctx, x, y, w, h, c("#077568"), "P") },
    notepad(ctx, x, y, w, h, c) {
        fillRR(ctx, x + w * 0.15, y, w * 0.7, h, 2, "#f2f2f2")
        ctx.fillStyle = c("#3a96dd")
        ctx.fillRect(x + w * 0.15, y, w * 0.7, h * 0.2)
        ctx.fillStyle = "#8aa"
        for (let i = 0; i < 4; i++) ctx.fillRect(x + w * 0.22, y + h * (0.32 + i * 0.16), w * 0.56, 1.5)
        for (let i = 0; i < 4; i++) dot(ctx, x + w * (0.25 + i * 0.17), y + h * 0.1, 1.8, INK)
    },
    paint(ctx, x, y, w, h, c) {
        ctx.fillStyle = c("#f4c26b")
        ctx.beginPath()
        ctx.arc(x + w / 2, y + h / 2, h * 0.48, 0, Math.PI * 2)
        ctx.fill()
        dot(ctx, x + w * 0.62, y + h * 0.66, h * 0.11, INK)
        const blobs = [["#e81123", 0.33, 0.3], ["#0078d4", 0.53, 0.26], ["#16c60c", 0.3, 0.55], ["#8e44ad", 0.72, 0.42]]
        for (const [b, bx, by] of blobs) dot(ctx, x + w * bx, y + h * by, h * 0.09, c(b))
    },
    outlook(ctx, x, y, w, h, c) {
        const col = c("#0f6cbd")
        fillRR(ctx, x + w * 0.3, y + h * 0.15, w * 0.7, h * 0.7, 2, "#3b9ef5")
        line(ctx, [x + w * 0.3, y + h * 0.15, x + w * 0.65, y + h * 0.5, x + w, y + h * 0.15], WHITE, 1.5)
        fillRR(ctx, x, y + h * 0.1, w * 0.55, h * 0.8, 3, col)
        ctx.strokeStyle = WHITE
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(x + w * 0.275, y + h * 0.5, h * 0.2, 0, Math.PI * 2)
        ctx.stroke()
    },
    teams(ctx, x, y, w, h, c) {
        const col = c("#5b5fc7")
        dot(ctx, x + w * 0.78, y + h * 0.22, h * 0.14, "#7b83eb")
        fillRR(ctx, x + w * 0.62, y + h * 0.4, w * 0.32, h * 0.45, 5, "#7b83eb")
        fillRR(ctx, x, y + h * 0.12, w * 0.62, h * 0.76, 3, col)
        text(ctx, "T", x + w * 0.31, y + h * 0.52, h * 0.5, WHITE)
    },
    skype(ctx, x, y, w, h, c) {
        const col = c("#00aff0")
        dot(ctx, x + w / 2, y + h / 2, h * 0.47, col)
        dot(ctx, x + w * 0.27, y + h * 0.27, h * 0.22, col)
        dot(ctx, x + w * 0.73, y + h * 0.73, h * 0.22, col)
        text(ctx, "S", x + w / 2, y + h * 0.53, h * 0.62, WHITE)
    },
    onedrive(ctx, x, y, w, h, c) {
        const col = c("#0364b8")
        dot(ctx, x + w * 0.32, y + h * 0.6, h * 0.28, col)
        dot(ctx, x + w * 0.55, y + h * 0.42, h * 0.36, c("#1490df"))
        dot(ctx, x + w * 0.78, y + h * 0.62, h * 0.26, c("#28a8ea"))
        fillRR(ctx, x + w * 0.1, y + h * 0.6, w * 0.82, h * 0.28, 6, c("#1490df"))
    },
    edge(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2, r = h * 0.48
        dot(ctx, cx, cy, r, c("#0c59a4"))
        ctx.fillStyle = c("#33c481")
        ctx.beginPath()
        ctx.arc(cx, cy, r, Math.PI * 0.95, Math.PI * 1.9)
        ctx.quadraticCurveTo(cx, cy - r * 0.1, cx - r * 0.95, cy + r * 0.2)
        ctx.closePath()
        ctx.fill()
        dot(ctx, cx + r * 0.15, cy + r * 0.2, r * 0.38, INK)
        dot(ctx, cx + r * 0.15, cy + r * 0.2, r * 0.25, c("#1fa0e8"))
    },
    ie(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2
        text(ctx, "e", cx, cy - 1, h * 1.05, c("#1ebbee"), 900)
        ctx.strokeStyle = c("#f9c21b")
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(cx - w * 0.48, cy + h * 0.15)
        ctx.quadraticCurveTo(cx - w * 0.2, cy - h * 0.6, cx + w * 0.48, cy - h * 0.42)
        ctx.stroke()
    },
    bing(ctx, x, y, w, h, c) {
        const col = c("#008373")
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.moveTo(x + w * 0.25, y)
        ctx.lineTo(x + w * 0.45, y + h * 0.08)
        ctx.lineTo(x + w * 0.45, y + h * 0.68)
        ctx.lineTo(x + w * 0.72, y + h * 0.52)
        ctx.lineTo(x + w * 0.55, y + h * 0.42)
        ctx.lineTo(x + w * 0.5, y + h * 0.3)
        ctx.lineTo(x + w * 0.82, y + h * 0.48)
        ctx.lineTo(x + w * 0.82, y + h * 0.66)
        ctx.lineTo(x + w * 0.45, y + h)
        ctx.lineTo(x + w * 0.25, y + h * 0.88)
        ctx.closePath()
        ctx.fill()
    },
    cortana(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2
        ctx.strokeStyle = c("#2aa0ff")
        ctx.lineWidth = h * 0.18
        ctx.beginPath()
        ctx.arc(cx, cy, h * 0.36, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = "rgba(255,255,255,0.5)"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, h * 0.36, Math.PI * 1.1, Math.PI * 1.6)
        ctx.stroke()
    },
    defender(ctx, x, y, w, h, c) {
        const cx = x + w / 2
        ctx.fillStyle = c("#0078d4")
        ctx.beginPath()
        ctx.moveTo(cx, y)
        ctx.lineTo(cx + w * 0.36, y + h * 0.15)
        ctx.quadraticCurveTo(cx + w * 0.36, y + h * 0.8, cx, y + h)
        ctx.quadraticCurveTo(cx - w * 0.36, y + h * 0.8, cx - w * 0.36, y + h * 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = "rgba(255,255,255,0.3)"
        ctx.fillRect(cx - 1, y + h * 0.1, 2, h * 0.75)
        ctx.fillRect(cx - w * 0.28, y + h * 0.42, w * 0.56, 2)
    },
    windows(ctx, x, y, w, h, c) {
        const s = Math.min(w, h) * 0.46, g = 2
        const ox = x + w / 2 - s - g / 2, oy = y + h / 2 - s - g / 2
        const cols = ["#f25022", "#7fba00", "#00a4ef", "#ffb900"]
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = c(cols[i])
            ctx.fillRect(ox + (i % 2) * (s + g), oy + Math.floor(i / 2) * (s + g), s, s)
        }
    },
    xbox(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2, r = h * 0.48
        dot(ctx, cx, cy, r, c("#107c10"))
        ctx.strokeStyle = WHITE
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.6, cy - r * 0.6); ctx.quadraticCurveTo(cx, cy, cx + r * 0.6, cy + r * 0.7)
        ctx.moveTo(cx + r * 0.6, cy - r * 0.6); ctx.quadraticCurveTo(cx, cy, cx - r * 0.6, cy + r * 0.7)
        ctx.stroke()
    },
    azure(ctx, x, y, w, h, c) {
        ctx.fillStyle = c("#0089d6")
        ctx.beginPath()
        ctx.moveTo(x + w * 0.42, y)
        ctx.lineTo(x + w * 0.05, y + h)
        ctx.lineTo(x + w * 0.4, y + h)
        ctx.lineTo(x + w * 0.62, y + h * 0.35)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = c("#50e6ff")
        ctx.beginPath()
        ctx.moveTo(x + w * 0.58, y + h * 0.2)
        ctx.lineTo(x + w * 0.95, y + h)
        ctx.lineTo(x + w * 0.3, y + h)
        ctx.lineTo(x + w * 0.62, y + h * 0.78)
        ctx.closePath()
        ctx.fill()
    },
    visualstudio(ctx, x, y, w, h, c) {
        const col = c("#865fc5")
        fillRR(ctx, x + w * 0.62, y, w * 0.32, h, 3, col)
        ctx.strokeStyle = col
        ctx.lineWidth = h * 0.18
        ctx.beginPath()
        ctx.moveTo(x + w * 0.8, y + h * 0.15)
        ctx.lineTo(x + w * 0.15, y + h * 0.75)
        ctx.moveTo(x + w * 0.8, y + h * 0.85)
        ctx.lineTo(x + w * 0.15, y + h * 0.25)
        ctx.stroke()
    },
    copilot(ctx, x, y, w, h, c) {
        const grad = ctx.createLinearGradient(x, y, x + w, y + h)
        grad.addColorStop(0, c("#2870ea"))
        grad.addColorStop(0.5, c("#c157e0"))
        grad.addColorStop(1, c("#f2a33a"))
        ctx.strokeStyle = grad
        ctx.lineWidth = h * 0.22
        ctx.beginPath()
        ctx.moveTo(x + w * 0.15, y + h * 0.8)
        ctx.bezierCurveTo(x + w * 0.1, y + h * 0.1, x + w * 0.5, y + h * 0.1, x + w * 0.5, y + h * 0.5)
        ctx.bezierCurveTo(x + w * 0.5, y + h * 0.9, x + w * 0.9, y + h * 0.9, x + w * 0.85, y + h * 0.2)
        ctx.stroke()
    },
    calculator(ctx, x, y, w, h, c) {
        fillRR(ctx, x + w * 0.16, y, w * 0.68, h, 3, INK)
        fillRR(ctx, x + w * 0.16 + 1.5, y + 1.5, w * 0.68 - 3, h - 3, 2, c("#4a5160"))
        fillRR(ctx, x + w * 0.24, y + h * 0.1, w * 0.52, h * 0.22, 1.5, c("#9be3a0"))
        text(ctx, "8.", x + w * 0.7, y + h * 0.21, h * 0.2, INK, 700)
        const keys = ["#d8dde6", "#d8dde6", "#d8dde6", "#d8dde6", "#d8dde6", "#d8dde6", "#d8dde6", "#d8dde6", "#ff9f1c"]
        for (let i = 0; i < 9; i++) {
            const kx = x + w * (0.25 + (i % 3) * 0.18), ky = y + h * (0.42 + Math.floor(i / 3) * 0.19)
            fillRR(ctx, kx, ky, w * 0.14, h * 0.14, 1, i === 8 ? c(keys[i]) : keys[i])
        }
    },
    solitaire(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2
        ctx.save()
        ctx.translate(cx + w * 0.1, cy)
        ctx.rotate(0.28)
        fillRR(ctx, -w * 0.2, -h * 0.5, w * 0.4, h, 3, INK)
        fillRR(ctx, -w * 0.2 + 1.5, -h * 0.5 + 1.5, w * 0.4 - 3, h - 3, 2, c("#1f5fbf"))
        ctx.strokeStyle = "rgba(255,255,255,0.45)"
        ctx.lineWidth = 1
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath(); ctx.moveTo(-w * 0.14, i * h * 0.16 - h * 0.1); ctx.lineTo(w * 0.14, i * h * 0.16 + h * 0.1); ctx.stroke()
        }
        ctx.restore()
        ctx.save()
        ctx.translate(cx - w * 0.1, cy)
        ctx.rotate(-0.2)
        fillRR(ctx, -w * 0.22, -h * 0.5, w * 0.44, h, 3, INK)
        fillRR(ctx, -w * 0.22 + 1.5, -h * 0.5 + 1.5, w * 0.44 - 3, h - 3, 2, "#fafafa")
        text(ctx, "A", -w * 0.1, -h * 0.28, h * 0.3, c("#d6202a"), 800)
        ctx.fillStyle = c("#d6202a")
        const hx = 0, hy = h * 0.1, s = h * 0.17
        ctx.beginPath()
        ctx.moveTo(hx, hy + s * 1.2)
        ctx.bezierCurveTo(hx - s * 1.8, hy - s * 0.2, hx - s * 0.7, hy - s * 1.3, hx, hy - s * 0.3)
        ctx.bezierCurveTo(hx + s * 0.7, hy - s * 1.3, hx + s * 1.8, hy - s * 0.2, hx, hy + s * 1.2)
        ctx.fill()
        ctx.restore()
    },
    minesweeper(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2
        fillRR(ctx, x + w * 0.1, y, w * 0.8, h, 2, "#e8eaee")
        ctx.fillStyle = c("#7b8190")
        ctx.beginPath()
        ctx.moveTo(x + w * 0.9, y); ctx.lineTo(x + w * 0.9, y + h); ctx.lineTo(x + w * 0.1, y + h)
        ctx.lineTo(x + w * 0.1 + 3, y + h - 3); ctx.lineTo(x + w * 0.9 - 3, y + h - 3); ctx.lineTo(x + w * 0.9 - 3, y + 3)
        ctx.closePath()
        ctx.fill()
        fillRR(ctx, x + w * 0.1 + 3, y + 3, w * 0.8 - 6, h - 6, 1, c("#b5bac6"))
        const r = h * 0.24
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 4
            ctx.moveTo(cx - Math.cos(a) * r * 1.6, cy - Math.sin(a) * r * 1.6)
            ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6)
        }
        ctx.stroke()
        dot(ctx, cx, cy, r, INK)
        dot(ctx, cx - r * 0.35, cy - r * 0.35, r * 0.28, WHITE)
        dot(ctx, cx + w * 0.3, y + h * 0.22, 1.8, c("#e81123"))
    },
    stickynotes(ctx, x, y, w, h, c) {
        const nx = x + w * 0.12, nw = w * 0.76
        ctx.fillStyle = "rgba(5,7,10,0.35)"
        ctx.fillRect(nx + 2, y + 2, nw, h)
        ctx.fillStyle = c("#ffd93d")
        ctx.beginPath()
        ctx.moveTo(nx, y); ctx.lineTo(nx + nw, y); ctx.lineTo(nx + nw, y + h * 0.7)
        ctx.lineTo(nx + nw - h * 0.3, y + h); ctx.lineTo(nx, y + h)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = c("#e0b400")
        ctx.fillRect(nx, y, nw, h * 0.2)
        ctx.fillStyle = "#c9a100"
        ctx.beginPath()
        ctx.moveTo(nx + nw, y + h * 0.7); ctx.lineTo(nx + nw - h * 0.3, y + h); ctx.lineTo(nx + nw - h * 0.3, y + h * 0.7)
        ctx.closePath()
        ctx.fill()
        line(ctx, [nx + 4, y + h * 0.4, nx + nw - 6, y + h * 0.4], "rgba(5,7,10,0.65)", 1.5)
        line(ctx, [nx + 4, y + h * 0.6, nx + nw - 10, y + h * 0.58], "rgba(5,7,10,0.65)", 1.5)
        line(ctx, [nx + 4, y + h * 0.8, nx + nw * 0.4, y + h * 0.8], "rgba(5,7,10,0.65)", 1.5)
    },
    snippingtool(ctx, x, y, w, h, c) {
        const cx = x + w / 2
        ctx.strokeStyle = c("#3a96dd")
        ctx.lineWidth = 2
        const l = x + w * 0.1, r = x + w * 0.9, t = y + h * 0.04, b = y + h * 0.96, k = 7
        ctx.beginPath()
        ctx.moveTo(l, t + k); ctx.lineTo(l, t); ctx.lineTo(l + k, t)
        ctx.moveTo(r - k, t); ctx.lineTo(r, t); ctx.lineTo(r, t + k)
        ctx.moveTo(r, b - k); ctx.lineTo(r, b); ctx.lineTo(r - k, b)
        ctx.moveTo(l + k, b); ctx.lineTo(l, b); ctx.lineTo(l, b - k)
        ctx.stroke()
        const px = cx, py = y + h * 0.5
        ctx.lineCap = "round"
        line(ctx, [px, py, px + w * 0.2, y + h * 0.08], c("#e8ecf2"), 3)
        line(ctx, [px, py, px - w * 0.2, y + h * 0.08], c("#cfd5de"), 3)
        line(ctx, [px, py, px - w * 0.15, y + h * 0.78], c("#e8ecf2"), 2)
        line(ctx, [px, py, px + w * 0.15, y + h * 0.78], c("#cfd5de"), 2)
        ctx.lineCap = "butt"
        for (const s of [-1, 1]) {
            ctx.strokeStyle = c("#e81123")
            ctx.lineWidth = 2.2
            ctx.beginPath()
            ctx.arc(px + s * w * 0.18, y + h * 0.82, h * 0.13, 0, Math.PI * 2)
            ctx.stroke()
        }
        dot(ctx, px, py, 2, INK)
    },
    wordpad(ctx, x, y, w, h, c) {
        const px = x + w * 0.18, pw = w * 0.56, f = h * 0.28
        ctx.fillStyle = INK
        ctx.fillRect(px - 1.5, y - 1.5, pw + 3, h + 3)
        ctx.fillStyle = "#f4f6fa"
        ctx.beginPath()
        ctx.moveTo(px, y); ctx.lineTo(px + pw - f, y); ctx.lineTo(px + pw, y + f); ctx.lineTo(px + pw, y + h); ctx.lineTo(px, y + h)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = c("#9db4d6")
        ctx.beginPath()
        ctx.moveTo(px + pw - f, y); ctx.lineTo(px + pw - f, y + f); ctx.lineTo(px + pw, y + f)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = c("#2b7cd3")
        ctx.fillRect(px + 3, y + h * 0.18, pw * 0.5, 2.5)
        ctx.fillStyle = "#8aa"
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 3, y + h * (0.38 + i * 0.15), pw - 6, 1.5)
        ctx.lineCap = "round"
        line(ctx, [x + w * 0.9, y + h * 0.15, x + w * 0.55, y + h * 0.78], INK, 5)
        line(ctx, [x + w * 0.9, y + h * 0.15, x + w * 0.55, y + h * 0.78], c("#ffb900"), 3)
        line(ctx, [x + w * 0.55, y + h * 0.78, x + w * 0.5, y + h * 0.92], INK, 2)
        ctx.lineCap = "butt"
    },
    sharepoint(ctx, x, y, w, h, c) {
        dot(ctx, x + w * 0.62, y + h * 0.3, h * 0.3, c("#0b6a6e"))
        dot(ctx, x + w * 0.78, y + h * 0.62, h * 0.27, c("#36b9b0"))
        dot(ctx, x + w * 0.52, y + h * 0.74, h * 0.2, c("#9fe3d9"))
        fillRR(ctx, x, y + h * 0.12, w * 0.58, h * 0.76, 3, INK)
        fillRR(ctx, x + 1.5, y + h * 0.12 + 1.5, w * 0.58 - 3, h * 0.76 - 3, 2, c("#038387"))
        text(ctx, "S", x + w * 0.29, y + h * 0.52, h * 0.5, WHITE)
    },
    visio(ctx, x, y, w, h, c) {
        const col = c("#3955a3")
        line(ctx, [x + w * 0.5, y + h * 0.5, x + w * 0.74, y + h * 0.5], "#c9d3f0", 2)
        fillRR(ctx, x + w * 0.7, y + h * 0.2, w * 0.28, h * 0.3, 2, c("#6f8be0"))
        ctx.fillStyle = c("#a9bbf2")
        ctx.beginPath()
        ctx.moveTo(x + w * 0.84, y + h * 0.58); ctx.lineTo(x + w * 0.97, y + h * 0.79)
        ctx.lineTo(x + w * 0.84, y + h); ctx.lineTo(x + w * 0.71, y + h * 0.79)
        ctx.closePath()
        ctx.fill()
        fillRR(ctx, x, y + h * 0.12, w * 0.58, h * 0.76, 3, INK)
        fillRR(ctx, x + 1.5, y + h * 0.12 + 1.5, w * 0.58 - 3, h * 0.76 - 3, 2, col)
        text(ctx, "V", x + w * 0.29, y + h * 0.52, h * 0.5, WHITE)
    },
    project(ctx, x, y, w, h, c) {
        const bars = [[0.4, 0.3], [0.52, 0.34], [0.66, 0.3]]
        ctx.fillStyle = "rgba(255,255,255,0.18)"
        ctx.fillRect(x + w * 0.4, y, w * 0.6, h)
        for (let i = 0; i < 3; i++)
            fillRR(ctx, x + w * bars[i][0], y + h * (0.18 + i * 0.26), w * bars[i][1], h * 0.14, 1.5, c(i === 1 ? "#6fd08c" : "#2f9e5b"))
        fillRR(ctx, x, y + h * 0.12, w * 0.58, h * 0.76, 3, INK)
        fillRR(ctx, x + 1.5, y + h * 0.12 + 1.5, w * 0.58 - 3, h * 0.76 - 3, 2, c("#31752f"))
        text(ctx, "P", x + w * 0.29, y + h * 0.52, h * 0.5, WHITE)
    },
    planner(ctx, x, y, w, h, c) {
        fillRR(ctx, x + w * 0.04, y, w * 0.92, h, 3, INK)
        fillRR(ctx, x + w * 0.04 + 1.5, y + 1.5, w * 0.92 - 3, h - 3, 2, c("#1f7a4d"))
        const cols = [0.12, 0.38, 0.64], counts = [3, 2, 1]
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = "rgba(255,255,255,0.22)"
            ctx.fillRect(x + w * cols[i], y + h * 0.14, w * 0.24, h * 0.72)
            for (let j = 0; j < counts[i]; j++) {
                const cy = y + h * (0.2 + j * 0.22)
                fillRR(ctx, x + w * cols[i] + 1, cy, w * 0.24 - 2, h * 0.17, 1, WHITE)
                if (i === 2 || (i === 1 && j === 0)) {
                    line(ctx, [x + w * cols[i] + 3, cy + h * 0.09, x + w * cols[i] + 5, cy + h * 0.13, x + w * cols[i] + 8.5, cy + h * 0.04], c("#1f7a4d"), 1.4)
                }
            }
        }
    },
    msn(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h * 0.5
        const wing = (sx, sy, rx, ry, rot, col) => {
            ctx.fillStyle = col
            ctx.beginPath()
            oval(ctx, cx + sx, cy + sy, rx, ry, rot, 0, Math.PI * 2)
            ctx.fill()
        }
        wing(-w * 0.21, -h * 0.17, w * 0.27, h * 0.2, 0.55, c("#2a8ef0"))
        wing(w * 0.21, -h * 0.17, w * 0.27, h * 0.2, -0.55, c("#2a8ef0"))
        wing(-w * 0.16, h * 0.22, w * 0.19, h * 0.14, -0.45, c("#7cc142"))
        wing(w * 0.16, h * 0.22, w * 0.19, h * 0.14, 0.45, c("#f5821f"))
        dot(ctx, cx - w * 0.28, cy - h * 0.25, h * 0.06, "rgba(255,255,255,0.6)")
        dot(ctx, cx + w * 0.28, cy - h * 0.25, h * 0.06, "rgba(255,255,255,0.6)")
        fillRR(ctx, cx - 1.8, cy - h * 0.38, 3.6, h * 0.8, 1.8, INK)
        line(ctx, [cx - 1, cy - h * 0.36, cx - 5, y - 2], INK, 1.2)
        line(ctx, [cx + 1, cy - h * 0.36, cx + 5, y - 2], INK, 1.2)
    },
    mediaplayer(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2, r = h * 0.48
        dot(ctx, cx, cy, r + 1.5, INK)
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r)
        g.addColorStop(0, c("#ffb347"))
        g.addColorStop(1, c("#e8590c"))
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = WHITE
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.3, cy - r * 0.5)
        ctx.lineTo(cx + r * 0.55, cy)
        ctx.lineTo(cx - r * 0.3, cy + r * 0.5)
        ctx.closePath()
        ctx.fill()
    },
    moviemaker(ctx, x, y, w, h, c) {
        fillRR(ctx, x + w * 0.04, y + h * 0.1, w * 0.92, h * 0.8, 2, "#2b2f38")
        ctx.fillStyle = "#e8ecf2"
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(x + w * (0.1 + i * 0.145), y + h * 0.16, w * 0.07, h * 0.1)
            ctx.fillRect(x + w * (0.1 + i * 0.145), y + h * 0.74, w * 0.07, h * 0.1)
        }
        const fr = [["#2a8ef0", 0.1], ["#7cc142", 0.37], ["#f5821f", 0.64]]
        for (const [col, fx] of fr) fillRR(ctx, x + w * fx, y + h * 0.31, w * 0.26, h * 0.38, 1.5, c(col))
        ctx.fillStyle = WHITE
        ctx.beginPath()
        ctx.moveTo(x + w * 0.46, y + h * 0.4); ctx.lineTo(x + w * 0.56, y + h * 0.5); ctx.lineTo(x + w * 0.46, y + h * 0.6)
        ctx.closePath()
        ctx.fill()
    },
    silverlight(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2, r = h * 0.48
        const g = ctx.createLinearGradient(x, y, x + w, y + h)
        g.addColorStop(0, c("#b4c3d6"))
        g.addColorStop(1, c("#43607f"))
        dot(ctx, cx, cy, r + 1.5, INK)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, "S", cx, cy + 1, h * 0.7, WHITE, 900)
        ctx.strokeStyle = "rgba(255,255,255,0.7)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, r * 0.82, Math.PI * 1.05, Math.PI * 1.45)
        ctx.stroke()
    },
    groove(ctx, x, y, w, h, c) {
        const cx = x + w / 2, cy = y + h / 2, r = h * 0.48
        dot(ctx, cx, cy, r, "#14161c")
        ctx.strokeStyle = "rgba(255,255,255,0.18)"
        ctx.lineWidth = 1
        for (const k of [0.84, 0.7, 0.56]) {
            ctx.beginPath()
            ctx.arc(cx, cy, r * k, 0, Math.PI * 2)
            ctx.stroke()
        }
        ctx.strokeStyle = "rgba(255,255,255,0.55)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, r * 0.9, Math.PI * 1.15, Math.PI * 1.45)
        ctx.stroke()
        dot(ctx, cx, cy, r * 0.42, c("#e3126b"))
        text(ctx, "♪", cx, cy + 1, r * 0.62, WHITE, 700)
    },
    sqlserver(ctx, x, y, w, h, c) {
        const cx = x + w / 2, rx = w * 0.34, ry = h * 0.14
        const top = y + h * 0.16, bot = y + h * 0.86
        const body = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0)
        body.addColorStop(0, c("#b22a28"))
        body.addColorStop(0.4, c("#ff6a62"))
        body.addColorStop(1, c("#b22a28"))
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.moveTo(cx - rx, top)
        ctx.lineTo(cx - rx, bot)
        oval(ctx, cx, bot, rx, ry, 0, Math.PI, 0)
        ctx.lineTo(cx + rx, top)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.45)"
        ctx.lineWidth = 1.5
        for (const t of [0.38, 0.62]) {
            ctx.beginPath()
            oval(ctx, cx, y + h * (0.16 + t * 0.7), rx, ry, 0, 0, Math.PI)
            ctx.stroke()
        }
        ctx.fillStyle = c("#f2a8a4")
        ctx.beginPath()
        oval(ctx, cx, top, rx, ry, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.2
        ctx.stroke()
    },
    dynamics(ctx, x, y, w, h, c) {
        ctx.fillStyle = c("#0b53ce")
        ctx.beginPath()
        ctx.moveTo(x + w * 0.1, y)
        ctx.lineTo(x + w * 0.95, y + h * 0.5)
        ctx.lineTo(x + w * 0.1, y + h)
        ctx.lineTo(x + w * 0.28, y + h * 0.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = c("#1a3f9c")
        ctx.beginPath()
        ctx.moveTo(x + w * 0.28, y + h * 0.5)
        ctx.lineTo(x + w * 0.95, y + h * 0.5)
        ctx.lineTo(x + w * 0.1, y + h)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = "rgba(255,255,255,0.4)"
        ctx.beginPath()
        ctx.moveTo(x + w * 0.2, y + h * 0.1)
        ctx.lineTo(x + w * 0.62, y + h * 0.36)
        ctx.lineTo(x + w * 0.36, y + h * 0.5)
        ctx.lineTo(x + w * 0.2, y + h * 0.1)
        ctx.fill()
    },
    hololens(ctx, x, y, w, h, c) {
        const cx = x + w / 2
        ctx.strokeStyle = c("#6b7280")
        ctx.lineWidth = h * 0.16
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(x + w * 0.06, y + h * 0.4)
        ctx.quadraticCurveTo(cx, y - h * 0.15, x + w * 0.94, y + h * 0.4)
        ctx.stroke()
        ctx.lineCap = "butt"
        fillRR(ctx, x, y + h * 0.3, w, h * 0.5, h * 0.25, INK)
        const glass = ctx.createLinearGradient(0, y + h * 0.34, 0, y + h * 0.76)
        glass.addColorStop(0, c("#7fd6ff"))
        glass.addColorStop(1, c("#1d6fd6"))
        fillRR(ctx, x + 2, y + h * 0.34, w - 4, h * 0.42, h * 0.2, glass)
        ctx.strokeStyle = "rgba(255,255,255,0.75)"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x + w * 0.16, y + h * 0.46); ctx.lineTo(x + w * 0.4, y + h * 0.46)
        ctx.stroke()
        const hx = x + w * 0.72, hy = y + h * 0.55, s = h * 0.13
        ctx.strokeStyle = WHITE
        ctx.lineWidth = 1
        ctx.strokeRect(hx - s, hy - s, s * 1.6, s * 1.6)
        ctx.strokeRect(hx - s * 0.5, hy - s * 1.5, s * 1.6, s * 1.6)
    }
}

export const ALIEN_TYPES = Object.keys(DRAW)

function drawCracks(ctx, x, y, w, h, damage) {
    if (damage <= 0) return
    ctx.strokeStyle = "rgba(5,7,10,0.85)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x + w * 0.3, y)
    ctx.lineTo(x + w * 0.45, y + h * 0.4)
    ctx.lineTo(x + w * 0.35, y + h * 0.65)
    if (damage >= 0.5) {
        ctx.moveTo(x + w * 0.45, y + h * 0.4)
        ctx.lineTo(x + w * 0.75, y + h * 0.55)
        ctx.lineTo(x + w * 0.7, y + h)
    }
    ctx.stroke()
}

// Escalating evil look carried over from the xen-installer game.
function drawMenace(ctx, x, y, w, h, menace) {
    const cx = x + w / 2
    if (menace >= 4) {
        ctx.fillStyle = "#ff2030"
        for (let s = 0; s < 3; s++) {
            const sy = y + 3 + s * h * 0.28
            ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x - 5, sy + 3); ctx.lineTo(x, sy + 6); ctx.fill()
            ctx.beginPath(); ctx.moveTo(x + w, sy); ctx.lineTo(x + w + 5, sy + 3); ctx.lineTo(x + w, sy + 6); ctx.fill()
        }
    }
    if (menace >= 1) {
        dot(ctx, cx - 6, y + 5, 2.4, "#ff1a1a")
        dot(ctx, cx + 6, y + 5, 2.4, "#ff1a1a")
        line(ctx, [cx - 10, y + 1, cx - 3, y + 4], INK, 2)
        line(ctx, [cx + 10, y + 1, cx + 3, y + 4], INK, 2)
    }
    if (menace >= 2) {
        ctx.fillStyle = WHITE
        for (const f of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(cx + f * 6, y + h - 1)
            ctx.lineTo(cx + f * 2, y + h - 1)
            ctx.lineTo(cx + f * 4, y + h + 5)
            ctx.closePath()
            ctx.fill()
        }
    }
}

function drawLegs(ctx, x, y, w, h, frame, color) {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.beginPath()
    const spread = frame ? 1 : -1
    for (const side of [-1, 1]) {
        const bx = x + w / 2 + side * w * 0.3
        ctx.moveTo(bx, y + h - 3)
        ctx.lineTo(bx + side * 5 * spread, y + h + 6)
        ctx.moveTo(bx - side * w * 0.14, y + h - 3)
        ctx.lineTo(bx - side * w * 0.14 - side * 3 * spread, y + h + 6)
    }
    ctx.moveTo(x + w * 0.3, y + 2)
    ctx.lineTo(x + w * 0.22 - spread * 2, y - 6)
    ctx.moveTo(x + w * 0.7, y + 2)
    ctx.lineTo(x + w * 0.78 + spread * 2, y - 6)
    ctx.stroke()
    ctx.lineCap = "butt"
    dot(ctx, x + w * 0.22 - spread * 2, y - 6, 2, color)
    dot(ctx, x + w * 0.78 + spread * 2, y - 6, 2, color)
}

const LEG_COLOR = { 1: "#9CA3AF", 2: "#c77dff", 3: "#ffb454", 4: "#ff5f56" }

export function drawAlien(ctx, type, x, y, w, h, damage, menace, frame) {
    const fn = DRAW[type]
    if (!fn) return
    if (menace >= 3) {
        const cx = x + w / 2, cy = y + h / 2, r = w * 0.55 + menace * 2
        const halo = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, r)
        halo.addColorStop(0, `rgba(255,32,48,${0.1 + menace * 0.06})`)
        halo.addColorStop(1, "rgba(255,32,48,0)")
        ctx.fillStyle = halo
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    }
    drawLegs(ctx, x, y, w, h, frame || 0, tint(LEG_COLOR[ROSTER[type].tier], menace || 0))
    ctx.save()
    fn(ctx, x, y, w, h, col => tint(col, menace))
    ctx.restore()
    drawCracks(ctx, x, y, w, h, damage)
    drawMenace(ctx, x, y, w, h, menace)
}

function angryEye(ctx, ex, ey, r, look, brow, rage) {
    dot(ctx, ex, ey, r + 1.5, INK)
    dot(ctx, ex, ey, r, WHITE)
    dot(ctx, ex + look, ey + r * 0.2, r * 0.5, rage ? "#ff1a1a" : INK)
    dot(ctx, ex + look + r * 0.15, ey, r * 0.15, WHITE)
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.moveTo(ex - r * 1.3, ey - r * 1.2 - brow)
    ctx.lineTo(ex + r * 1.3, ey - r * 0.5 + brow)
    ctx.lineTo(ex + r * 1.3, ey - r * 0.9 + brow)
    ctx.lineTo(ex - r * 1.3, ey - r * 1.6 - brow)
    ctx.closePath()
    ctx.fill()
}

function speech(ctx, x, y, w, h, msg, tailX) {
    fillRR(ctx, x, y, w, h, 8, "#fff8c4")
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    rrect(ctx, x, y, w, h, 8)
    ctx.stroke()
    ctx.fillStyle = "#fff8c4"
    ctx.beginPath()
    ctx.moveTo(tailX - 6, y + h - 1)
    ctx.lineTo(tailX - 14, y + h + 12)
    ctx.lineTo(tailX + 6, y + h - 1)
    ctx.closePath()
    ctx.fill()
    line(ctx, [tailX - 6, y + h, tailX - 14, y + h + 12, tailX + 6, y + h], INK, 2)
    text(ctx, msg, x + w / 2, y + h / 2 + 1, 11, INK, 700)
}

function clippyWire(ctx, cx, top, bottom, width, style) {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(cx - 26, bottom - 24)
    ctx.lineTo(cx - 26, top + 26)
    ctx.arc(cx, top + 26, 26, Math.PI, 0)
    ctx.lineTo(cx + 26, bottom - 18)
    ctx.arc(cx + 8, bottom - 18, 18, 0, Math.PI)
    ctx.lineTo(cx - 10, top + 40)
    ctx.arc(cx + 1, top + 40, 11, Math.PI, 0)
    ctx.lineTo(cx + 12, bottom - 30)
    ctx.stroke()
    ctx.lineCap = "butt"
    ctx.lineJoin = "miter"
}

const BOSS_DRAW = {
    clippy(ctx, x, y, w, h, tick, rage) {
        const cx = x + w * 0.32, top = y + 4, bottom = y + h
        const bob = Math.sin(tick / 15) * 3
        const metal = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0)
        metal.addColorStop(0, "#6b7682")
        metal.addColorStop(0.35, "#eef3f8")
        metal.addColorStop(0.6, "#a9b4c0")
        metal.addColorStop(1, "#59636e")
        clippyWire(ctx, cx, top + bob, bottom + bob, 12, "#2a3038")
        clippyWire(ctx, cx, top + bob, bottom + bob, 9, metal)
        clippyWire(ctx, cx - 2, top + bob - 1, bottom + bob - 1, 2, "rgba(255,255,255,0.7)")
        const look = Math.sin(tick / 25) * 3
        angryEye(ctx, cx - 16, top + 30 + bob, 10, look, rage ? 3 : 0, rage)
        angryEye(ctx, cx + 16, top + 30 + bob, 10, look, rage ? 3 : 0, rage)
        const msgs = ["You seem to be losing!", "Need help dying?", "Switch to Windows?"]
        speech(ctx, x + w * 0.46, y - 8, w * 0.66, 30, msgs[Math.floor(tick / 180) % msgs.length], x + w * 0.52)
    },

    bsod(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2
        ctx.lineCap = "round"
        for (let i = 0; i < 6; i++) {
            const sx = x + w * (0.18 + i * 0.13)
            const sway = Math.sin(tick / 14 + i * 1.3) * 16
            ctx.strokeStyle = "#1b1f27"
            ctx.lineWidth = 7
            ctx.beginPath()
            ctx.moveTo(sx, y + h * 0.78)
            ctx.bezierCurveTo(sx + sway, y + h * 0.95, sx - sway, y + h * 1.05, sx + sway * 0.6, y + h * 1.18)
            ctx.stroke()
            ctx.strokeStyle = "#3d4656"
            ctx.lineWidth = 3
            ctx.stroke()
            dot(ctx, sx + sway * 0.6, y + h * 1.18, 4, i % 2 ? "#ffd400" : "#c0c8d2")
        }
        ctx.lineCap = "butt"
        const bezel = ctx.createLinearGradient(0, y, 0, y + h * 0.82)
        bezel.addColorStop(0, "#5a6270")
        bezel.addColorStop(1, "#22262e")
        fillRR(ctx, x, y, w, h * 0.82, 10, bezel)
        const scr = ctx.createLinearGradient(0, y + 8, 0, y + h * 0.74)
        scr.addColorStop(0, "#2d5bff")
        scr.addColorStop(1, "#0f2fd6")
        fillRR(ctx, x + 9, y + 8, w - 18, h * 0.82 - 18, 5, scr)
        ctx.fillStyle = "rgba(255,255,255,0.06)"
        for (let sy = y + 10; sy < y + h * 0.78; sy += 4) ctx.fillRect(x + 10, sy, w - 20, 1)
        text(ctx, rage ? ">:(" : ":(", x + w * 0.2, y + h * 0.34, h * 0.32, WHITE, 400)
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        ctx.fillRect(x + w * 0.38, y + h * 0.2, w * 0.5, 5)
        ctx.fillRect(x + w * 0.38, y + h * 0.3, w * 0.38, 5)
        const pct = Math.floor((tick / 3) % 100)
        text(ctx, pct + "% complete", x + w * 0.5, y + h * 0.53, 14, WHITE, 600)
        text(ctx, "STOP CODE: TUX_WINS", x + w * 0.5, y + h * 0.66, 10, "rgba(255,255,255,0.8)", 500)
        dot(ctx, cx, y + h * 0.78, 2.5, tick % 40 < 20 ? "#39ff8f" : "#1a7a44")
    },

    winupdate(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2, cy = y + h * 0.5
        const glow = ctx.createLinearGradient(0, cy + 20, 0, y + h + 20)
        glow.addColorStop(0, "rgba(91,192,255,0.55)")
        glow.addColorStop(1, "rgba(91,192,255,0)")
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.moveTo(cx - w * 0.22, cy + 18)
        ctx.lineTo(cx + w * 0.22, cy + 18)
        ctx.lineTo(cx + w * 0.34, y + h + 20)
        ctx.lineTo(cx - w * 0.34, y + h + 20)
        ctx.closePath()
        ctx.fill()

        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1, 0.32)
        const hull = ctx.createLinearGradient(0, -w / 2, 0, w / 2)
        hull.addColorStop(0, "#8fb8e8")
        hull.addColorStop(0.5, "#2f6fb8")
        hull.addColorStop(1, "#0e2f5c")
        ctx.fillStyle = hull
        ctx.beginPath()
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = "#cfe6ff"
        ctx.lineWidth = 4
        ctx.stroke()
        ctx.restore()

        for (let i = 0; i < 8; i++) {
            const lx = cx + Math.cos(i / 8 * Math.PI * 2 + tick / 30) * w * 0.42
            const ly = cy + Math.sin(i / 8 * Math.PI * 2 + tick / 30) * w * 0.13
            if (ly > cy) dot(ctx, lx, ly, 3.5, (i + Math.floor(tick / 8)) % 2 ? "#fffd6b" : "#ff5f56")
        }

        const dome = ctx.createLinearGradient(0, cy - 60, 0, cy)
        dome.addColorStop(0, "rgba(180,225,255,0.55)")
        dome.addColorStop(1, "rgba(60,120,200,0.25)")
        ctx.fillStyle = dome
        ctx.beginPath()
        ctx.arc(cx, cy - 4, 46, Math.PI, 0)
        ctx.closePath()
        ctx.fill()

        const s = 24, g = 4
        const cols = [["#ff7a4d", "#c2370f"], ["#a5e03a", "#4f8a00"], ["#4fc3ff", "#0078c8"], ["#ffd34d", "#d08f00"]]
        ctx.save()
        ctx.translate(cx, cy - 28)
        ctx.fillStyle = rage ? "rgba(255,32,48,0.35)" : "rgba(91,192,255,0.35)"
        ctx.fillRect(-s - g / 2 - 4, -s - g / 2 - 4, 2 * s + g + 8, 2 * s + g + 8)
        for (let i = 0; i < 4; i++) {
            const px = (i % 2) * (s + g) - s - g / 2
            const py = Math.floor(i / 2) * (s + g) - s - g / 2
            const pane = ctx.createLinearGradient(0, py, 0, py + s)
            pane.addColorStop(0, cols[i][0])
            pane.addColorStop(1, cols[i][1])
            ctx.fillStyle = pane
            ctx.fillRect(px, py, s, s)
        }
        ctx.restore()
        ctx.fillStyle = "rgba(255,255,255,0.3)"
        ctx.fillRect(cx - s - g / 2 + 3, cy - 28 - s - g / 2 + 3, s - 6, 3)
        ctx.fillRect(cx + g / 2 + 3, cy - 28 - s - g / 2 + 3, s - 6, 3)

        for (let i = 0; i < 6; i++) {
            const a = tick / 7 + i * 0.45
            dot(ctx, cx + Math.cos(a) * 11, cy + 14 + Math.sin(a) * 6, 3 - i * 0.35, WHITE)
        }

        fillRR(ctx, x + w * 0.16, y + h * 0.82, w * 0.68, 9, 4, "#0b1a2e")
        fillRR(ctx, x + w * 0.16, y + h * 0.82, w * 0.68 * ((tick % 400) / 400), 9, 4, "#39ff8f")
        text(ctx, "Installing update " + (1 + Math.floor(tick / 400)) + " of 437", cx, y + h * 0.94, 11, WHITE, 600)
    },

    cortanaboss(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2 + (rage ? Math.sin(tick * 1.7) * 2 : 0), cy = y + h * 0.47
        const hue = rage ? "255,59,92" : "63,182,255"
        const rgba = a => `rgba(${hue},${a})`
        const pulse = 0.5 + 0.5 * Math.sin(tick / (rage ? 5 : 12))
        for (let i = 0; i < 7; i++) {
            const bh = 6 + Math.abs(Math.sin(tick / 6 + i * 0.9)) * (26 - i * 3)
            for (const side of [-1, 1]) fillRR(ctx, cx + side * (68 + i * 7) - 2, cy - bh / 2, 4, bh, 2, rgba(0.9 - i * 0.11))
        }
        const halo = ctx.createRadialGradient(cx, cy, 30, cx, cy, 72)
        halo.addColorStop(0, rgba(0))
        halo.addColorStop(0.55, rgba(0.35 + pulse * 0.2))
        halo.addColorStop(1, rgba(0))
        ctx.fillStyle = halo
        ctx.fillRect(cx - 72, cy - 72, 144, 144)
        ctx.lineWidth = 13
        ctx.strokeStyle = rgba(1)
        ctx.beginPath()
        ctx.arc(cx, cy, 45, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 3
        ctx.strokeStyle = "rgba(255,255,255,0.8)"
        ctx.beginPath()
        ctx.arc(cx, cy, 45, 0, Math.PI * 2)
        ctx.stroke()
        const spin = tick / (rage ? 8 : 18)
        ctx.lineCap = "round"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(cx, cy, 57, spin, spin + 1.3)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(cx, cy, 57, spin + Math.PI, spin + Math.PI + 0.6)
        ctx.stroke()
        ctx.strokeStyle = rgba(0.7)
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, 33, -spin * 1.6, -spin * 1.6 + 2)
        ctx.stroke()
        ctx.lineCap = "butt"
        const cr = 15 + pulse * 6
        const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, cr)
        core.addColorStop(0, WHITE)
        core.addColorStop(0.5, rgba(1))
        core.addColorStop(1, rgba(0))
        ctx.fillStyle = core
        ctx.beginPath()
        ctx.arc(cx, cy, cr, 0, Math.PI * 2)
        ctx.fill()
        const look = Math.sin(tick / 25) * 4
        ctx.fillStyle = rage ? "#3a0010" : "#04223a"
        ctx.beginPath()
        oval(ctx, cx + look, cy, rage ? 2.5 : 4, 8, 0, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, rage ? "I can't let you do that" : "Listening...", cx, y + h - 2, 11, rgba(0.9), 600)
    },

    zune(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2, top = y + 6, bw = 84, bh = h - 10
        const sway = Math.sin(tick / 18) * 6
        ctx.lineCap = "round"
        for (const side of [-1, 1]) {
            const ex = cx + side * 90, ey = y + h * 0.58 + sway * side
            ctx.strokeStyle = "#e9e4dc"
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(cx + 22, top - 4)
            ctx.bezierCurveTo(cx + 22, top - 26, cx + side * 74, top - 22, ex, ey - 10)
            ctx.stroke()
            dot(ctx, ex, ey, 10, "#2a2420")
            dot(ctx, ex, ey, 8, "#f4f1ec")
            dot(ctx, ex - 2.5, ey - 2.5, 2.5, WHITE)
            const nt = (tick / 40 + (side > 0 ? 0.5 : 0)) % 1
            const nx = ex + side * (6 + nt * 10), ny = ey - 16 - nt * 34
            ctx.globalAlpha = 1 - nt
            dot(ctx, nx, ny, 3, "#ff9f43")
            line(ctx, [nx + 2.5, ny, nx + 2.5, ny - 10, nx + 7, ny - 7], "#ff9f43", 1.5)
            ctx.globalAlpha = 1
        }
        ctx.lineCap = "butt"
        fillRR(ctx, cx + 18, top - 7, 8, 9, 2, "#8a8f96")
        const body = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0)
        body.addColorStop(0, "#3a2412")
        body.addColorStop(0.3, "#8f5e31")
        body.addColorStop(0.55, "#6b4423")
        body.addColorStop(1, "#2b190a")
        fillRR(ctx, cx - bw / 2 - 2, top - 2, bw + 4, bh + 4, 16, "#1a0f05")
        fillRR(ctx, cx - bw / 2, top, bw, bh, 14, body)
        fillRR(ctx, cx - bw / 2 + 5, top + 3, 6, bh - 10, 3, "rgba(255,230,200,0.18)")
        fillRR(ctx, cx - bw / 2 + 8, top + 10, bw - 16, 54, 5, "#0b0806")
        fillRR(ctx, cx - bw / 2 + 10, top + 12, bw - 20, 50, 4, rage ? "#4a0a0e" : "#16222e")
        const look = Math.sin(tick / 25) * 2
        angryEye(ctx, cx - 14, top + 32, 7, look, rage ? 2 : 0, rage)
        angryEye(ctx, cx + 14, top + 32, 7, look, rage ? 2 : 0, rage)
        const songs = ["brown.wav", "squirt.mp3", "social.ogg"]
        text(ctx, "> " + songs[Math.floor(tick / 160) % songs.length], cx, top + 52, 9, rage ? "#ff8a80" : "#ff9f43", 700)
        fillRR(ctx, cx - 25, top + 70, 50, 46, 18, "#1e1208")
        fillRR(ctx, cx - 22, top + 73, 44, 40, 15, "#4a2f17")
        ctx.strokeStyle = "rgba(255,220,180,0.25)"
        ctx.lineWidth = 2
        rrect(ctx, cx - 22, top + 73, 44, 40, 15)
        ctx.stroke()
        const wa = tick / 12
        dot(ctx, cx + Math.cos(wa) * 15, top + 93 + Math.sin(wa) * 13, 3, "rgba(255,200,140,0.8)")
        dot(ctx, cx, top + 93, 7, "#2a1a0c")
    },

    ieboss(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2 + (rage ? Math.sin(tick * 1.3) * 2 : 0), cy = y + h * 0.52, r = 45
        const tilt = -0.32 + Math.sin(tick / 40) * 0.05
        const gold = ctx.createLinearGradient(cx - 100, 0, cx + 100, 0)
        gold.addColorStop(0, "#fff3a0")
        gold.addColorStop(0.5, "#f5b301")
        gold.addColorStop(1, "#b36b00")
        ctx.strokeStyle = gold
        ctx.lineWidth = 8
        ctx.beginPath()
        oval(ctx, cx, cy, 100, 27, tilt, Math.PI, Math.PI * 2)
        ctx.stroke()
        const blue = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
        blue.addColorStop(0, "#9ad8ff")
        blue.addColorStop(0.45, "#1e88e5")
        blue.addColorStop(1, "#0b3c8c")
        dot(ctx, cx, cy, r - 6, "#e3f2ff")
        ctx.lineWidth = 26
        ctx.strokeStyle = "#06244f"
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0.3 * Math.PI, 2 * Math.PI)
        ctx.stroke()
        ctx.fillStyle = "#06244f"
        ctx.fillRect(cx - r - 13, cy - 9, 2 * r + 26, 18)
        ctx.lineWidth = 22
        ctx.strokeStyle = blue
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0.3 * Math.PI + 0.02, 2 * Math.PI)
        ctx.stroke()
        ctx.fillStyle = blue
        ctx.fillRect(cx - r - 11, cy - 7, 2 * r + 22, 14)
        ctx.strokeStyle = "rgba(255,255,255,0.5)"
        ctx.lineWidth = 4
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.arc(cx, cy, r + 5, 1.05 * Math.PI, 1.55 * Math.PI)
        ctx.stroke()
        const look = Math.sin(tick / 25) * 2.5
        angryEye(ctx, cx - 13, cy - 18, 6.5, look, rage ? 2 : 0, rage)
        angryEye(ctx, cx + 13, cy - 18, 6.5, look, rage ? 2 : 0, rage)
        ctx.strokeStyle = INK
        ctx.lineWidth = 3
        ctx.beginPath()
        if (rage) ctx.arc(cx - 6, cy + 28, 9, 1.15 * Math.PI, 1.85 * Math.PI)
        else ctx.arc(cx - 6, cy + 13, 11, 0.2 * Math.PI, 0.8 * Math.PI)
        ctx.stroke()
        ctx.strokeStyle = gold
        ctx.lineWidth = 8
        ctx.lineCap = "butt"
        ctx.beginPath()
        oval(ctx, cx, cy, 100, 27, tilt, 0, Math.PI)
        ctx.stroke()
        ctx.strokeStyle = "rgba(255,255,255,0.6)"
        ctx.lineWidth = 2
        ctx.beginPath()
        oval(ctx, cx, cy, 100, 25, tilt, 0.2 * Math.PI, 0.7 * Math.PI)
        ctx.stroke()
        const sx = x + w - 14, sy = y + 10
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2
            const lit = (i - Math.floor(tick / 4)) & 7
            dot(ctx, sx + Math.cos(a) * 8, sy + Math.sin(a) * 8, 2.4, `rgba(${rage ? "255,95,86" : "155,216,255"},${1 - lit / 8})`)
        }
        ctx.textAlign = "right"
        ctx.fillStyle = rage ? "#ff8a80" : "#9ad8ff"
        ctx.font = "600 11px sans-serif"
        ctx.textBaseline = "middle"
        ctx.fillText(rage ? "(Not Responding)" : "Loading" + ".".repeat(Math.floor(tick / 15) % 4), sx - 14, sy)
    },

    bob(ctx, x, y, w, h, tick, rage) {
        const cx = x + w * 0.42, base = y + h, hw = 56, wallTop = y + 52
        const peek = 6 + Math.max(0, Math.sin(tick / 30)) * 18
        const rx = cx + hw + peek, ry = base - 40
        ctx.fillStyle = "#7a4a1c"
        ctx.beginPath()
        oval(ctx, rx - 6, ry - 6, 8, 16, 0.5 + Math.sin(tick / 9) * 0.15, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "#d9a05b"
        ctx.beginPath()
        oval(ctx, rx, ry, 20, 17, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "#f1cf9a"
        ctx.beginPath()
        oval(ctx, rx + 15, ry + 6, 12, 8, 0, 0, Math.PI * 2)
        ctx.fill()
        dot(ctx, rx + 25, ry + 3, 4, INK)
        if (rage) line(ctx, [rx + 2, ry - 12, rx + 12, ry - 7], INK, 2.5)
        dot(ctx, rx + 7, ry - 4, 3.5, INK)
        dot(ctx, rx + 8, ry - 5, 1.2, WHITE)
        if (!rage) fillRR(ctx, rx + 14, ry + 11, 6, 9, 3, "#ff7a8a")
        else line(ctx, [rx + 10, ry + 12, rx + 14, ry + 9, rx + 18, ry + 12, rx + 22, ry + 9], WHITE, 1.5)
        fillRR(ctx, cx + 22, y + 10, 14, 30, 2, "#8a3b2a")
        for (let i = 0; i < 3; i++) {
            const t = (tick / 50 + i / 3) % 1
            dot(ctx, cx + 29 + Math.sin(t * 6 + i) * 4, y + 6 - t * 30, 4 + t * 5, `rgba(220,220,230,${0.6 * (1 - t)})`)
        }
        const wall = ctx.createLinearGradient(0, wallTop, 0, base)
        wall.addColorStop(0, "#fff27a")
        wall.addColorStop(1, "#f0a800")
        fillRR(ctx, cx - hw, wallTop, hw * 2, base - wallTop, 5, wall)
        ctx.strokeStyle = "#7a4a00"
        ctx.lineWidth = 2.5
        rrect(ctx, cx - hw, wallTop, hw * 2, base - wallTop, 5)
        ctx.stroke()
        const roof = ctx.createLinearGradient(0, y, 0, wallTop)
        roof.addColorStop(0, "#ff6b5e")
        roof.addColorStop(1, "#a8231b")
        ctx.fillStyle = roof
        ctx.beginPath()
        ctx.moveTo(cx - hw - 14, wallTop + 4)
        ctx.lineTo(cx, y + 2)
        ctx.lineTo(cx + hw + 14, wallTop + 4)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = "#5a0f0a"
        ctx.stroke()
        ctx.fillStyle = "rgba(255,255,255,0.18)"
        for (let i = 1; i < 4; i++) ctx.fillRect(cx - hw * i / 4 - 6, y + 2 + i * 12, hw * i / 2 + 12, 2)
        dot(ctx, cx, y + 32, 7, "#5a0f0a")
        dot(ctx, cx, y + 32, 5, "#ffe9a8")
        const blink = tick % 220 < 8
        const look = Math.sin(tick / 25) * 3
        for (const ex of [cx - 26, cx + 26]) {
            fillRR(ctx, ex - 14, wallTop + 10, 28, 26, 5, "#7a4a00")
            fillRR(ctx, ex - 12, wallTop + 12, 24, 22, 4, "#e2f5ff")
            dot(ctx, ex + look, wallTop + 24, 6, "#1d4f91")
            dot(ctx, ex + look, wallTop + 24, 3, INK)
            dot(ctx, ex + look + 2, wallTop + 22, 1.5, WHITE)
            ctx.fillStyle = "#c26a1a"
            ctx.beginPath()
            if (blink) ctx.rect(ex - 12, wallTop + 12, 24, 22)
            else if (rage) {
                const s = ex < cx ? 1 : -1
                ctx.moveTo(ex - 12, wallTop + 12)
                ctx.lineTo(ex + 12, wallTop + 12)
                ctx.lineTo(ex + 12, wallTop + (s > 0 ? 24 : 16))
                ctx.lineTo(ex - 12, wallTop + (s > 0 ? 16 : 24))
                ctx.closePath()
            } else ctx.rect(ex - 12, wallTop + 12, 24, 5)
            ctx.fill()
        }
        dot(ctx, cx - 42, base - 22, 6, "rgba(255,110,110,0.45)")
        dot(ctx, cx + 42, base - 22, 6, "rgba(255,110,110,0.45)")
        ctx.fillStyle = "#8c1d14"
        ctx.beginPath()
        if (rage) {
            ctx.moveTo(cx - 22, base - 8)
            ctx.quadraticCurveTo(cx, base - 30, cx + 22, base - 8)
            ctx.quadraticCurveTo(cx, base - 20, cx - 22, base - 8)
        } else {
            ctx.moveTo(cx - 28, base - 30)
            ctx.quadraticCurveTo(cx, base - 2, cx + 28, base - 30)
            ctx.quadraticCurveTo(cx, base - 16, cx - 28, base - 30)
        }
        ctx.fill()
        if (!rage) fillRR(ctx, cx - 14, base - 26, 28, 5, 2, WHITE)
    },

    redring(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2, left = x + 10, top = y + 22, bw = w - 20, bh = h - 28
        ctx.lineCap = "round"
        for (let i = 0; i < 3; i++) {
            const t = (tick / 45 + i / 3) % 1, hx = cx - 40 + i * 40, hy = top - 4 - t * 22
            ctx.strokeStyle = `rgba(255,${rage ? 60 : 140},80,${0.6 * (1 - t)})`
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(hx, hy)
            ctx.bezierCurveTo(hx + 6, hy - 5, hx - 6, hy - 10, hx, hy - 15)
            ctx.stroke()
        }
        ctx.lineCap = "butt"
        const shell = ctx.createLinearGradient(0, top, 0, top + bh)
        shell.addColorStop(0, "#ffffff")
        shell.addColorStop(0.5, "#dfe3e8")
        shell.addColorStop(1, "#9aa2ac")
        fillRR(ctx, left - 2, top - 2, bw + 4, bh + 4, 16, "#3b4148")
        fillRR(ctx, left, top, bw, bh, 14, shell)
        fillRR(ctx, left + 10, top + 10, 44, bh - 20, 10, "#8a929c")
        ctx.fillStyle = "#4a5058"
        for (let gy = top + 18; gy < top + bh - 14; gy += 7) ctx.fillRect(left + 18, gy, 28, 3)
        const ringX = left + bw - 36, ringY = top + bh / 2
        const glow = ctx.createRadialGradient(ringX, ringY, 10, ringX, ringY, 42)
        const gp = 0.35 + 0.25 * Math.sin(tick / (rage ? 3 : 10))
        glow.addColorStop(0, `rgba(255,32,48,${gp})`)
        glow.addColorStop(1, "rgba(255,32,48,0)")
        ctx.fillStyle = glow
        ctx.fillRect(ringX - 42, ringY - 42, 84, 84)
        dot(ctx, ringX, ringY, 22, "#7d858f")
        dot(ctx, ringX, ringY, 20, "#c9ced4")
        dot(ctx, ringX, ringY, 12, "#f2f4f6")
        ctx.strokeStyle = "#7d858f"
        ctx.lineWidth = 2.5
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.arc(ringX, ringY, 6, -0.3 * Math.PI, 1.3 * Math.PI)
        ctx.stroke()
        line(ctx, [ringX, ringY - 9, ringX, ringY - 2], "#7d858f", 2.5)
        const rot = tick / (rage ? 6 : 14)
        ctx.lineWidth = 6
        for (let q = 0; q < 4; q++) {
            const a0 = rot + q * Math.PI / 2 + 0.14
            const lit = rage ? tick % 16 < 10 : q < 3
            ctx.strokeStyle = lit ? "#ff2030" : "#3a3f46"
            ctx.beginPath()
            ctx.arc(ringX, ringY, 16, a0, a0 + Math.PI / 2 - 0.28)
            ctx.stroke()
        }
        ctx.lineCap = "butt"
        const fx = left + 64 + (ringX - 22 - left - 64) / 2
        const look = Math.sin(tick / 25) * 3
        angryEye(ctx, fx - 18, top + 30, 9, look, rage ? 3 : 1, rage)
        angryEye(ctx, fx + 18, top + 30, 9, look, rage ? 3 : 1, rage)
        fillRR(ctx, fx - 32, top + 54, 64, 10, 4, "#1b1f24")
        ctx.fillStyle = "#f2f4f6"
        for (let i = 0; i < 6; i++) ctx.fillRect(fx - 28 + i * 10, top + 55, 6, rage ? 4 : 2)
        text(ctx, "E74", fx, top + bh - 9, 9, rage ? "#ff2030" : "#6b7380", 800)
    },

    teamsboss(ctx, x, y, w, h, tick, rage) {
        const ts = 94, tx = x + 44, ty = y + 30
        dot(ctx, tx + ts - 2, ty - 6, 15, "#3d44a8")
        dot(ctx, tx + ts + 20, ty + 4, 11, "#5059c9")
        const tile = ctx.createLinearGradient(tx, ty, tx + ts, ty + ts)
        tile.addColorStop(0, "#9aa1f5")
        tile.addColorStop(1, "#444cb5")
        fillRR(ctx, tx - 2, ty - 2, ts + 4, ts + 4, 20, "#262a6e")
        fillRR(ctx, tx, ty, ts, ts, 18, tile)
        fillRR(ctx, tx + 8, ty + 6, ts - 16, 8, 4, "rgba(255,255,255,0.2)")
        const camX = tx + ts / 2 + 10, camY = ty - 4
        fillRR(ctx, camX - 24, camY - 12, 48, 24, 12, "#14162a")
        dot(ctx, camX, camY, 10, "#05060c")
        const look = Math.sin(tick / 22) * 3, lookY = Math.cos(tick / 33) * 1.5
        dot(ctx, camX + look, camY + lookY, 6, rage ? "#ff2030" : "#5bc0ff")
        dot(ctx, camX + look, camY + lookY, 2.5, INK)
        dot(ctx, camX + look + 2, camY + lookY - 2, 1.5, WHITE)
        dot(ctx, camX + 17, camY - 4, 2.5, tick % 60 < 30 ? "#ff2030" : "#4a1014")
        fillRR(ctx, tx - 24, ty + 24, 58, 58, 9, "#1d2060")
        fillRR(ctx, tx - 22, ty + 26, 54, 54, 7, "#5b62d6")
        text(ctx, "T", tx + 5, ty + 54, 40, WHITE, 900)
        ctx.strokeStyle = "#1d2060"
        ctx.lineWidth = 3
        ctx.lineCap = "round"
        ctx.beginPath()
        if (rage) ctx.arc(tx + ts * 0.68, ty + ts * 0.84, 10, 1.15 * Math.PI, 1.85 * Math.PI)
        else ctx.arc(tx + ts * 0.68, ty + ts * 0.6, 12, 0.2 * Math.PI, 0.8 * Math.PI)
        ctx.stroke()
        ctx.lineCap = "butt"
        dot(ctx, tx + ts - 6, ty + ts - 6, 10, "#1d2060")
        dot(ctx, tx + ts - 6, ty + ts - 6, 7, rage ? "#ff2030" : tick % 300 < 200 ? "#39d353" : "#ffb900")
        const msgs = rage ? ["Let's circle back!!"] : ["You're on mute", "Can you see my screen?", "Quick sync?"]
        speech(ctx, x + w * 0.58, y - 8, w * 0.66, 30, msgs[Math.floor(tick / 180) % msgs.length], x + w * 0.66)
    },

    kinect(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2, by = y + 22, bh = 40, bw = 204
        const look = Math.sin(tick / 22) * 5, lookY = Math.cos(tick / 31) * 2
        const cone = ctx.createLinearGradient(0, by + bh, 0, y + h + 10)
        cone.addColorStop(0, rage ? "rgba(255,32,48,0.3)" : "rgba(255,60,80,0.16)")
        cone.addColorStop(1, "rgba(255,60,80,0)")
        ctx.fillStyle = cone
        ctx.beginPath()
        ctx.moveTo(cx - 70 + look * 3, by + bh)
        ctx.lineTo(cx + 60 + look * 3, by + bh)
        ctx.lineTo(cx + 110 + look * 6, y + h + 10)
        ctx.lineTo(cx - 120 + look * 6, y + h + 10)
        ctx.closePath()
        ctx.fill()
        for (let i = 0; i < 26; i++) {
            const t = ((i * 0.618 + tick / 90) % 1)
            const px = cx + look * 4 + (((i * 47) % 100) / 100 - 0.5) * (130 + t * 90)
            dot(ctx, px, by + bh + 6 + t * (h - bh - 10), 1.3, `rgba(255,80,96,${0.7 * (1 - t)})`)
        }
        fillRR(ctx, cx - 9, by + bh - 4, 18, h - bh - 30, 3, "#16181c")
        const base = ctx.createLinearGradient(0, y + h - 20, 0, y + h)
        base.addColorStop(0, "#3a3d44")
        base.addColorStop(1, "#0d0e11")
        ctx.fillStyle = base
        ctx.beginPath()
        oval(ctx, cx, y + h - 10, 46, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        const bar = ctx.createLinearGradient(0, by, 0, by + bh)
        bar.addColorStop(0, "#4a4e57")
        bar.addColorStop(0.35, "#15171b")
        bar.addColorStop(1, "#24272d")
        fillRR(ctx, cx - bw / 2 - 2, by - 2, bw + 4, bh + 4, 20, "#000000")
        fillRR(ctx, cx - bw / 2, by, bw, bh, 18, bar)
        fillRR(ctx, cx - bw / 2 + 14, by + 3, bw - 28, 5, 3, "rgba(255,255,255,0.16)")
        const lenses = [[cx - 64, 10, rage ? "#ff2030" : "#b3263a"], [cx - 22, 12, rage ? "#ff2030" : "#3fb6ff"], [cx + 46, 12, rage ? "#ff2030" : "#8e5cff"]]
        for (const [lx, r, col] of lenses) {
            const ly = by + bh / 2
            dot(ctx, lx, ly, r + 3, "#050506")
            dot(ctx, lx, ly, r, "#1a1f2e")
            dot(ctx, lx + look * r / 12, ly + lookY, r * 0.55, col)
            dot(ctx, lx + look * r / 12, ly + lookY, r * 0.25, INK)
            dot(ctx, lx + look * r / 12 + r * 0.25, ly + lookY - r * 0.25, r * 0.15, WHITE)
        }
        if (rage) for (const lx of [cx - 64, cx - 22, cx + 46]) line(ctx, [lx - 14, by + 4, lx + 12, by + 10], "#ff2030", 3)
        dot(ctx, cx + 84, by + bh / 2, 3.5, rage ? (tick % 10 < 5 ? "#ff2030" : "#4a1014") : tick % 50 < 40 ? "#39ff8f" : "#1a5a33")
        text(ctx, rage ? "PLAYER NOT DETECTED" : "Please move back", x + w * 0.2, y + h - 6, 10, rage ? "#ff5f56" : "#9CA3AF", 700)
    },

    uac(ctx, x, y, w, h, tick, rage) {
        const shake = rage ? Math.sin(tick * 2.1) * 2.5 : 0
        const wx = x + 8 + shake, wy = y + 2, ww = w - 16, wh = h - 6
        fillRR(ctx, x - 10, y - 8, w + 20, h + 14, 8, "rgba(0,0,0,0.45)")
        fillRR(ctx, wx + 4, wy + 5, ww, wh, 6, "rgba(0,0,0,0.5)")
        fillRR(ctx, wx - 1, wy - 1, ww + 2, wh + 2, 7, "#26303c")
        fillRR(ctx, wx, wy, ww, wh, 6, "#eef1f5")
        const title = ctx.createLinearGradient(0, wy, 0, wy + 22)
        title.addColorStop(0, rage ? "#ff5a4e" : "#4a8ae6")
        title.addColorStop(1, rage ? "#a3110a" : "#1f4fa3")
        fillRR(ctx, wx, wy, ww, 22, 6, title)
        ctx.fillRect(wx, wy + 14, ww, 8)
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        ctx.font = "700 11px sans-serif"
        ctx.fillStyle = WHITE
        ctx.fillText("User Account Control", wx + 8, wy + 11)
        fillRR(ctx, wx + ww - 28, wy + 3, 24, 16, 3, "#c42b1c")
        text(ctx, "x", wx + ww - 16, wy + 10, 12, WHITE, 800)
        const sx = wx + 32, sy = wy + 56
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(sx, sy - 24)
        ctx.quadraticCurveTo(sx + 12, sy - 18, sx + 22, sy - 19)
        ctx.quadraticCurveTo(sx + 24, sy + 12, sx, sy + 26)
        ctx.quadraticCurveTo(sx - 24, sy + 12, sx - 22, sy - 19)
        ctx.quadraticCurveTo(sx - 12, sy - 18, sx, sy - 24)
        ctx.closePath()
        ctx.fillStyle = "#1e5fc9"
        ctx.fill()
        ctx.clip()
        ctx.fillStyle = "#ffc20e"
        ctx.fillRect(sx, sy - 26, 26, 26)
        ctx.fillRect(sx - 26, sy, 26, 28)
        ctx.restore()
        ctx.strokeStyle = "#0f1b2d"
        ctx.lineWidth = 2
        ctx.stroke()
        const look = Math.sin(tick / 25) * 1.5
        angryEye(ctx, sx - 9, sy + 1, 5, look, rage ? 2 : 0, rage)
        angryEye(ctx, sx + 9, sy + 1, 5, look, rage ? 2 : 0, rage)
        if (rage) text(ctx, "ALLOW?!", wx + ww * 0.62, wy + 48, 24, "#c42b1c", 900)
        else {
            text(ctx, "Allow this app to", wx + ww * 0.62, wy + 38, 12, "#1b2733", 600)
            text(ctx, "make changes?", wx + ww * 0.62, wy + 56, 14, "#1b2733", 800)
        }
        const bty = wy + wh - 30, yesX = wx + ww * 0.36, noX = wx + ww * 0.68, bw = 56
        const pulse = 0.5 + 0.5 * Math.sin(tick / 8)
        fillRR(ctx, yesX - 2, bty - 2, bw + 4, 26, 5, `rgba(63,140,255,${0.4 + pulse * 0.6})`)
        fillRR(ctx, yesX, bty, bw, 22, 4, "#e1ecfb")
        text(ctx, "Yes", yesX + bw / 2, bty + 11, 12, "#0f3c8c", 800)
        fillRR(ctx, noX, bty, bw, 22, 4, "#d6dbe1")
        text(ctx, rage ? "Yes" : "No", noX + bw / 2, bty + 11, 12, "#4a5260", 700)
        const ct = (Math.sin(tick / 30) + 1) / 2
        const mx = noX + bw * 0.6 + (yesX + bw * 0.6 - noX - bw * 0.6) * ct, my = bty + 14
        ctx.fillStyle = WHITE
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(mx, my)
        ctx.lineTo(mx, my + 16)
        ctx.lineTo(mx + 4, my + 12)
        ctx.lineTo(mx + 8, my + 19)
        ctx.lineTo(mx + 10, my + 18)
        ctx.lineTo(mx + 7, my + 11)
        ctx.lineTo(mx + 12, my + 11)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
    },

    copilotboss(ctx, x, y, w, h, tick, rage) {
        const cx = x + w / 2, cy = y + h * 0.5, R = 48
        const sparkCols = ["#20c4c4", "#8b5cf6", "#ff5fa8", "#ffb347", "#3b7bff"]
        for (let i = 0; i < 5; i++) {
            const a = tick / 60 + i * 1.2566
            const sx = cx + Math.cos(a) * 94, sy = cy + Math.sin(a) * 50
            const s = 4 + 2.5 * Math.sin(tick / 8 + i)
            ctx.fillStyle = sparkCols[i]
            ctx.beginPath()
            ctx.moveTo(sx, sy - s * 2)
            ctx.quadraticCurveTo(sx, sy, sx + s * 2, sy)
            ctx.quadraticCurveTo(sx, sy, sx, sy + s * 2)
            ctx.quadraticCurveTo(sx, sy, sx - s * 2, sy)
            ctx.quadraticCurveTo(sx, sy, sx, sy - s * 2)
            ctx.fill()
        }
        ctx.beginPath()
        for (let i = 0; i <= 60; i++) {
            const th = i / 60 * Math.PI * 2
            let rr = R + Math.sin(3 * th + tick / 14) * 5 + Math.sin(5 * th - tick / 9) * 3
            if (rage) rr += Math.max(0, Math.sin(9 * th + tick / 4)) * 9
            const px = cx + Math.cos(th) * rr * 1.18, py = cy + Math.sin(th) * rr * 0.95
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
        }
        ctx.closePath()
        const ga = tick / 50
        const body = ctx.createLinearGradient(cx - Math.cos(ga) * 60, cy - Math.sin(ga) * 60, cx + Math.cos(ga) * 60, cy + Math.sin(ga) * 60)
        body.addColorStop(0, "#20c4c4")
        body.addColorStop(0.3, "#3b7bff")
        body.addColorStop(0.55, "#8b5cf6")
        body.addColorStop(0.8, "#ff5fa8")
        body.addColorStop(1, "#ffb347")
        ctx.fillStyle = body
        ctx.fill()
        ctx.strokeStyle = rage ? "rgba(255,40,60,0.9)" : "rgba(255,255,255,0.5)"
        ctx.lineWidth = 2.5
        ctx.stroke()
        const sw = tick / 25
        ctx.lineCap = "round"
        ctx.strokeStyle = "rgba(255,255,255,0.35)"
        ctx.lineWidth = 7
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.72, sw, sw + 2.2)
        ctx.stroke()
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.45, -sw * 1.4, -sw * 1.4 + 1.8)
        ctx.stroke()
        ctx.lineCap = "butt"
        const look = Math.sin(tick / 25) * 3
        if (rage) {
            angryEye(ctx, cx - 17, cy - 8, 10, look, 3, true)
            angryEye(ctx, cx + 17, cy - 8, 10, look, 3, true)
        } else {
            for (const ex of [cx - 17, cx + 17]) {
                ctx.fillStyle = WHITE
                ctx.beginPath()
                oval(ctx, ex, cy - 8, 9, 12, 0, 0, Math.PI * 2)
                ctx.fill()
                dot(ctx, ex + look, cy - 6, 5, "#1b1440")
                dot(ctx, ex + look + 2, cy - 9, 1.8, WHITE)
            }
        }
        ctx.strokeStyle = "#1b1440"
        ctx.lineWidth = 3
        ctx.lineCap = "round"
        ctx.beginPath()
        if (rage) ctx.arc(cx, cy + 24, 9, 1.15 * Math.PI, 1.85 * Math.PI)
        else ctx.arc(cx, cy + 8, 10, 0.2 * Math.PI, 0.8 * Math.PI)
        ctx.stroke()
        ctx.lineCap = "butt"
    }
}

const MINI_ICON = {
    clippy(ctx, x, y) {
        ctx.strokeStyle = "#c0c8d2"
        ctx.lineWidth = 3
        rrect(ctx, x - 5, y - 9, 10, 18, 5)
        ctx.stroke()
        dot(ctx, x - 2, y - 3, 1.5, INK)
        dot(ctx, x + 2, y - 3, 1.5, INK)
    },
    bsod(ctx, x, y) {
        fillRR(ctx, x - 10, y - 8, 20, 15, 2, "#1e40ff")
        text(ctx, ":(", x, y, 9, WHITE, 400)
    },
    winupdate(ctx, x, y) {
        const c = ["#f25022", "#7fba00", "#00a4ef", "#ffb900"]
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = c[i]
            ctx.fillRect(x - 8 + (i % 2) * 9, y - 8 + Math.floor(i / 2) * 9, 7, 7)
        }
    },
    cortanaboss(ctx, x, y) {
        ctx.strokeStyle = "#3fb6ff"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.stroke()
        dot(ctx, x, y, 3, WHITE)
    },
    zune(ctx, x, y) {
        fillRR(ctx, x - 6, y - 10, 12, 20, 3, "#7a4c24")
        ctx.fillStyle = "#16222e"
        ctx.fillRect(x - 4, y - 8, 8, 7)
        dot(ctx, x, y + 5, 3, "#2b190a")
    },
    ieboss(ctx, x, y) {
        text(ctx, "e", x, y - 1, 22, "#1e88e5", 900)
        ctx.strokeStyle = "#f5b301"
        ctx.lineWidth = 2
        ctx.beginPath()
        oval(ctx, x, y, 12, 4, -0.35, 0, Math.PI * 2)
        ctx.stroke()
    },
    bob(ctx, x, y) {
        ctx.fillStyle = "#c0392b"
        ctx.beginPath()
        ctx.moveTo(x - 10, y - 1)
        ctx.lineTo(x, y - 10)
        ctx.lineTo(x + 10, y - 1)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = "#ffd400"
        ctx.fillRect(x - 7, y - 2, 14, 11)
        dot(ctx, x - 3, y + 2, 1.3, INK)
        dot(ctx, x + 3, y + 2, 1.3, INK)
    },
    redring(ctx, x, y) {
        dot(ctx, x, y, 9, "#dfe3e8")
        ctx.strokeStyle = "#ff2030"
        ctx.lineWidth = 2.5
        for (let q = 0; q < 3; q++) {
            ctx.beginPath()
            ctx.arc(x, y, 6, q * Math.PI / 2 + 0.2, (q + 1) * Math.PI / 2 - 0.2)
            ctx.stroke()
        }
    },
    teamsboss(ctx, x, y) {
        fillRR(ctx, x - 9, y - 9, 18, 18, 4, "#5b62d6")
        text(ctx, "T", x, y + 1, 13, WHITE, 900)
    },
    kinect(ctx, x, y) {
        fillRR(ctx, x - 12, y - 4, 24, 8, 4, "#15171b")
        for (const dx of [-6, -1, 5]) dot(ctx, x + dx, y, 1.8, dx === -1 ? "#3fb6ff" : "#ff2030")
    },
    uac(ctx, x, y) {
        ctx.fillStyle = "#1e5fc9"
        ctx.beginPath()
        ctx.moveTo(x, y - 9)
        ctx.lineTo(x + 8, y - 6)
        ctx.quadraticCurveTo(x + 8, y + 5, x, y + 10)
        ctx.quadraticCurveTo(x - 8, y + 5, x - 8, y - 6)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = "#ffc20e"
        ctx.fillRect(x, y - 8, 7, 8)
        ctx.fillRect(x - 7, y, 7, 7)
    },
    copilotboss(ctx, x, y) {
        dot(ctx, x - 3, y, 7, "#3b7bff")
        dot(ctx, x + 3, y, 7, "#ff5fa8")
        dot(ctx, x, y - 3, 5, "#8b5cf6")
        dot(ctx, x - 3, y - 1, 1.6, WHITE)
        dot(ctx, x + 3, y - 1, 1.6, WHITE)
    }
}

export const MINI_ICON_TYPES = Object.keys(MINI_ICON)

export const BOSS_ACCENT = {
    clippy: "#c0c8d2", cortanaboss: "#3fb6ff", zune: "#ff9f43", bsod: "#1e40ff",
    ieboss: "#f5b301", bob: "#ffd400", redring: "#ff2030", teamsboss: "#7b83eb",
    winupdate: "#00a4ef", kinect: "#39ff8f", uac: "#ffc20e", copilotboss: "#ff5fa8"
}

// k = how many bosses the player has met; later ones get a bigger aura and
// horns. A fusion boss has the guest's icons orbiting and its colour aura.
export function drawBoss(ctx, type, x, y, w, h, hpFrac, tick, k, guest) {
    const fn = BOSS_DRAW[type]
    if (!fn) return
    k = k || 1
    const rage = hpFrac < 0.3
    const cx = x + w / 2, cy = y + h / 2
    const pulse = 0.5 + 0.5 * Math.sin(tick / (rage ? 5 : 12))
    const [r, g, b] = hexToRgb(guest ? BOSS_ACCENT[guest] : "#ff2030")

    const auraR = w * (0.55 + Math.min(k, 8) * 0.04)
    const aura = ctx.createRadialGradient(cx, cy, w * 0.15, cx, cy, auraR)
    aura.addColorStop(0, `rgba(${r},${g},${b},${0.12 + Math.min(k, 8) * 0.04 + pulse * 0.08})`)
    aura.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = aura
    ctx.fillRect(cx - auraR, cy - auraR, auraR * 2, auraR * 2)

    if (k >= 7) {
        ctx.fillStyle = "#ff2030"
        for (const side of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(cx + side * w * 0.22, y + 8)
            ctx.quadraticCurveTo(cx + side * w * 0.42, y - 10, cx + side * w * 0.36, y - 34)
            ctx.quadraticCurveTo(cx + side * w * 0.3, y - 8, cx + side * w * 0.12, y + 10)
            ctx.closePath()
            ctx.fill()
        }
    }

    ctx.save()
    fn(ctx, x, y, w, h, tick, rage)
    ctx.restore()

    if (guest) {
        for (let i = 0; i < 2; i++) {
            const a = tick / 25 + i * Math.PI
            const mx = cx + Math.cos(a) * w * 0.6, my = cy + Math.sin(a) * h * 0.55
            dot(ctx, mx, my, 16, `rgba(${r},${g},${b},${0.25 + pulse * 0.2})`)
            ctx.save()
            ctx.translate(mx, my)
            ctx.scale(1.3, 1.3)
            MINI_ICON[guest](ctx, 0, 0)
            ctx.restore()
        }
    }

    fillRR(ctx, x, y + h + 10, w, 9, 4, "#3a0a0a")
    if (hpFrac > 0) fillRR(ctx, x, y + h + 10, w * hpFrac, 9, 4, hpFrac > 0.3 ? "#ff5f56" : "#ffb454")
    if (guest) text(ctx, "FUSION", x + w + 30, y + h + 14, 11, BOSS_ACCENT[guest], 800)
}

export function drawPlayer(ctx, x, y, w, h, shielded, tick) {
    const cx = x + w / 2
    const flame = 4 + ((tick || 0) % 6)
    const fire = ctx.createLinearGradient(0, y + h, 0, y + h + flame + 6)
    fire.addColorStop(0, "#fffd6b")
    fire.addColorStop(1, "rgba(255,95,86,0)")
    ctx.fillStyle = fire
    for (const fx of [cx - w * 0.22, cx + w * 0.22]) {
        ctx.beginPath()
        ctx.moveTo(fx - 4, y + h - 2)
        ctx.lineTo(fx + 4, y + h - 2)
        ctx.lineTo(fx, y + h + flame + 6)
        ctx.closePath()
        ctx.fill()
    }

    const hull = ctx.createLinearGradient(x, 0, x + w, 0)
    hull.addColorStop(0, "#1a7a44")
    hull.addColorStop(0.5, "#39ff8f")
    hull.addColorStop(1, "#1a7a44")
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx + w * 0.16, y + h * 0.35)
    ctx.lineTo(x + w, y + h * 0.8)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(cx + w * 0.12, y + h * 0.85)
    ctx.lineTo(cx - w * 0.12, y + h * 0.85)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + h * 0.8)
    ctx.lineTo(cx - w * 0.16, y + h * 0.35)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = "#b8ffd6"
    ctx.lineWidth = 1
    ctx.stroke()

    dot(ctx, cx, y + h * 0.5, 7, INK)
    dot(ctx, cx, y + h * 0.58, 4.5, "#f2f2f2")
    dot(ctx, cx - 2.2, y + h * 0.4, 1.4, WHITE)
    dot(ctx, cx + 2.2, y + h * 0.4, 1.4, WHITE)
    ctx.fillStyle = "#ffb454"
    ctx.beginPath()
    ctx.moveTo(cx - 2.5, y + h * 0.5); ctx.lineTo(cx + 2.5, y + h * 0.5); ctx.lineTo(cx, y + h * 0.62)
    ctx.closePath()
    ctx.fill()

    if (shielded) {
        ctx.strokeStyle = "rgba(91,192,255,0.8)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, y + h * 0.6, w * 0.7, Math.PI, 0)
        ctx.stroke()
    }
}

const POWERUP_STYLE = {
    sudo: ["#ff5f56", "sudo"],
    pacman: ["#1793d1", "-Syu"],
    firewall: ["#ffb454", "FW"],
    bomb: ["#ff8c00", "-9"],
    laser: ["#c040fb", "grep"],
    homing: ["#00b8d4", "ssh"],
    freeze: ["#4fc3f7", "STOP"],
    double: ["#e6b800", "2x"],
    nuke: ["#ff1744", "rm"],
    oneup: ["#22c55e", "1UP"]
}

const PLAYER_BULLET = { bomb: "#ff8c00", laser: "#e040fb", homing: "#00e5ff" }

export function drawPlayerBullet(ctx, kind, x, y, w, h) {
    if (kind === "bomb") {
        dot(ctx, x + w / 2, y + 5, 5, PLAYER_BULLET.bomb)
        dot(ctx, x + w / 2, y + 5, 2, "#fff3c4")
        return
    }
    ctx.fillStyle = PLAYER_BULLET[kind] || "#fffd6b"
    ctx.fillRect(x, y, w, h)
}

export function drawPowerup(ctx, type, x, y, size) {
    const style = POWERUP_STYLE[type]
    if (!style) return
    fillRR(ctx, x, y, size * 1.6, size, 5, style[0])
    text(ctx, style[1], x + size * 0.8, y + size / 2 + 1, size * 0.5, WHITE, 800)
}

export function drawBunkerCell(ctx, x, y, size, hp) {
    ctx.fillStyle = hp >= 3 ? "#39ff8f" : hp === 2 ? "#2bbf6b" : "#1a7a44"
    ctx.fillRect(x, y, size, size)
}

export function drawEnemyBullet(ctx, sourceType, x, y, w, h) {
    if (sourceType === "clippy") {
        ctx.strokeStyle = "#c0c8d2"
        ctx.lineWidth = 2.5
        rrect(ctx, x - 4, y - 7, 8, 14, 4)
        ctx.stroke()
    } else if (sourceType === "bsod") {
        fillRR(ctx, x - w / 2, y - h / 2, w, h, 3, "#1e40ff")
        text(ctx, ":(", x, y, h * 0.8, WHITE, 500)
    } else if (sourceType === "winupdate") {
        fillRR(ctx, x - w / 2, y - h / 2, w, h, 4, "#0b1a2e")
        fillRR(ctx, x - w / 2 + 2, y - h / 2 + 2, (w - 4) * 0.7, h - 4, 3, "#39ff8f")
    } else if (sourceType === "cortanaboss") {
        ctx.strokeStyle = "#3fb6ff"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, w / 2 - 2, 0, Math.PI * 2)
        ctx.stroke()
        dot(ctx, x, y, 2, WHITE)
    } else if (sourceType === "zune") {
        fillRR(ctx, x - w / 2, y - h / 2, w, h, 3, "#ff9f43")
        dot(ctx, x, y + 1, w * 0.22, "#3a1d05")
    } else if (sourceType === "ieboss") {
        dot(ctx, x, y, w / 2, "#1e90ff")
        ctx.strokeStyle = "#f5b301"
        ctx.lineWidth = 2
        ctx.beginPath()
        oval(ctx, x, y, w * 0.62, h * 0.24, -0.4, 0, Math.PI * 2)
        ctx.stroke()
        text(ctx, "e", x, y, h * 0.8, WHITE, 800)
    } else if (sourceType === "bob") {
        ctx.fillStyle = "#f4e3c1"
        ctx.fillRect(x - 2, y - 5, 4, 10)
        for (const sy of [-5, 5]) {
            dot(ctx, x - 2, y + sy, 2.5, "#f4e3c1")
            dot(ctx, x + 2, y + sy, 2.5, "#f4e3c1")
        }
    } else if (sourceType === "redring") {
        dot(ctx, x, y, w / 2, "#ff2030")
        dot(ctx, x, y, w / 4, "#3a0a0a")
    } else if (sourceType === "teamsboss") {
        fillRR(ctx, x - w / 2, y - h / 2, w, h, 7, "#7b83eb")
        ctx.beginPath(); ctx.moveTo(x - w / 4, y + h / 2 - 1); ctx.lineTo(x - w / 3, y + h / 2 + 6); ctx.lineTo(x - w / 8, y + h / 2 - 1); ctx.fill()
        fillRR(ctx, x - 3, y - h * 0.32, 6, h * 0.42, 3, WHITE)
        line(ctx, [x - 6, y + h * 0.05, x - 6, y + h * 0.12, x + 6, y + h * 0.12, x + 6, y + h * 0.05], WHITE, 1.5)
        line(ctx, [x - 8, y + h * 0.3, x + 8, y - h * 0.34], "#ff5f56", 2.5)
    } else if (sourceType === "copilotboss") {
        ctx.fillStyle = "#ff5fa8"
        ctx.beginPath()
        ctx.moveTo(x, y - 7); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x + 7, y); ctx.lineTo(x + 2, y + 2)
        ctx.lineTo(x, y + 7); ctx.lineTo(x - 2, y + 2); ctx.lineTo(x - 7, y); ctx.lineTo(x - 2, y - 2)
        ctx.closePath()
        ctx.fill()
        dot(ctx, x, y, 1.5, WHITE)
    } else if (sourceType === "outlook") {
        ctx.fillStyle = "#3b9ef5"
        ctx.fillRect(x - 6, y - 4, 12, 8)
        line(ctx, [x - 6, y - 4, x, y, x + 6, y - 4], WHITE, 1)
    } else if (sourceType === "teams" || sourceType === "skype") {
        fillRR(ctx, x - 6, y - 5, 12, 8, 3, sourceType === "teams" ? "#7b83eb" : "#00aff0")
        ctx.beginPath(); ctx.moveTo(x - 3, y + 3); ctx.lineTo(x - 5, y + 7); ctx.lineTo(x, y + 3); ctx.fill()
    } else {
        ctx.fillStyle = "#ff5f56"
        ctx.beginPath()
        ctx.moveTo(x, y - 7); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x - 1, y); ctx.lineTo(x + 2, y + 7)
        ctx.lineTo(x - 3, y + 1); ctx.lineTo(x + 1, y)
        ctx.closePath()
        ctx.fill()
    }
}

export function drawUacWall(ctx, x, y, w, h, hp) {
    fillRR(ctx, x, y, w, h, 4, "#ffc20e")
    fillRR(ctx, x + 2, y + 2, w - 4, h - 4, 3, hp >= 3 ? "#1f3b73" : hp === 2 ? "#2a3550" : "#3a2a30")
    const sx = x + 13, sy = y + h / 2
    ctx.fillStyle = "#ffc20e"
    ctx.beginPath()
    ctx.moveTo(sx - 6, sy - 7); ctx.lineTo(sx + 6, sy - 7); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx, sy + 7); ctx.lineTo(sx - 6, sy)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#1e90ff"
    ctx.fillRect(sx - 6, sy - 7, 6, 7)
    text(ctx, "Allow?", x + w / 2 + 8, y + h / 2 + 1, 11, WHITE, 700)
    if (hp < 3) line(ctx, [x + w * 0.55, y + 2, x + w * 0.5, y + h * 0.5, x + w * 0.6, y + h - 2], "rgba(255,255,255,0.6)", 1)
}

export function drawPuppy(ctx, x, y, w, h, frame) {
    const fur = "#d9a441"
    ctx.fillStyle = fur
    ctx.beginPath()
    oval(ctx, x + w * 0.45, y + h * 0.55, w * 0.32, h * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    dot(ctx, x + w * 0.74, y + h * 0.34, h * 0.24, fur)
    ctx.fillStyle = "#8a5a1c"
    ctx.beginPath()
    oval(ctx, x + w * 0.66, y + h * 0.36, w * 0.07, h * 0.2, 0.3, 0, Math.PI * 2)
    ctx.fill()
    dot(ctx, x + w * 0.8, y + h * 0.3, 1.6, INK)
    dot(ctx, x + w * 0.94, y + h * 0.4, 2, INK)
    ctx.fillStyle = fur
    const step = frame ? 2 : -2
    for (const [lx, d] of [[0.25, step], [0.38, -step], [0.55, step], [0.66, -step]])
        ctx.fillRect(x + w * lx + d * 0.5, y + h * 0.7, 3, h * 0.3)
    line(ctx, [x + w * 0.14, y + h * 0.5, x + w * 0.02, y + h * 0.3 + step], fur, 2.5)
}

export function drawKinectBeam(ctx, x, w, top, bottom, tele, active) {
    const cx = x + w / 2
    if (tele > 0) {
        const urgent = tele < 15 && tele % 4 < 2
        line(ctx, [cx, top, cx, bottom], urgent ? "rgba(255,95,86,0.7)" : "rgba(57,255,143,0.28)", urgent ? 2 : 1)
        return
    }
    const fade = Math.min(1, active / 5)
    ctx.fillStyle = `rgba(57,255,143,${0.35 * fade})`
    ctx.fillRect(x, top, w, bottom - top)
    ctx.fillStyle = `rgba(220,255,235,${0.85 * fade})`
    ctx.fillRect(cx - 3, top, 6, bottom - top)
}
