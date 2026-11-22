const TIER_STATS = { 1: [1, 10], 2: [1, 20], 3: [2, 30], 4: [2, 50] }

const NAMES = {
    1: { word: "Word", excel: "Excel", powerpoint: "PowerPoint", onenote: "OneNote", notepad: "Notepad", paint: "Paint",
         calculator: "Calculator", solitaire: "Solitaire", minesweeper: "Minesweeper", stickynotes: "Sticky Notes",
         snippingtool: "Snipping Tool", wordpad: "WordPad" },
    2: { outlook: "Outlook", teams: "Teams", skype: "Skype", onedrive: "OneDrive", access: "Access", publisher: "Publisher",
         sharepoint: "SharePoint", visio: "Visio", project: "Project", planner: "Planner", msn: "MSN" },
    3: { edge: "Edge", ie: "Internet Explorer", bing: "Bing", cortana: "Cortana", defender: "Defender",
         mediaplayer: "Media Player", moviemaker: "Movie Maker", silverlight: "Silverlight", groove: "Groove Music" },
    4: { windows: "Windows", xbox: "Xbox", azure: "Azure", visualstudio: "Visual Studio", copilot: "Copilot",
         sqlserver: "SQL Server", dynamics: "Dynamics 365", hololens: "HoloLens" }
}

const UNLOCK_AT = {
    4: ["minesweeper", "stickynotes", "outlook"],
    7: ["snippingtool", "teams", "edge"],
    10: ["wordpad", "skype", "ie"],
    13: ["onedrive", "windows"],
    16: ["access", "bing"],
    19: ["xbox", "publisher"],
    22: ["sharepoint", "cortana"],
    25: ["visio", "defender", "azure"],
    28: ["project", "mediaplayer"],
    31: ["planner", "visualstudio"],
    34: ["msn", "silverlight"],
    37: ["groove", "moviemaker"],
    40: ["sqlserver", "copilot"],
    43: ["dynamics", "hololens"]
}

const UNLOCK = {}
for (const [level, ids] of Object.entries(UNLOCK_AT))
    for (const id of ids) UNLOCK[id] = Number(level)

export const ROSTER = {}
for (const tier of [1, 2, 3, 4]) {
    for (const [id, name] of Object.entries(NAMES[tier]))
        ROSTER[id] = { name, tier, hp: TIER_STATS[tier][0], points: TIER_STATS[tier][1],
                       unlock: UNLOCK[id] || 1 }
}

export const BOSSES = ["clippy", "cortanaboss", "zune", "bsod", "ieboss", "bob", "redring", "teamsboss", "winupdate", "kinect", "uac", "copilotboss"]
export const BOSS_NAMES = {
    clippy: "Clippy", cortanaboss: "Cortana", zune: "Zune", bsod: "Blue Screen of Death",
    ieboss: "Internet Explorer", bob: "Microsoft Bob", redring: "Red Ring of Death", teamsboss: "Teams",
    winupdate: "Windows Update", kinect: "Kinect", uac: "UAC Prompt", copilotboss: "Copilot"
}
export const BOSS_SHORT = {
    clippy: "CLIPPY", cortanaboss: "CORTANA", zune: "ZUNE", bsod: "BSOD", ieboss: "IE", bob: "BOB",
    redring: "RROD", teamsboss: "TEAMS", winupdate: "UPDATE", kinect: "KINECT", uac: "UAC", copilotboss: "COPILOT"
}
export const POWERUPS = ["sudo", "pacman", "firewall"]
export const POWERUP_DROP = 0.04
export const POWERUP_TICKS = 500
export const EXTRA_LIFE_EVERY = 10000
export const MUTE_TICKS = 90

export function mulberry32(seed) {
    let a = seed >>> 0
    return function () {
        a = (a + 0x6D2B79F5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function tierUnlockLevel(tier) {
    return 1 + 3 * (tier - 1)
}

export function unlockedTiers(level) {
    return [1, 2, 3, 4].filter(t => level >= tierUnlockLevel(t))
}

export function unlockedTypes(level) {
    return Object.keys(ROSTER).filter(id => ROSTER[id].unlock <= level)
}

export function newTypes(level) {
    return level === 1 ? [] : Object.keys(ROSTER).filter(id => ROSTER[id].unlock === level)
}

export function isBossLevel(level) {
    return level % 3 === 0
}

export function difficulty(level) {
    const n = level - 1
    return {
        rows: Math.min(6, 4 + Math.floor(n / 3)),
        cols: Math.min(10, 7 + Math.floor(n / 2)),
        marchSpeed: Math.min(3.0, 0.6 + 0.18 * n),
        stepDown: Math.min(28, 14 + 1.5 * n),
        fireChance: Math.min(0.05, 0.008 + 0.004 * n),
        enemyBulletSpeed: Math.min(7, 3 + 0.3 * n),
        startY: Math.min(160, 90 + 6 * n)
    }
}

const FUSION_PAIRS = (() => {
    const pairs = []
    for (const a of BOSSES)
        for (const b of BOSSES)
            if (a !== b) pairs.push([a, b])
    const rng = mulberry32(0x5EED)
    for (let i = pairs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const tmp = pairs[i]
        pairs[i] = pairs[j]
        pairs[j] = tmp
    }
    return pairs
})()

export function fusionPair(n) {
    return FUSION_PAIRS[n % FUSION_PAIRS.length].slice()
}

export function bossStats(level) {
    const k = Math.floor(level / 3)
    const fusion = k > BOSSES.length
    const [type, guest] = fusion ? fusionPair(k - BOSSES.length - 1) : [BOSSES[k - 1], null]
    return {
        k,
        type,
        guest,
        fusion,
        hp: 25 + 15 * (k - 1),
        points: 500 * k,
        attackEvery: Math.max(35, 100 - 10 * (k - 1)),
        bulletSpeed: Math.min(7, 3 + 0.5 * (k - 1)),
        speed: Math.min(5, 1.5 + 0.4 * (k - 1)),
        descend: Math.min(0.3, 0.06 + 0.02 * (k - 1)),
        attacks: fusion ? [type, guest] : [type]
    }
}

function weightedType(rng, ids, level) {
    const weight = id => ROSTER[id].tier * (ROSTER[id].unlock > level - 6 ? 3 : 1)
    const total = ids.reduce((sum, id) => sum + weight(id), 0)
    let r = rng() * total
    for (const id of ids) {
        r -= weight(id)
        if (r < 0) return id
    }
    return ids[ids.length - 1]
}

export function generateWave(level, seed) {
    const rng = mulberry32(seed)
    const d = difficulty(level)
    const boss = isBossLevel(level)
    const ids = unlockedTypes(level).filter(id => !boss || ROSTER[id].tier <= 2)
    const fresh = boss ? [] : newTypes(level)
    const rowCount = boss ? 2 : d.rows
    const rowTypes = fresh.slice()
    while (rowTypes.length < rowCount)
        rowTypes.push(weightedType(rng, ids, level))
    rowTypes.sort((a, b) => ROSTER[b].tier - ROSTER[a].tier)

    const aliens = []
    rowTypes.forEach((type, row) => {
        const info = ROSTER[type]
        for (let col = 0; col < d.cols; col++)
            aliens.push({ type, row, col, hp: info.hp, maxHp: info.hp, points: info.points })
    })

    let bossInfo = null
    if (boss) {
        const stats = bossStats(level)
        bossInfo = Object.assign({ maxHp: stats.hp }, stats)
    }
    return { aliens, boss: bossInfo, newTypes: fresh }
}

export function marchMultiplier(alive, total) {
    return 1 + 1.5 * (1 - alive / total)
}

export function levelClearBonus(level, lives) {
    return lives * 100 * level
}

export function awardLives(score, nextLife) {
    let gained = 0
    while (score >= nextLife) {
        gained++
        nextLife += EXTRA_LIFE_EVERY
    }
    return { gained, nextLife }
}

export function rectsOverlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function stepEnemyBullet(e, playerCx) {
    e.age++
    if (e.home > 0) {
        e.home--
        const want = Math.max(-3, Math.min(3, (playerCx - e.x - (e.w || 0) / 2) / 30))
        e.vx += Math.max(-0.15, Math.min(0.15, want - e.vx))
    }
    if (e.stall > 0) e.vy = --e.stall > 0 ? 0 : e.fall
    if (e.amp) e.x = e.x0 + e.amp * Math.sin(e.age / 8)
    else e.x += e.vx
    e.y += e.vy
}
